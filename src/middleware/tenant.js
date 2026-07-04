import { query } from '../config/db.js';
import { notFound, forbidden } from '../utils/httpError.js';
import { computePlanInfo } from '../utils/plan.js';
import { tenantCache, planCache } from '../utils/cache.js';

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

    const cacheKey = `tenant:${slug}`;
    let tenant = tenantCache.get(cacheKey);

    if (!tenant) {
      const { rows } = await query(
        `SELECT id, slug, name, whatsapp_number, currency, image_url, background_url, active,
                plan_status, trial_ends_at, paid_until, is_open, shipping_cost, min_order_amount, opening_hours
           FROM tenants
          WHERE slug = $1`,
        [slug]
      );
      tenant = rows[0];
      if (tenant) {
        tenantCache.set(cacheKey, tenant);
      }
    }

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
 * Invalidate caches when tenant is updated
 */
export function invalidateTenantCache(tenantIdOrSlug) {
  // If it's a UUID-like string, assume it's tenant ID
  if (tenantIdOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) {
    planCache.delete(`plan:${tenantIdOrSlug}`);
  } else {
    // Otherwise assume it's slug
    tenantCache.delete(`tenant:${tenantIdOrSlug}`);
  }
}

/**
 * Invalidate all tenant caches (use after bulk updates)
 */
export function invalidateAllTenantCaches() {
  tenantCache.invalidate(/^tenant:/);
  planCache.invalidate(/^plan:/);
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
    const cacheKey = `plan:${req.tenantId}`;
    let planData = planCache.get(cacheKey);

    if (!planData) {
      const { rows } = await query(
        `SELECT plan_status, trial_ends_at, paid_until, active
           FROM tenants
          WHERE id = $1`,
        [req.tenantId]
      );
      planData = rows[0];
      if (planData) {
        planCache.set(cacheKey, planData);
      }
    }

    if (!planData || !planData.active) return next(notFound('Tenant no encontrado'));

    const plan = computePlanInfo(planData);
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

/**
 * Invalidate caches when tenant is updated
 */
export function invalidateTenantCache(tenantIdOrSlug) {
  // If it's a UUID-like string, assume it's tenant ID
  if (tenantIdOrSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}/i)) {
    planCache.delete(`plan:${tenantIdOrSlug}`);
  } else {
    // Otherwise assume it's slug
    tenantCache.delete(`tenant:${tenantIdOrSlug}`);
  }
}

/**
 * Invalidate all tenant caches (use after bulk updates)
 */
export function invalidateAllTenantCaches() {
  tenantCache.invalidate(/^tenant:/);
  planCache.invalidate(/^plan:/);
}
