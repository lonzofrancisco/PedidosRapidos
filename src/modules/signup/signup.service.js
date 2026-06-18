import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { badRequest, conflict } from '../../utils/httpError.js';
import { sendWelcomeEmail } from '../../utils/email.js';

const TRIAL_DAYS = 15;

/**
 * Crea un tenant nuevo + su primer admin en una sola transaccion.
 * El tenant arranca en plan 'trial' con 15 dias hasta trial_ends_at.
 * Devuelve un JWT listo para que el usuario quede logueado.
 */
export async function signup(payload) {
  const slug = payload.slug.trim().toLowerCase();

  const result = await withTransaction(async (client) => {
    // Check de slug unico (la unique constraint igual lo enforza,
    // pero asi devolvemos 409 con mensaje claro en vez de un 500).
    const existing = await client.query(
      `SELECT 1 FROM tenants WHERE slug = $1`,
      [slug]
    );
    if (existing.rowCount > 0) {
      throw conflict('Ese slug ya esta en uso. Probá con otro.');
    }

    const trialExpr = `now() + INTERVAL '${TRIAL_DAYS} days'`;
    const { rows: [tenant] } = await client.query(
      `INSERT INTO tenants
         (slug, name, whatsapp_number, plan_status, trial_ends_at)
       VALUES ($1, $2, $3, 'trial', ${trialExpr})
       RETURNING id, slug, name, whatsapp_number, currency, image_url,
                 plan_status, trial_ends_at, paid_until, active, created_at`,
      [slug, payload.tenant_name.trim(), payload.whatsapp_number.trim()]
    );

    const passwordHash = await bcrypt.hash(payload.admin_password, 10);

    const { rows: [user] } = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')
       RETURNING id, email, role`,
      [tenant.id, payload.admin_email.trim().toLowerCase(), passwordHash]
    );

    const token = jwt.sign(
      {
        sub: user.id,
        tenant_id: tenant.id,
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
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      },
      tenant,
    };
  }).catch((err) => {
    // 23505 = unique_violation. Puede pegar contra users (email) tambien.
    if (err.code === '23505') {
      if (err.constraint?.includes('users')) {
        throw conflict('Ya existe un admin con ese email para este tenant.');
      }
      throw conflict('Ese slug ya esta en uso. Probá con otro.');
    }
    if (err.code === '23514') {
      throw badRequest('Datos invalidos.');
    }
    throw err;
  });

  // Bienvenida best-effort (no bloquea el alta si falla o no hay SMTP).
  sendWelcomeEmail({ to: result.user.email, tenantName: result.tenant.name, slug: result.tenant.slug });

  return result;
}
