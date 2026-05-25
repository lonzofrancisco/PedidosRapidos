import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

/**
 * Protege las rutas del dueno del sistema (/superadmin).
 *
 * El token se emite en superadmin.service.login() y lleva el claim
 * `scope: 'superadmin'`. Un JWT de admin de tenant NO tiene ese scope, asi
 * que aunque sea valido NO puede tocar estas rutas.
 */
export function requireSuperAdmin(req, res, next) {
  try {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) return next(unauthorized());

    const payload = jwt.verify(token, env.jwtSecret);
    if (payload.scope !== 'superadmin') return next(forbidden('Acceso solo para el dueno del sistema'));

    req.superadmin = { email: payload.sub };
    next();
  } catch {
    next(unauthorized('Token invalido o expirado'));
  }
}
