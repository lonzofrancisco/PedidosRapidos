import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';
import { unauthorized, notFound, badRequest, conflict } from '../../utils/httpError.js';
import { computePlanInfo } from '../../utils/plan.js';
import { sendPasswordResetEmail } from '../../utils/email.js';

const DAY_MS = 86_400_000;

/**
 * Comparacion de strings en tiempo constante (evita timing attacks en el login
 * del dueno del sistema). Devuelve false si difieren en longitud.
 * Exportada para tests.
 */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * Genera una contrasena temporal legible (sin caracteres ambiguos 0/O/1/l/I).
 * Exportada para tests.
 */
export function genTempPassword(len = 10) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/**
 * Calcula el nuevo paid_until al extender N dias. Si el plan todavia no vencio,
 * extiende desde el vencimiento actual (no se pierden dias); si ya vencio (o no
 * tenia), cuenta desde ahora. Funcion pura -> testeable sin DB.
 */
export function computeExtendedPaidUntil(currentPaidUntil, days, now = new Date()) {
  const current = currentPaidUntil ? new Date(currentPaidUntil) : null;
  const base = current && current > now ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/**
 * Login del dueno del sistema. No usa la tabla users: valida contra las
 * credenciales del entorno (env.superadminEmail / env.superadminPassword).
 */
export function login({ email, password }) {
  const emailOk = safeEqual(email.trim().toLowerCase(), env.superadminEmail.trim().toLowerCase());
  const passOk = safeEqual(password, env.superadminPassword);
  if (!emailOk || !passOk) throw unauthorized('Credenciales invalidas');

  const token = jwt.sign(
    { sub: env.superadminEmail, scope: 'superadmin' },
    env.jwtSecret,
    { expiresIn: env.superadminJwtExpiresIn }
  );
  return { token, email: env.superadminEmail };
}

// Campos del tenant. _T = con alias para SELECTs con JOIN/subqueries.
const TENANT_FIELDS =
  'id, slug, name, whatsapp_number, currency, image_url, active, plan_status, trial_ends_at, paid_until, created_at';
const TENANT_COLUMNS_T = TENANT_FIELDS.split(', ').map((c) => `t.${c}`).join(', ');

/** Devuelve un tenant + su info de plan computada. */
function decorate(row) {
  return { ...row, plan: computePlanInfo(row) };
}

// ---------- Auditoria --------------------------------------------------
/**
 * Registra una accion del superadmin. Best-effort: si el INSERT falla, NO
 * rompe la accion principal (solo loguea a stderr).
 */
export async function logAction(actor, action, { tenantId = null, tenantSlug = null, detail = null } = {}) {
  try {
    await query(
      `INSERT INTO superadmin_audit_log (action, tenant_id, tenant_slug, actor, detail)
       VALUES ($1, $2, $3, $4, $5)`,
      [action, tenantId, tenantSlug, actor, detail ? JSON.stringify(detail) : null]
    );
  } catch (err) {
    console.error('[audit] no se pudo registrar', action, err.message);
  }
}

export async function listAudit(limit = 100) {
  const n = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const { rows } = await query(
    `SELECT id, action, tenant_id, tenant_slug, actor, detail, created_at
       FROM superadmin_audit_log
      ORDER BY created_at DESC
      LIMIT $1`,
    [n]
  );
  return { entries: rows };
}

// ---------- Lectura ----------------------------------------------------
/**
 * Lista todos los tenants (clientes del sistema) con su plan calculado,
 * conteos de productos/pedidos y estadisticas agregadas para el dashboard.
 */
export async function listTenants({ limit = 50, offset = 0 } = {}) {
  // Use window functions and aggregates instead of subqueries
  const { rows } = await query(
    `SELECT ${TENANT_COLUMNS_T},
            COUNT(DISTINCT p.id) OVER (PARTITION BY t.id)::int AS products_count,
            COUNT(DISTINCT o.id) OVER (PARTITION BY t.id)::int AS orders_count,
            MAX(o.created_at) OVER (PARTITION BY t.id) AS last_order_at
       FROM tenants t
       LEFT JOIN products p ON p.tenant_id = t.id
       LEFT JOIN orders o ON o.tenant_id = t.id
      ORDER BY t.created_at DESC
      LIMIT $1 OFFSET $2`,
    [limit, offset]
  );

  // Get total count for pagination
  const { rows: [{ total }] } = await query(
    `SELECT COUNT(*)::int AS total FROM tenants`
  );

  const tenants = rows.map(decorate);

  // Categorias mutuamente excluyentes (suman al total): pago / prueba /
  // vencido / de baja.
  const stats = {
    total,
    active: tenants.filter((t) => t.active && t.plan.status === 'active').length,
    trial: tenants.filter((t) => t.active && t.plan.status === 'trial').length,
    expired: tenants.filter((t) => t.active && t.plan.isExpired).length,
    suspended: tenants.filter((t) => !t.active).length,
  };

  return { tenants, stats, pagination: { limit, offset, total } };
}

async function getTenantRow(tenantId) {
  const { rows } = await query(
    `SELECT ${TENANT_COLUMNS_T} FROM tenants t WHERE t.id = $1`,
    [tenantId]
  );
  if (rows.length === 0) throw notFound('Tenant no encontrado');
  return rows[0];
}

// ---------- Mutaciones de plan ----------------------------------------
async function applyPlanPatch(tenantId, patch) {
  const allowed = ['plan_status', 'trial_ends_at', 'paid_until'];
  const fields = [];
  const values = [];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      values.push(patch[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return decorate(await getTenantRow(tenantId));

  values.push(tenantId);
  const { rowCount } = await query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${values.length}`,
    values
  );
  if (rowCount === 0) throw notFound('Tenant no encontrado');
  return decorate(await getTenantRow(tenantId));
}

/**
 * Actualiza el plan de un tenant a mano (el dueno controla los vencimientos).
 * Campos permitidos: plan_status, trial_ends_at, paid_until.
 */
export async function updateTenantPlan(tenantId, patch, actor) {
  const tenant = await applyPlanPatch(tenantId, patch);
  await logAction(actor, 'update_plan', { tenantId, tenantSlug: tenant.slug, detail: patch });
  return tenant;
}

/**
 * Atajo para renovar/extender el plan N dias. Marca el plan como 'active' y
 * extiende paid_until con computeExtendedPaidUntil.
 */
export async function extendPlan(tenantId, days, actor) {
  const n = Number(days);
  if (!Number.isInteger(n) || n <= 0 || n > 3650) {
    throw badRequest('days debe ser un entero entre 1 y 3650');
  }
  const row = await getTenantRow(tenantId);
  const newPaidUntil = computeExtendedPaidUntil(row.paid_until, n);
  const tenant = await applyPlanPatch(tenantId, {
    plan_status: 'active',
    paid_until: newPaidUntil.toISOString(),
  });
  await logAction(actor, 'extend', {
    tenantId, tenantSlug: tenant.slug, detail: { days: n, paid_until: newPaidUntil.toISOString() },
  });
  return tenant;
}

/** Da de baja (active=false) o reactiva (active=true) un tenant. */
export async function setActive(tenantId, active, actor) {
  const { rowCount } = await query(
    `UPDATE tenants SET active = $1 WHERE id = $2`,
    [Boolean(active), tenantId]
  );
  if (rowCount === 0) throw notFound('Tenant no encontrado');
  const tenant = decorate(await getTenantRow(tenantId));
  await logAction(actor, 'set_active', {
    tenantId, tenantSlug: tenant.slug, detail: { active: Boolean(active) },
  });
  return tenant;
}

// ---------- Alta / baja de clientes -----------------------------------
/**
 * Crea un tenant + su admin a mano (sin pasar por el signup publico).
 * Reusa el patron de signup.service pero NO genera token de auto-login.
 * Si admin_password viene vacio, genera una temporal y la devuelve una vez.
 */
export async function createTenant(payload, actor) {
  const slug = payload.slug.trim().toLowerCase();
  const trialDays = Number.isInteger(payload.trial_days) && payload.trial_days >= 0
    ? payload.trial_days : 15;
  const provided = payload.admin_password?.trim();
  const rawPassword = provided || genTempPassword();

  const tenant = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT 1 FROM tenants WHERE slug = $1`, [slug]);
    if (existing.rowCount > 0) throw conflict('Ese slug ya esta en uso. Proba con otro.');

    const trialEndsAt = new Date(Date.now() + trialDays * DAY_MS).toISOString();
    const { rows: [row] } = await client.query(
      `INSERT INTO tenants (slug, name, whatsapp_number, plan_status, trial_ends_at)
       VALUES ($1, $2, $3, 'trial', $4)
       RETURNING ${TENANT_FIELDS}`,
      [slug, payload.tenant_name.trim(), payload.whatsapp_number.trim(), trialEndsAt]
    );

    const passwordHash = await bcrypt.hash(rawPassword, 9);
    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, role)
       VALUES ($1, $2, $3, 'admin')`,
      [row.id, payload.admin_email.trim().toLowerCase(), passwordHash]
    );
    return row;
  }).catch((err) => {
    if (err.code === '23505') {
      if (err.constraint?.includes('users')) throw conflict('Ya existe un admin con ese email.');
      throw conflict('Ese slug ya esta en uso. Proba con otro.');
    }
    if (err.code === '23514') throw badRequest('Datos invalidos.');
    throw err;
  });

  await logAction(actor, 'create_tenant', {
    tenantId: tenant.id, tenantSlug: tenant.slug,
    detail: { name: tenant.name, admin_email: payload.admin_email.trim().toLowerCase(), trial_days: trialDays },
  });

  return { tenant: decorate(tenant), tempPassword: provided ? null : rawPassword };
}

/** Elimina un tenant y TODO su contenido (FKs ON DELETE CASCADE). */
export async function deleteTenant(tenantId, actor) {
  const row = await getTenantRow(tenantId); // 404 si no existe
  await query(`DELETE FROM tenants WHERE id = $1`, [tenantId]);
  await logAction(actor, 'delete_tenant', {
    tenantId, tenantSlug: row.slug, detail: { name: row.name },
  });
  return { id: row.id, slug: row.slug, name: row.name };
}

/**
 * Resetea la contrasena del admin principal del tenant. Si no se pasa una,
 * genera una temporal y la devuelve en claro (una sola vez).
 */
export async function resetAdminPassword(tenantId, newPassword, actor) {
  const { rows } = await query(
    `SELECT u.id, u.email, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.tenant_id = $1
      ORDER BY (u.role = 'admin') DESC, u.created_at ASC
      LIMIT 1`,
    [tenantId]
  );
  const user = rows[0];
  if (!user) throw notFound('El tenant no tiene usuarios');

  const password = (newPassword && newPassword.trim()) || genTempPassword();
  const hash = await bcrypt.hash(password, 9);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, user.id]);

  await logAction(actor, 'reset_password', {
    tenantId, tenantSlug: user.tenant_slug, detail: { email: user.email },
  });

  // Avisar al admin por email (best-effort; si no hay SMTP configurado, se omite).
  await sendPasswordResetEmail({ to: user.email, password, tenantSlug: user.tenant_slug });

  return { email: user.email, password };
}

// ---------- Impersonar -------------------------------------------------
/**
 * Genera un token de admin para entrar al panel de un tenant ("impersonar").
 * Reusa el mismo formato de JWT que auth.service.login, tomando el primer
 * usuario admin del tenant.
 */
export async function impersonate(tenantId) {
  const { rows } = await query(
    `SELECT u.id, u.tenant_id, u.email, u.role, t.slug AS tenant_slug, t.name AS tenant_name
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
      WHERE u.tenant_id = $1
      ORDER BY (u.role = 'admin') DESC, u.created_at ASC
      LIMIT 1`,
    [tenantId]
  );
  const user = rows[0];
  if (!user) throw notFound('El tenant no tiene usuarios para impersonar');

  const token = jwt.sign(
    { sub: user.id, tenant_id: user.tenant_id, email: user.email, role: user.role },
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
