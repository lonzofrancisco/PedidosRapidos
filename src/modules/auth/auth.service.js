import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../../config/db.js';
import { env } from '../../config/env.js';
import { unauthorized, badRequest, notFound } from '../../utils/httpError.js';
import { sendPasswordResetEmailWithToken } from '../../utils/email.js';

const BCRYPT_ROUNDS = 9;

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

/**
 * Solicita un link de recuperación de contraseña.
 * Genera un token, lo hashea, y lo almacena en la BD por 30 minutos.
 * Envia email con el link (no-op si SMTP no está configurado).
 * Por seguridad, retorna mensaje genérico incluso si el email no existe.
 */
export async function requestPasswordReset(email, tenantSlug, req) {
  const { rows: [tenant] } = await query(
    `SELECT id FROM tenants WHERE slug = $1 AND active = TRUE`,
    [tenantSlug]
  );
  if (!tenant) throw badRequest('Tenant no encontrado');

  const { rows: [user] } = await query(
    `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
    [tenant.id, email]
  );
  if (!user) {
    // Security: don't reveal if email exists
    console.log(`[auth] password reset requested for non-existent email: ${email} in tenant ${tenantSlug}`);
    return { message: 'Si el email existe, recibirás un link para recuperar tu contraseña' };
  }

  // Generate: 32 random bytes as hex string (64 chars)
  const tokenPlain = crypto.randomBytes(32).toString('hex');
  const tokenHash = await bcrypt.hash(tokenPlain, BCRYPT_ROUNDS);

  const expiresAt = new Date(Date.now() + env.passwordResetTokenExpiry * 60000).toISOString();

  await query(
    `UPDATE users SET password_reset_token = $1, password_reset_token_expires_at = $2
     WHERE id = $3`,
    [tokenHash, expiresAt, user.id]
  );

  // Build reset link with token and tenant slug
  const baseUrl = env.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
  const resetLink = `${baseUrl}/admin/reset-password/${tokenPlain}?t=${tenantSlug}`;

  try {
    await sendPasswordResetEmailWithToken({
      to: email,
      resetLink,
      expiresInMinutes: env.passwordResetTokenExpiry,
    });
  } catch (err) {
    console.error(`[auth] failed to send reset email to ${email}:`, err.message);
  }

  return { message: 'Si el email existe, recibirás un link para recuperar tu contraseña' };
}

/**
 * Verifica que un token de reset sea válido y no haya expirado.
 * Retorna el email del usuario para confirmación.
 */
export async function verifyResetToken(tokenPlain, tenantSlug) {
  const { rows: [tenant] } = await query(
    `SELECT id FROM tenants WHERE slug = $1 AND active = TRUE`,
    [tenantSlug]
  );
  if (!tenant) throw badRequest('Tenant no encontrado');

  // Find user with valid (non-expired) reset token
  const { rows: [user] } = await query(
    `SELECT id, email, password_reset_token FROM users
     WHERE tenant_id = $1
     AND password_reset_token IS NOT NULL
     AND password_reset_token_expires_at > now()`,
    [tenant.id]
  );
  if (!user) throw unauthorized('Link de recuperación inválido o expirado');

  // Verify token hash
  const tokenMatch = await bcrypt.compare(tokenPlain, user.password_reset_token);
  if (!tokenMatch) throw unauthorized('Link de recuperación inválido');

  return { email: user.email, tokenValid: true };
}

/**
 * Completa el reset de contraseña: valida token y actualiza la contraseña.
 * Limpia el token después de usarlo (one-time use).
 */
export async function resetPasswordWithToken(tokenPlain, tenantSlug, newPassword) {
  if (!newPassword || newPassword.length < 8) {
    throw badRequest('La contraseña debe tener al menos 8 caracteres');
  }

  const { rows: [tenant] } = await query(
    `SELECT id FROM tenants WHERE slug = $1 AND active = TRUE`,
    [tenantSlug]
  );
  if (!tenant) throw badRequest('Tenant no encontrado');

  // Find user with valid reset token
  const { rows: [user] } = await query(
    `SELECT id, email, password_reset_token FROM users
     WHERE tenant_id = $1
     AND password_reset_token IS NOT NULL
     AND password_reset_token_expires_at > now()`,
    [tenant.id]
  );
  if (!user) throw unauthorized('Link de recuperación inválido o expirado');

  // Verify token one more time
  const tokenMatch = await bcrypt.compare(tokenPlain, user.password_reset_token);
  if (!tokenMatch) throw unauthorized('Link de recuperación inválido');

  // Hash new password and update
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await query(
    `UPDATE users
     SET password_hash = $1,
         password_reset_token = NULL,
         password_reset_token_expires_at = NULL
     WHERE id = $2`,
    [passwordHash, user.id]
  );

  console.log(`[auth] password reset completed for user ${user.email}`);

  return { message: 'Contraseña actualizada. Por favor, inicia sesión con tu nueva contraseña.' };
}
