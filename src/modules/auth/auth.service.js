import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db.js';
import { env } from '../../config/env.js';
import { unauthorized } from '../../utils/httpError.js';

/**
 * Login de admin: el email es unico por tenant, asi que pedimos
 * tenant_slug + email + password.
 */
export async function login({ tenant_slug, email, password }) {
  const { rows } = await query(
    `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.role, t.slug AS tenant_slug, t.name AS tenant_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE t.slug = $1 AND u.email = $2 AND t.active = TRUE
      LIMIT 1`,
    [tenant_slug, email]
  );

  const user = rows[0];
  if (!user) throw unauthorized('Credenciales invalidas');

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw unauthorized('Credenciales invalidas');

  const token = jwt.sign(
    {
      sub: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      role: user.role,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenant: { id: user.tenant_id, slug: user.tenant_slug, name: user.tenant_name },
    },
  };
}
