import { query } from '../config/db.js';
import { notFound } from '../utils/httpError.js';

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
      `SELECT id, slug, name, whatsapp_number, currency, active
         FROM tenants
        WHERE slug = $1`,
      [slug]
    );
    const tenant = rows[0];
    if (!tenant || !tenant.active) return next(notFound('Tenant no encontrado'));

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
