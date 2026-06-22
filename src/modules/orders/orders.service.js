import { query, withTransaction } from '../../config/db.js';
import { badRequest, notFound } from '../../utils/httpError.js';
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
 *     {
 *       product_id, quantity, notes?,
 *       // forma rica (preferida) - cada opcion con su cantidad:
 *       selections?: [{ option_id, quantity? }],
 *       // forma compacta retro-compatible (qty implicita 1):
 *       option_ids?: string[]
 *     }
 *   ]
 * }
 */
export async function createOrder(tenant, payload, { publicBaseUrl } = {}) {
  if (!payload.items?.length) throw badRequest('El carrito esta vacio');

  // Normaliza el item a una lista de selecciones {option_id, quantity}.
  const itemSelections = payload.items.map(itemSelectionsOf);

  // 1) Cargar productos con sus grupos y opciones para validar.
  const productIds = [...new Set(payload.items.map(i => i.product_id))];
  const allOptionIds = [...new Set(itemSelections.flatMap(s => s.map(x => x.option_id)))];

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
  for (const g of groups) {
    if (!groupsByProduct.has(g.product_id)) groupsByProduct.set(g.product_id, []);
    groupsByProduct.get(g.product_id).push(g);
  }

  const options = allOptionIds.length === 0 ? [] : (await query(
    `SELECT po.id, po.group_id, po.name, po.price_delta, pog.name AS group_name, pog.type AS group_type, pog.product_id
       FROM product_options po
       JOIN product_option_groups pog ON pog.id = po.group_id
      WHERE po.tenant_id = $1 AND po.id = ANY($2::uuid[]) AND po.active = TRUE`,
    [tenant.id, allOptionIds]
  )).rows;
  const optionById = new Map(options.map(o => [o.id, o]));

  // 2) Construir items con precios calculados desde la BD.
  const computedItems = [];
  let total = 0;

  for (const [idx, raw] of payload.items.entries()) {
    const product = productById.get(raw.product_id);
    const productGroups = groupsByProduct.get(product.id) ?? [];

    // Resolver cada seleccion contra la BD.
    const resolved = itemSelections[idx].map(sel => {
      const opt = optionById.get(sel.option_id);
      if (!opt || opt.product_id !== product.id) {
        throw badRequest(`Opcion invalida ${sel.option_id} para "${product.name}"`);
      }
      return { ...opt, quantity: sel.quantity };
    });

    // Validar cardinalidad por grupo segun el tipo.
    //   single   -> sumQty 0..1, max 1 seleccion, qty=1
    //   multi    -> sumQty = numero de selecciones distintas, qty=1 c/u
    //   quantity -> sumQty puede ser cualquier suma de cantidades
    const byGroup = new Map();
    for (const r of resolved) {
      if (!byGroup.has(r.group_id)) byGroup.set(r.group_id, []);
      byGroup.get(r.group_id).push(r);
    }

    for (const g of productGroups) {
      const sels = byGroup.get(g.id) ?? [];
      const sumQty = sels.reduce((s, r) => s + r.quantity, 0);

      if (g.required && sumQty < Math.max(g.min_select, 1)) {
        throw badRequest(`Falta seleccionar opciones del grupo "${g.name}"`);
      }
      if (sumQty < g.min_select) {
        throw badRequest(`Selecciona al menos ${g.min_select} en "${g.name}"`);
      }
      if (sumQty > g.max_select) {
        throw badRequest(`Maximo ${g.max_select} en "${g.name}"`);
      }

      if (g.type === 'single') {
        if (sels.length > 1) throw badRequest(`Solo una opcion permitida en "${g.name}"`);
        if (sels[0] && sels[0].quantity !== 1) throw badRequest(`En "${g.name}" la cantidad debe ser 1`);
      }
      if (g.type === 'multi') {
        if (sels.some(r => r.quantity !== 1)) {
          throw badRequest(`En "${g.name}" cada opcion suma 1 (no admite cantidades)`);
        }
        const ids = new Set(sels.map(r => r.option_id));
        if (ids.size !== sels.length) {
          throw badRequest(`En "${g.name}" no se puede repetir la misma opcion`);
        }
      }
      // 'quantity': sin restricciones extra mas alla del rango total.
    }

    const optionsTotal = resolved.reduce(
      (s, r) => s + Number(r.price_delta) * r.quantity,
      0
    );
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
      options: resolved.map(r => ({
        option_id: r.id,
        group_name: r.group_name,
        option_name: r.name,
        price_delta: Number(r.price_delta),
        quantity: r.quantity,
      })),
    });
  }

  // Validaciones de operacion de tienda antes de insertar.
  if (!tenant.is_open) {
    throw badRequest('Esta tienda está temporalmente cerrada.');
  }

  const shippingCost = Number(tenant.shipping_cost ?? 0);
  const subtotalWithShipping = total + shippingCost;

  if (tenant.min_order_amount !== null && tenant.min_order_amount !== undefined) {
    const minAmount = Number(tenant.min_order_amount);
    if (subtotalWithShipping < minAmount) {
      throw badRequest(`El pedido debe ser de al menos $${minAmount.toFixed(2)}`);
    }
  }

  total = subtotalWithShipping;

  // 3) Insertar todo en una transaccion.
  const order = await withTransaction(async (client) => {
    // Numero de pedido secuencial por tienda (#1, #2, ...). El UPDATE bloquea
    // la fila del tenant hasta el commit, asi dos pedidos concurrentes no toman
    // el mismo numero; si el pedido falla, el incremento se revierte (rollback).
    const { rows: [{ order_seq: number }] } = await client.query(
      `UPDATE tenants SET order_seq = order_seq + 1 WHERE id = $1 RETURNING order_seq`,
      [tenant.id]
    );
    const shortCode = String(number);

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
    const orderRow = rows[0];

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
             (tenant_id, order_item_id, option_id, group_name, option_name, price_delta, quantity)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [tenant.id, itemRow.id, opt.option_id, opt.group_name, opt.option_name, opt.price_delta.toFixed(2), opt.quantity]
        );
      }
    }

    return { ...orderRow, items: computedItems };
  });

  // El comprador ve su pedido en /t/:slug/orders/:id (publico). El mensaje de
  // WhatsApp lo recibe la TIENDA, asi que su link apunta a /admin/orders/:id
  // (el login redirige de vuelta al pedido si hace falta).
  const base = publicBaseUrl ? publicBaseUrl.replace(/\/+$/, '') : null;
  const orderUrl = base ? `${base}/t/${tenant.slug}/orders/${order.id}` : null;
  const adminOrderUrl = base ? `${base}/admin/orders/${order.id}` : null;
  const whatsappUrl = buildWhatsappLink({ tenant, order, orderUrl: adminOrderUrl });
  return { order, whatsappUrl, orderUrl };
}

const ORDER_COLUMNS = `id, short_code, status, total, currency, created_at,
            customer_name, customer_phone, customer_address, notes`;

// Carga items + opciones de un pedido ya leido y los adjunta.
async function attachItems(order) {
  const items = (await query(
    `SELECT id, product_id, product_name, unit_price, quantity, subtotal, notes
       FROM order_items WHERE order_id = $1`,
    [order.id]
  )).rows;

  if (items.length > 0) {
    const opts = (await query(
      `SELECT order_item_id, option_id, group_name, option_name, price_delta, quantity
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

// Lectura admin: exige que el pedido pertenezca al tenant del que pregunta.
export async function getOrder(tenantId, orderId) {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE tenant_id = $1 AND id = $2`,
    [tenantId, orderId]
  );
  const order = rows[0];
  if (!order) throw notFound('Pedido no encontrado');
  return attachItems(order);
}

// Lectura publica por id (magic link por UUID): la usa el comprador para ver
// su pedido sin estar logueado. No filtra por tenant porque el id es unico.
export async function getOrderById(orderId) {
  const { rows } = await query(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) throw notFound('Pedido no encontrado');
  return attachItems(order);
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

/**
 * Convierte el item del payload (selections + option_ids retro-compat) a una
 * lista normalizada [{ option_id, quantity }]. Suma cantidades si el mismo
 * option_id aparece varias veces.
 */
function itemSelectionsOf(item) {
  const map = new Map();
  for (const id of item.option_ids ?? []) {
    map.set(id, (map.get(id) ?? 0) + 1);
  }
  for (const sel of item.selections ?? []) {
    const q = sel.quantity ?? 1;
    map.set(sel.option_id, (map.get(sel.option_id) ?? 0) + q);
  }
  return [...map.entries()].map(([option_id, quantity]) => ({ option_id, quantity }));
}
