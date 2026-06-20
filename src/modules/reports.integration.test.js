import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Test de integracion de reportes: requiere Postgres (se saltea si no hay DB).
// Verifica que getSummary excluya pedidos cancelados de la facturacion y calcule
// bien totales, ticket promedio y top de productos.
process.env.DATABASE_URL ||= 'postgres://pedidos:pedidos@localhost:5432/pedidos';
process.env.JWT_SECRET ||= 'test-secret';

const { query, pool } = await import('../config/db.js');
const { runMigrations } = await import('../config/migrate.js');
const products = await import('./products/products.service.js');
const orders = await import('./orders/orders.service.js');
const reports = await import('./reports/reports.service.js');

const suffix = crypto.randomUUID().slice(0, 8);
const ctx = {};
let ready = false;

try {
  await query('SELECT 1');
  await runMigrations();

  const { rows: [t] } = await query(
    `INSERT INTO tenants (slug, name, whatsapp_number, currency)
     VALUES ($1, 'Reportes Test', '5491100000000', 'ARS')
     RETURNING id, slug, currency, whatsapp_number`,
    [`ztest-rep-${suffix}`]
  );
  ctx.T = t;

  const p1 = await products.createProduct(t.id, { name: 'P1', price: 100 });
  const p2 = await products.createProduct(t.id, { name: 'P2', price: 50 });

  const mk = (productId, quantity) => orders.createOrder(t, {
    customer: { name: 'C', phone: '5491100000001' },
    items: [{ product_id: productId, quantity }],
  });

  await mk(p1.id, 2);                                   // pending, total 200
  const o2 = (await mk(p2.id, 1)).order;                // total 50
  await orders.updateStatus(t.id, o2.id, 'delivered');
  const o3 = (await mk(p1.id, 1)).order;                // total 100
  await orders.updateStatus(t.id, o3.id, 'cancelled');  // NO debe contar

  ctx.summary = await reports.getSummary(t.id, {
    from: '2000-01-01T00:00:00.000Z',
    to: new Date(Date.now() + 86_400_000).toISOString(),
  });

  ready = true;
} catch (err) {
  console.warn('[reports.test] DB no disponible, se saltean los tests:', err.message);
}

after(async () => {
  try {
    if (ready) await query('DELETE FROM tenants WHERE id = $1', [ctx.T.id]);
  } finally {
    await pool.end().catch(() => {});
  }
});

const opt = { skip: ready ? false : 'sin DB disponible' };

test('totals: revenue excluye cancelados (200 + 50, no el de 100)', opt, () => {
  assert.equal(ctx.summary.totals.revenue, 250);
});

test('totals: orders cuenta no-cancelados y cancelled aparte', opt, () => {
  assert.equal(ctx.summary.totals.orders, 2);
  assert.equal(ctx.summary.totals.cancelled, 1);
});

test('totals: ticket promedio = revenue / orders', opt, () => {
  assert.equal(ctx.summary.totals.avgTicket, 125);
});

test('topProducts: ordenado por cantidad y excluye cancelados', opt, () => {
  const top = ctx.summary.topProducts;
  assert.equal(top[0].product_name, 'P1');
  assert.equal(top[0].qty, 2); // las 2 del pedido pending; la del cancelado no cuenta
  const p2 = top.find((p) => p.product_name === 'P2');
  assert.equal(p2.qty, 1);
});

test('byStatus: refleja pending, delivered y cancelled', opt, () => {
  const byStatus = Object.fromEntries(ctx.summary.byStatus.map((s) => [s.status, s.orders]));
  assert.equal(byStatus.pending, 1);
  assert.equal(byStatus.delivered, 1);
  assert.equal(byStatus.cancelled, 1);
});
