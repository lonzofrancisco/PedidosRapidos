import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Tests de aislamiento multi-tenant: verifican que un tenant NO pueda leer ni
// modificar datos de otro a traves de los services. Requieren un Postgres
// accesible; si no hay DB se SALTEAN (no fallan). En CI hay un servicio
// postgres; en local usa el del docker-compose (localhost:5432).
process.env.DATABASE_URL ||= 'postgres://pedidos:pedidos@localhost:5432/pedidos';
process.env.JWT_SECRET ||= 'test-secret';

const { query, pool } = await import('../config/db.js');
const { runMigrations } = await import('../config/migrate.js');
const products = await import('./products/products.service.js');
const orders = await import('./orders/orders.service.js');

const suffix = crypto.randomUUID().slice(0, 8);
const ctx = {};
let ready = false;

async function makeTenant(letter) {
  const { rows: [t] } = await query(
    `INSERT INTO tenants (slug, name, whatsapp_number, currency)
     VALUES ($1, $2, $3, 'ARS')
     RETURNING id, slug, currency, whatsapp_number`,
    [`ztest-iso-${letter}-${suffix}`, `Iso ${letter}`, '5491100000000']
  );
  return t;
}

// Setup en top-level await: corre ANTES de registrar los tests, asi `ready`
// ya esta resuelto cuando definimos el { skip } de cada uno.
try {
  await query('SELECT 1');
  await runMigrations();

  ctx.A = await makeTenant('a');
  ctx.B = await makeTenant('b');
  ctx.prodA = await products.createProduct(ctx.A.id, { name: 'Prod A', price: 100 });
  ctx.prodB = await products.createProduct(ctx.B.id, { name: 'Prod B', price: 200 });
  ctx.orderA = (await orders.createOrder(ctx.A, {
    customer: { name: 'Cliente A', phone: '5491100000001' },
    items: [{ product_id: ctx.prodA.id, quantity: 1 }],
  })).order;
  ctx.orderB = (await orders.createOrder(ctx.B, {
    customer: { name: 'Cliente B', phone: '5491100000002' },
    items: [{ product_id: ctx.prodB.id, quantity: 1 }],
  })).order;

  ready = true;
} catch (err) {
  console.warn('[isolation.test] DB no disponible, se saltean los tests:', err.message);
}

after(async () => {
  try {
    if (ready) await query('DELETE FROM tenants WHERE id = ANY($1::uuid[])', [[ctx.A.id, ctx.B.id]]);
  } finally {
    await pool.end().catch(() => {});
  }
});

const opt = { skip: ready ? false : 'sin DB disponible' };

test('productos: listProducts solo devuelve los del propio tenant', opt, async () => {
  const ids = (await products.listProducts(ctx.A.id, { onlyActive: false })).map((p) => p.id);
  assert.ok(ids.includes(ctx.prodA.id), 'A ve su propio producto');
  assert.ok(!ids.includes(ctx.prodB.id), 'A NO ve el producto de B');
});

test('productos: getProduct cruzado -> not found', opt, async () => {
  await assert.rejects(() => products.getProduct(ctx.A.id, ctx.prodB.id), /no encontrado/i);
});

test('productos: updateProduct cruzado no modifica y tira not found', opt, async () => {
  await assert.rejects(() => products.updateProduct(ctx.A.id, ctx.prodB.id, { name: 'HACK' }), /no encontrado/i);
  const stillB = await products.getProduct(ctx.B.id, ctx.prodB.id);
  assert.equal(stillB.name, 'Prod B', 'el producto de B quedo intacto');
});

test('productos: deleteProduct cruzado no borra y tira not found', opt, async () => {
  await assert.rejects(() => products.deleteProduct(ctx.A.id, ctx.prodB.id), /no encontrado/i);
  const stillB = await products.getProduct(ctx.B.id, ctx.prodB.id);
  assert.equal(stillB.id, ctx.prodB.id, 'el producto de B sigue existiendo');
});

test('pedidos: getOrder cruzado -> not found', opt, async () => {
  await assert.rejects(() => orders.getOrder(ctx.A.id, ctx.orderB.id), /no encontrado/i);
});

test('pedidos: updateStatus cruzado -> not found', opt, async () => {
  await assert.rejects(() => orders.updateStatus(ctx.A.id, ctx.orderB.id, 'confirmed'), /no encontrado/i);
});

test('pedidos: listOrders solo devuelve los del propio tenant', opt, async () => {
  const ids = (await orders.listOrders(ctx.A.id)).map((o) => o.id);
  assert.ok(ids.includes(ctx.orderA.id), 'A ve su propio pedido');
  assert.ok(!ids.includes(ctx.orderB.id), 'A NO ve el pedido de B');
});

test('pedidos: getOrderById es publico a proposito (magic link por UUID)', opt, async () => {
  // Documenta que esta lectura NO filtra por tenant: el comprador ve su pedido
  // por id. Es intencional (el UUID actua de credencial), no una fuga.
  const o = await orders.getOrderById(ctx.orderB.id);
  assert.equal(o.id, ctx.orderB.id);
});
