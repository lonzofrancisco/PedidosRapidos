import { query, withTransaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
import { generateShortCode } from '../../utils/shortCode.js';
import { buildWhatsappLink } from '../../utils/whatsapp.js';

/**
 * Crea un pedido a partir del carrito enviado por el cliente.
 *
 * IMPORTANTE: nunca confiamos en los precios que mande el cliente.
 * Releemos producto + opciones desde la BD, calculamos los precios y
 * guardamos snapshots inmutables en order_items / order_item_options.
 *
 * Forma del payload:
 * {
 *   customer: { name, phone, address?, notes? },
 *   items: [
 *     { product_id, quantity, option_ids?: string[], notes? }
 *   ]
 * }
 */
export async function createOrder(tenant, payload) {
  if (!payload.items?.length) throw badRequest('El carrito esta vacio');

  // 1) Cargar productos con sus grupos y opciones para validar.
  const productIds = [...new Set(payload.items.map(i => i.product_id))];
  const allOptionIds = [...new Set(payload.items.flatMap(i => i.option_ids ?? []))];

  const products = (await query(
    `SELECT id, name, price, active FROM products
      WHERE tenant_id = $1 AND id = ANY($2::uuid[])`,
    [tenant.id, productIds]
  )).rows;

  const productById = new Map(products.map(p => [p.id, p]));
  for (const id of productIds) {
    const p = productById.get(id);
    if (!p || !p.active) throw badRequest(`Producto invalido: ${id}`);
  }

  const groups = (await query(
    `SELECT id, product_id, name, type, required, min_select, max_select
       FROM product_option_groups
      WHERE tenant_id = $1 AND product_id = ANY($2::uuid[])`,
    [tenant.id, productIds]
  )).rows;
  const groupsByProduct = new Map();
  const groupById = new Map();
  for (const g of groups) {
    groupById.set(g.id, g);
    if (!groupsByProduct.has(g.product_id)) groupsByProduct.set(g.product_id, []);
    groupsByProduct.get(g.product_id).push(g);
  }

  const options = allOptionIds.length === 0 ? [] : (await query(
    `SELECT po.id, po.group_id, po.name, po.price_delta, pog.name AS group_name, pog.product_id
       FROM product_options po
       JOIN product_option_groups pog ON pog.id = po.group_id
      WHERE po.tenant_id = $1 AND po.id = ANY($2::uuid[]) AND po.active = TRUE`,
    [tenant.id, allOptionIds]
  )).rows;
  const optionById = new Map(options.map(o => [o.id, o]));

  // 2) Construir items con precios calculados desde la BD.
  const computedItems = [];
  let total = 0;

  for (const raw of payload.items) {
    const product = productById.get(raw.product_id);
    const productGroups = groupsByProduct.get(product.id) ?? [];
    const selectedOptions = (raw.option_ids ?? []).map(id => {
      const opt = optionById.get(id);
      if (!opt || opt.product_id !== product.id) {
        throw badRequest(`Opcion invalida ${id} para producto ${product.name}`);
      }
      return opt;
    });

    // Validar cardinalidad de cada grupo
    const countByGroup = new Map();
    for (const o of selectedOptions) {
      countByGroup.set(o.group_id, (countByGroup.get(o.group_id) ?? 0) + 1);
    }
    for (const g of productGroups) {
      const count = countByGroup.get(g.id) ?? 0;
      if (g.required && count < Math.max(g.min_select, 1)) {
        throw badRequest(`Falta seleccionar opciones del grupo "${g.name}"`);
      }
      if (count < g.min_select) {
        throw badRequest(`Selecciona al menos ${g.min_select} en "${g.name}"`);
      }
      if (count > g.max_select) {
        throw badRequest(`Maximo ${g.max_select} en "${g.name}"`);
      }
      if (g.type === 'single' && count > 1) {
        throw badRequest(`Solo una opcion permitida en "${g.name}"`);
      }
    }

    const optionsTotal = selectedOptions.reduce((s, o) => s + Number(o.price_delta), 0);
    const unitPrice = Number(product.price) + optionsTotal;
    const subtotal = unitPrice * raw.quantity;
    total += subtotal;

    computedItems.push({
      product_id: product.id,
      product_name: product.name,
      unit_price: unitPrice,
      quantity: raw.quantity,
      subtotal,
      notes: raw.notes ?? null,
      options: selectedOptions.map(o => ({
        option_id: o.id,
        group_name: o.group_name,
        option_name: o.name,
        price_delta: Number(o.price_delta),
      })),
    });
  }

  // 3) Insertar todo en una transaccion.
  const order = await withTransaction(async (client) => {
    let shortCode;
    let orderRow;
    // reintenta hasta 5 veces si por casualidad colisiona el short_code
    for (let attempt = 0; attempt < 5; attempt++) {
      shortCode = generateShortCode(6);
      try {
        const { rows } = await client.query(
          `INSERT INTO orders
             (tenant_id, short_code, customer_name, customer_phone, customer_address, notes, total, currency)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING id, short_code, status, total, currency, created_at, customer_name, customer_phone, customer_address, notes`,
          [
            tenant.id, shortCode,
            payload.customer.name, payload.customer.phone,
            payload.customer.address ?? null, payload.customer.notes ?? null,
            total.toFixed(2), tenant.currency,
          ]
        );
        orderRow = rows[0];
        break;
      } catch (err) {
        if (err.code === '23505' && attempt < 4) continue; // unique violation -> retry
        throw err;
      }
    }

    for (const item of computedItems) {
      const { rows: [itemRow] } = await client.query(
        `INSERT INTO order_items
           (tenant_id, order_id, product_id, product_name, unit_price, quantity, subtotal, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [
          tenant.id, orderRow.id, item.product_id, item.product_name,
          item.unit_price.toFixed(2), item.quantity, item.subtotal.toFixed(2), item.notes,
        ]
      );

      for (const opt of item.options) {
        await client.query(
          `INSERT INTO order_item_options
             (tenant_id, order_item_id, option_id, group_name, option_name, price_delta)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [tenant.id, itemRow.id, opt.option_id, opt.group_name, opt.option_name, opt.price_delta.toFixed(2)]
        );
      }
    }

    return { ...orderRow, items: computedItems };
  });

  const whatsappUrl = buildWhatsappLink({ tenant, order, items: computedItems });
  return { order, whatsappUrl };
}

export async function getOrder(tenantId, orderId) {
  const { rows } = await query(
    `SELECT id, short_code, status, total, currency, created_at,
            customer_name, customer_phone, customer_address, notes
       FROM orders WHERE tenant_id = $1 AND id = $2`,
    [tenantId, orderId]
  );
  const order = rows[0];
  if (!order) throw notFound('Pedido no encontrado');

  const items = (await query(
    `SELECT id, product_id, product_name, unit_price, quantity, subtotal, notes
       FROM order_items WHERE order_id = $1`,
    [orderId]
  )).rows;

  if (items.length > 0) {
    const opts = (await query(
      `SELECT order_item_id, option_id, group_name, option_name, price_delta
         FROM order_item_options WHERE order_item_id = ANY($1::uuid[])`,
      [items.map(i => i.id)]
    )).rows;
    const byItem = new Map();
    for (const o of opts) {
      if (!byItem.has(o.order_item_id)) byItem.set(o.order_item_id, []);
      byItem.get(o.order_item_id).push(o);
    }
    for (const it of items) it.options = byItem.get(it.id) ?? [];
  }

  return { ...order, items };
}

export async function listOrders(tenantId, { status, limit = 50 } = {}) {
  const where = ['tenant_id = $1'];
  const params = [tenantId];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  params.push(Math.min(limit, 200));

  const { rows } = await query(
    `SELECT id, short_code, status, total, currency, created_at,
            customer_name, customer_phone
       FROM orders WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  return rows;
}

const VALID_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'];

export async function updateStatus(tenantId, orderId, status) {
  if (!VALID_STATUSES.includes(status)) throw badRequest('Estado invalido');
  const { rowCount } = await query(
    `UPDATE orders SET status = $1 WHERE tenant_id = $2 AND id = $3`,
    [status, tenantId, orderId]
  );
  if (rowCount === 0) throw notFound('Pedido no encontrado');
  return getOrder(tenantId, orderId);
}
