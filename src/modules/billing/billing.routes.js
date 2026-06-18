import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireTenantContext } from '../../middleware/tenant.js';
import { env } from '../../config/env.js';
import * as service from './billing.service.js';

// URL publica con la que se arman back_urls y notification_url. Si hay
// PUBLIC_BASE_URL la usamos; sino la derivamos del request (trust proxy).
function resolvePublicBaseUrl(req) {
  if (env.publicBaseUrl) return env.publicBaseUrl;
  return `${req.protocol}://${req.get('host')}`;
}

// ---------- Webhook publico (lo llama Mercado Pago) -------------------
// Montado en: /api/v1/billing
export const publicBillingRouter = Router();

// MP puede pegar GET (verificacion) o POST (notificacion). Respondemos 200
// salvo error inesperado, asi MP no reintenta de gusto. La idempotencia la
// garantiza billing_payments.mp_payment_id.
publicBillingRouter.post('/webhook', asyncHandler(async (req, res) => {
  await service.handleWebhook({ query: req.query, body: req.body });
  res.sendStatus(200);
}));
publicBillingRouter.get('/webhook', (req, res) => res.sendStatus(200));

// ---------- Admin: link de pago para renovar --------------------------
// Montado en: /api/v1/admin/billing
// OJO: sin requirePlanActive a proposito, porque se usa cuando el plan vencio.
export const adminBillingRouter = Router();
adminBillingRouter.use(requireAuth, requireRole('admin'), requireTenantContext);

adminBillingRouter.post('/renew', asyncHandler(async (req, res) => {
  const baseUrl = resolvePublicBaseUrl(req);
  const result = await service.createRenewalPreference(req.tenantId, baseUrl);
  res.json(result);
}));

// Para que el frontend sepa si mostrar el boton de pago y a que precio.
adminBillingRouter.get('/config', (req, res) => {
  res.json({
    enabled: service.isConfigured(),
    price: env.mpPlanPrice,
    currency: env.mpPlanCurrency,
    days: env.mpPlanDays,
  });
});
