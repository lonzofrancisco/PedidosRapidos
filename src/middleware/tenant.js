import { query } from '../config/db.js';
import { notFound, forbidden } from '../utils/httpError.js';
import { computePlanInfo } from '../utils/plan.js';

/**
 * Resuelve el tenant a partir de:
 *   1) req.params.tenantSlug   (rutas publicas /api/v1/t/:tenantSlug/...)
 *   2) header X-Tenant-Slug    (alternativa)
 *
 * Carga el tenant en req.tenant y un atajo en req.tenantId.
 * Si el tenant no existe o esta inactivo -> 404.
 */
export async function resolveTenantBySlug(req, res, next) {
  try {
    const slug = req.params.tenantSlug || req.get('X-Tenant-Slug');
    if (!slug) return next(notFound('Tenant slug requerido'));

    const { rows } = await query(
      `SELECT id, slug, name, whatsapp_number, currency, image_url, background_url, active,
              plan_status, trial_ends_at, paid_until, is_open, shipping_cost, min_order_amount, opening_hours
         FROM tenants
        WHERE slug = $1`,
      [slug]
    );
    const tenant = rows[0];
    if (!tenant || !tenant.active) return next(notFound('Tenant no encontrado'));

    // Si el plan expiro, la tienda publica deja de responder.
    const plan = computePlanInfo(tenant);
    if (plan.isExpired) {
      return next(forbidden('Esta tienda esta temporalmente inactiva.'));
    }

    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Para rutas admin: el tenant ya viene resuelto desde el JWT (auth middleware).
 * Este middleware solo valida que req.tenantId exista.
 */
export function requireTenantContext(req, res, next) {
  if (!req.tenantId) return next(notFound('Tenant context missing'));
  next();
}

/**
 * Bloquea endpoints admin de escritura/listado cuando el plan del tenant
 * vencio (trial o pago). Aplicar DESPUES de requireAuth + requireTenantContext.
 * Excepcion intencional: GET /admin/tenant debe seguir respondiendo para que
 * el frontend pueda mostrar el banner "plan vencido".
 */
export async function requirePlanActive(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT plan_status, trial_ends_at, paid_until, active
         FROM tenants
        WHERE id = $1`,
      [req.tenantId]
    );
    const tenant = rows[0];
    if (!tenant || !tenant.active) return next(notFound('Tenant no encontrado'));

    const plan = computePlanInfo(tenant);
    if (plan.isExpired) {
      const err = forbidden('Tu plan vencio. Renovalo para seguir usando el panel.');
      err.details = { code: 'plan_expired', plan };
      return next(err);
    }

    req.plan = plan;
    next();
  } catch (err) {
    next(err);
  }
}
