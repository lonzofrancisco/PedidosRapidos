import { query, withTransaction } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

/**
 * Lista productos del tenant, con sus grupos de opciones y opciones individuales.
 * Una sola consulta por tabla para minimizar round-trips.
 */
export async function listProducts(tenantId, { onlyActive = true } = {}) {
  const products = (await query(
    `SELECT id, category_id, name, description, price, image_url, active
       FROM products
      WHERE tenant_id = $1 ${onlyActive ? 'AND active = TRUE' : ''}
      ORDER BY name`,
    [tenantId]
  )).rows;

  if (products.length === 0) return [];

  const productIds = products.map(p => p.id);

  const groups = (await query(
    `SELECT id, product_id, name, type, required, min_select, max_select, position
       FROM product_option_groups
      WHERE tenant_id = $1 AND product_id = ANY($2::uuid[])
      ORDER BY position, name`,
    [tenantId, productIds]
  )).rows;

  const groupIds = groups.map(g => g.id);

  const options = groupIds.length === 0 ? [] : (await query(
    `SELECT id, group_id, name, price_delta, position, active
       FROM product_options
      WHERE tenant_id = $1 AND group_id = ANY($2::uuid[]) ${onlyActive ? 'AND active = TRUE' : ''}
      ORDER BY position, name`,
    [tenantId, groupIds]
  )).rows;

  const groupsByProduct = new Map();
  const optionsByGroup = new Map();
  for (const g of groups) {
    if (!groupsByProduct.has(g.product_id)) groupsByProduct.set(g.product_id, []);
    groupsByProduct.get(g.product_id).push({ ...g, options: [] });
  }
  for (const o of options) {
    optionsByGroup.set(o.group_id, optionsByGroup.get(o.group_id) ?? []);
    optionsByGroup.get(o.group_id).push(o);
  }
  for (const list of groupsByProduct.values()) {
    for (const g of list) g.options = optionsByGroup.get(g.id) ?? [];
  }

  return products.map(p => ({ ...p, option_groups: groupsByProduct.get(p.id) ?? [] }));
}

export async function getProduct(tenantId, productId) {
  const list = await listProducts(tenantId, { onlyActive: false });
  const found = list.find(p => p.id === productId);
  if (!found) throw notFound('Producto no encontrado');
  return found;
}

/**
 * Crea un producto con sus grupos y opciones en una sola transaccion.
 *
 * Forma esperada:
 * {
 *   name, description?, price, image_url?, category_id?, active?,
 *   option_groups?: [{
 *     name, type: 'single'|'multi', required?, min_select?, max_select?, position?,
 *     options: [{ name, price_delta?, position? }]
 *   }]
 * }
 */
export async function createProduct(tenantId, payload) {
  return withTransaction(async (client) => {
    const { rows: [product] } = await client.query(
      `INSERT INTO products (tenant_id, category_id, name, description, price, image_url, active)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, TRUE))
       RETURNING id, category_id, name, description, price, image_url, active`,
      [
        tenantId,
        payload.category_id ?? null,
        payload.name,
        payload.description ?? null,
        payload.price,
        payload.image_url ?? null,
        payload.active,
      ]
    );

    const option_groups = [];
    for (const [gi, g] of (payload.option_groups ?? []).entries()) {
      const { rows: [group] } = await client.query(
        `INSERT INTO product_option_groups
           (tenant_id, product_id, name, type, required, min_select, max_select, position)
         VALUES ($1,$2,$3,$4, COALESCE($5,FALSE), COALESCE($6,0), COALESCE($7,1), COALESCE($8,$9))
         RETURNING id, product_id, name, type, required, min_select, max_select, position`,
        [tenantId, product.id, g.name, g.type, g.required, g.min_select, g.max_select, g.position, gi + 1]
      );

      const options = [];
      for (const [oi, o] of (g.options ?? []).entries()) {
        const { rows: [option] } = await client.query(
          `INSERT INTO product_options (tenant_id, group_id, name, price_delta, position)
           VALUES ($1,$2,$3, COALESCE($4,0), COALESCE($5,$6))
           RETURNING id, group_id, name, price_delta, position, active`,
          [tenantId, group.id, o.name, o.price_delta, o.position, oi + 1]
        );
        options.push(option);
      }
      option_groups.push({ ...group, options });
    }

    return { ...product, option_groups };
  });
}

export async function updateProduct(tenantId, productId, patch) {
  const fields = [];
  const values = [];
  const allowed = ['name', 'description', 'price', 'image_url', 'category_id', 'active'];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      values.push(patch[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return getProduct(tenantId, productId);

  values.push(tenantId, productId);
  const { rows } = await query(
    `UPDATE products SET ${fields.join(', ')}
      WHERE tenant_id = $${values.length - 1} AND id = $${values.length}
      RETURNING id`,
    values
  );
  if (rows.length === 0) throw notFound('Producto no encontrado');
  return getProduct(tenantId, productId);
}

export async function deleteProduct(tenantId, productId) {
  const { rowCount } = await query(
    `DELETE FROM products WHERE tenant_id = $1 AND id = $2`,
    [tenantId, productId]
  );
  if (rowCount === 0) throw notFound('Producto no encontrado');
}
