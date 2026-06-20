import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

// Zona horaria para agrupar "por dia". El producto es AR; a futuro podria ser
// un campo por tenant.
const TZ = 'America/Argentina/Buenos_Aires';

/**
 * Resumen de ventas del tenant para el rango [from, to).
 *
 * "Ventas" excluye pedidos cancelados (totals.revenue, byDay, topProducts).
 * El desglose por estado (byStatus) si los incluye, como referencia.
 * Todas las consultas filtran por tenant_id (aislamiento multi-tenant).
 */
export async function getSummary(tenantId, { from, to }) {
  const { rows: [tenant] } = await query(`SELECT currency FROM tenants WHERE id = $1`, [tenantId]);
  if (!tenant) throw notFound('Tenant no encontrado');

  const params = [tenantId, from, to];

  const { rows: [totals] } = await query(
    `SELECT
        COUNT(*) FILTER (WHERE status <> 'cancelled')::int                    AS orders,
        COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::float8  AS revenue,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int                     AS cancelled
       FROM orders
      WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3`,
    params
  );

  const byDay = (await query(
    `SELECT to_char((created_at AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS orders,
            COALESCE(SUM(total), 0)::float8 AS revenue
       FROM orders
      WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3 AND status <> 'cancelled'
      GROUP BY 1
      ORDER BY 1`,
    [...params, TZ]
  )).rows;

  const topProducts = (await query(
    `SELECT oi.product_name,
            SUM(oi.quantity)::int AS qty,
            COALESCE(SUM(oi.subtotal), 0)::float8 AS revenue
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE o.tenant_id = $1 AND o.created_at >= $2 AND o.created_at < $3 AND o.status <> 'cancelled'
      GROUP BY oi.product_name
      ORDER BY qty DESC, revenue DESC
      LIMIT 10`,
    params
  )).rows;

  const byStatus = (await query(
    `SELECT status, COUNT(*)::int AS orders
       FROM orders
      WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3
      GROUP BY status`,
    params
  )).rows;

  const orders = totals.orders ?? 0;
  const revenue = totals.revenue ?? 0;
  const avgTicket = orders > 0 ? revenue / orders : 0;

  return {
    currency: tenant.currency,
    totals: { revenue, orders, avgTicket, cancelled: totals.cancelled ?? 0 },
    byDay,
    topProducts,
    byStatus,
  };
}
