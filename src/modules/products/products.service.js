import { query, withTransaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';

/**
 * Lista productos del tenant, con sus grupos de opciones y opciones individuales.
 * Una sola consulta por tabla para minimizar round-trips.
 */
export async function listProducts(tenantId, { onlyActive = true } = {}) {
  const products = (await query(
    `SELECT id, category_id, name, description, price, image_url, image_urls, active
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
    // La portada (image_url) se deriva de la galeria: primera imagen, o el
    // image_url suelto si no vino galeria.
    const imageUrls = payload.image_urls ?? [];
    const cover = imageUrls[0] ?? payload.image_url ?? null;

    const { rows: [product] } = await client.query(
      `INSERT INTO products (tenant_id, category_id, name, description, price, image_url, image_urls, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, category_id, name, description, price, image_url, image_urls, active`,
      [
        tenantId,
        payload.category_id ?? null,
        payload.name,
        payload.description ?? null,
        payload.price,
        cover,
        imageUrls,
        payload.active ?? true,
      ]
    );

    const option_groups = [];
    for (const [gi, g] of (payload.option_groups ?? []).entries()) {
      const { rows: [group] } = await client.query(
        `INSERT INTO product_option_groups
           (tenant_id, product_id, name, type, required, min_select, max_select, position)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id, product_id, name, type, required, min_select, max_select, position`,
        [
          tenantId, product.id, g.name, g.type,
          g.required ?? false,
          g.min_select ?? 0,
          g.max_select ?? 1,
          g.position ?? gi + 1,
        ]
      );

      const options = [];
      for (const [oi, o] of (g.options ?? []).entries()) {
        const { rows: [option] } = await client.query(
          `INSERT INTO product_options (tenant_id, group_id, name, price_delta, position)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING id, group_id, name, price_delta, position, active`,
          [
            tenantId, group.id, o.name,
            o.price_delta ?? 0,
            o.position ?? oi + 1,
          ]
        );
        options.push(option);
      }
      option_groups.push({ ...group, options });
    }

    return { ...product, option_groups };
  });
}

export async function updateProduct(tenantId, productId, patch) {
  // Verifica que el producto pertenezca al tenant antes de tocar nada.
  const exists = await query(
    `SELECT 1 FROM products WHERE tenant_id = $1 AND id = $2`,
    [tenantId, productId]
  );
  if (exists.rowCount === 0) throw notFound('Producto no encontrado');

  await withTransaction(async (client) => {
    // 1) Campos basicos del producto
    const fields = [];
    const values = [];
    const allowed = ['name', 'description', 'price', 'image_url', 'image_urls', 'category_id', 'active'];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        values.push(patch[key]);
        fields.push(`${key} = $${values.length}`);
      }
    }
    // Si se actualiza la galeria sin mandar image_url explicito, sincronizamos
    // la portada con la primera imagen de la galeria.
    if (
      Object.prototype.hasOwnProperty.call(patch, 'image_urls') &&
      !Object.prototype.hasOwnProperty.call(patch, 'image_url')
    ) {
      values.push(patch.image_urls?.[0] ?? null);
      fields.push(`image_url = $${values.length}`);
    }
    if (fields.length > 0) {
      values.push(tenantId, productId);
      await client.query(
        `UPDATE products SET ${fields.join(', ')}
          WHERE tenant_id = $${values.length - 1} AND id = $${values.length}`,
        values
      );
    }

    // 2) Reemplazo de grupos/opciones (opcional)
    if (Array.isArray(patch.option_groups)) {
      await replaceOptionGroups(client, tenantId, productId, patch.option_groups);
    }
  });

  return getProduct(tenantId, productId);
}

/**
 * Reemplaza los grupos de opciones de un producto haciendo diff por id:
 *   - Grupos/opciones presentes con id existente -> UPDATE
 *   - Grupos/opciones nuevos (sin id)            -> INSERT
 *   - Grupos/opciones omitidos del payload       -> DELETE
 *
 * Los snapshots ya guardados en order_items / order_item_options no se ven
 * afectados (se conservan name + price). FKs usan ON DELETE SET NULL para
 * mantener el historial consistente.
 */
async function replaceOptionGroups(client, tenantId, productId, incomingGroups) {
  const existingGroups = (await client.query(
    `SELECT id FROM product_option_groups WHERE tenant_id = $1 AND product_id = $2`,
    [tenantId, productId]
  )).rows;
  const existingGroupIds = new Set(existingGroups.map(r => r.id));
  const incomingGroupIds = new Set(
    incomingGroups.filter(g => g.id).map(g => g.id)
  );

  // Validar que todo id de grupo enviado pertenezca al producto
  for (const g of incomingGroups) {
    if (g.id && !existingGroupIds.has(g.id)) {
      throw badRequest(`Grupo de opciones desconocido: ${g.id}`);
    }
  }

  // Borrar grupos que el cliente quito (cascade borra sus opciones)
  const groupsToDelete = [...existingGroupIds].filter(id => !incomingGroupIds.has(id));
  if (groupsToDelete.length > 0) {
    await client.query(
      `DELETE FROM product_option_groups
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
      [tenantId, groupsToDelete]
    );
  }

  // Upsert grupo a grupo (mantiene orden segun el array entrante)
  for (const [gi, g] of incomingGroups.entries()) {
    const groupValues = [
      g.name,
      g.type,
      g.required ?? false,
      g.min_select ?? 0,
      g.max_select ?? 1,
      g.position ?? gi + 1,
    ];

    let groupId = g.id;
    if (groupId) {
      await client.query(
        `UPDATE product_option_groups
            SET name=$1, type=$2, required=$3, min_select=$4, max_select=$5, position=$6
          WHERE tenant_id=$7 AND id=$8`,
        [...groupValues, tenantId, groupId]
      );
    } else {
      const r = await client.query(
        `INSERT INTO product_option_groups
           (tenant_id, product_id, name, type, required, min_select, max_select, position)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [tenantId, productId, ...groupValues]
      );
      groupId = r.rows[0].id;
    }

    // Diff de opciones del grupo
    const existingOpts = (await client.query(
      `SELECT id FROM product_options WHERE tenant_id = $1 AND group_id = $2`,
      [tenantId, groupId]
    )).rows;
    const existingOptIds = new Set(existingOpts.map(r => r.id));
    const incomingOptIds = new Set((g.options ?? []).filter(o => o.id).map(o => o.id));

    for (const o of g.options ?? []) {
      if (o.id && !existingOptIds.has(o.id)) {
        throw badRequest(`Opcion desconocida: ${o.id}`);
      }
    }

    const optsToDelete = [...existingOptIds].filter(id => !incomingOptIds.has(id));
    if (optsToDelete.length > 0) {
      await client.query(
        `DELETE FROM product_options
          WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
        [tenantId, optsToDelete]
      );
    }

    for (const [oi, o] of (g.options ?? []).entries()) {
      const optValues = [
        o.name,
        o.price_delta ?? 0,
        o.position ?? oi + 1,
        o.active ?? true,
      ];
      if (o.id) {
        await client.query(
          `UPDATE product_options
              SET name=$1, price_delta=$2, position=$3, active=$4
            WHERE tenant_id=$5 AND id=$6`,
          [...optValues, tenantId, o.id]
        );
      } else {
        await client.query(
          `INSERT INTO product_options (tenant_id, group_id, name, price_delta, position, active)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [tenantId, groupId, ...optValues]
        );
      }
    }
  }
}

export async function deleteProduct(tenantId, productId) {
  const { rowCount } = await query(
    `DELETE FROM products WHERE tenant_id = $1 AND id = $2`,
    [tenantId, productId]
  );
  if (rowCount === 0) throw notFound('Producto no encontrado');
}
