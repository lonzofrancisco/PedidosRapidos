import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

/**
 * Verifica el JWT del admin, carga req.user y req.tenantId.
 * Header esperado: Authorization: Bearer <token>
 */
export function requireAuth(req, res, next) {
  try {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());

    const payload = jwt.verify(token, env.jwtSecret);
    req.user = {
      id: payload.sub,
      tenantId: payload.tenant_id,
      email: payload.email,
      role: payload.role,
    };
    req.tenantId = payload.tenant_id;
    next();
  } catch {
    next(unauthorized('Token invalido o expirado'));
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) return next(forbidden());
    next();
  };
}
