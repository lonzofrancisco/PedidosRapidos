import { query, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { HttpError, badRequest, notFound } from '../../utils/httpError.js';
import { computeExtendedPaidUntil } from '../superadmin/superadmin.service.js';

const MP_API = 'https://api.mercadopago.com';

/** Hay cobro online solo si MP esta configurado con token + un precio > 0. */
export const isConfigured = () => Boolean(env.mpAccessToken && env.mpPlanPrice > 0);

async function mpFetch(path, options = {}) {
  let res;
  try {
    res = await fetch(`${MP_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${env.mpAccessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (err) {
    throw new HttpError(502, `No se pudo contactar a Mercado Pago: ${err.message}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(502, data?.message || `Mercado Pago respondio ${res.status}`);
  }
  return data;
}

/**
 * Crea una preferencia de Checkout Pro para que el tenant pague un mes de plan.
 * Devuelve el link (init_point) al que redirigir. external_reference = tenant.id
 * para reconciliar en el webhook.
 */
export async function createRenewalPreference(tenantId, baseUrl) {
  if (!isConfigured()) {
    throw badRequest('El cobro online todavia no esta configurado. Escribinos para renovar tu plan.');
  }
  const { rows: [tenant] } = await query(`SELECT id, name FROM tenants WHERE id = $1`, [tenantId]);
  if (!tenant) throw notFound('Tenant no encontrado');

  const base = baseUrl.replace(/\/+$/, '');
  const pref = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify({
      items: [{
        title: `Plan mensual - ${tenant.name}`,
        quantity: 1,
        unit_price: env.mpPlanPrice,
        currency_id: env.mpPlanCurrency,
      }],
      external_reference: tenant.id,
      metadata: { tenant_id: tenant.id },
      back_urls: {
        success: `${base}/admin/settings?pago=ok`,
        pending: `${base}/admin/settings?pago=pendiente`,
        failure: `${base}/admin/settings?pago=error`,
      },
      auto_return: 'approved',
      notification_url: `${base}/api/v1/billing/webhook`,
    }),
  });

  return { url: pref.init_point ?? pref.sandbox_init_point, preferenceId: pref.id };
}

/**
 * Extrae el id de pago de una notificacion de MP, que puede llegar de varias
 * formas (IPN por query o webhook por body).
 */
function extractPaymentId({ query: q = {}, body = {} }) {
  if ((q.type === 'payment' || q.topic === 'payment') && (q['data.id'] || q.id)) {
    return String(q['data.id'] || q.id);
  }
  if (body.type === 'payment' && body.data?.id) return String(body.data.id);
  if (body.topic === 'payment' && body.resource) return String(body.resource).split('/').pop();
  return null;
}

/**
 * Procesa una notificacion de MP. Si el pago esta aprobado, extiende el plan del
 * tenant MP_PLAN_DAYS dias de forma idempotente (billing_payments.mp_payment_id
 * es UNIQUE). No lanza por notificaciones que no aplican: devuelve un estado.
 */
export async function handleWebhook(req) {
  if (!isConfigured()) return { ignored: 'mp_no_configurado' };

  const paymentId = extractPaymentId(req);
  if (!paymentId) return { ignored: 'sin_payment_id' };

  const payment = await mpFetch(`/v1/payments/${paymentId}`);
  if (payment.status !== 'approved') return { ignored: `status_${payment.status}` };

  const tenantId = payment.external_reference || payment.metadata?.tenant_id;
  if (!tenantId) return { ignored: 'sin_tenant' };

  return withTransaction(async (client) => {
    // Idempotencia: si ya registramos este pago, no volvemos a extender.
    const ins = await client.query(
      `INSERT INTO billing_payments (tenant_id, mp_payment_id, status, amount, currency, raw)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (mp_payment_id) DO NOTHING
       RETURNING id`,
      [tenantId, paymentId, payment.status, payment.transaction_amount ?? null,
        payment.currency_id ?? null, JSON.stringify(payment)]
    );
    if (ins.rowCount === 0) return { duplicate: true };

    const { rows: [t] } = await client.query(`SELECT paid_until FROM tenants WHERE id = $1`, [tenantId]);
    if (!t) throw notFound('Tenant del pago no existe');

    const newPaidUntil = computeExtendedPaidUntil(t.paid_until, env.mpPlanDays);
    await client.query(
      `UPDATE tenants SET plan_status = 'active', paid_until = $1 WHERE id = $2`,
      [newPaidUntil.toISOString(), tenantId]
    );
    console.log(`[billing] pago ${paymentId} aprobado -> tenant ${tenantId} activo hasta ${newPaidUntil.toISOString()}`);
    return { applied: true, tenantId, paidUntil: newPaidUntil.toISOString() };
  });
}
