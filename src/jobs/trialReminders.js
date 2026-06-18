import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { sendTrialReminderEmail } from '../utils/email.js';

const DAY_MS = 86_400_000;
const REMIND_WITHIN_DAYS = 3;   // avisar cuando faltan <= 3 dias
const DAY_INTERVAL_MS = 24 * 60 * 60 * 1000;

const emailConfigured = () => Boolean(env.smtpHost && env.smtpUser);

/**
 * Manda el aviso de fin de prueba a los tenants en trial que vencen dentro de
 * REMIND_WITHIN_DAYS dias, siguen activos y todavia no fueron avisados. Marca
 * trial_reminder_sent_at al enviar para no repetir.
 */
export async function runTrialReminders() {
  if (!emailConfigured()) return;

  const { rows } = await query(
    `SELECT t.id, t.name, t.trial_ends_at,
            (SELECT u.email FROM users u
              WHERE u.tenant_id = t.id
              ORDER BY (u.role = 'admin') DESC, u.created_at ASC
              LIMIT 1) AS admin_email
       FROM tenants t
      WHERE t.active = TRUE
        AND t.plan_status = 'trial'
        AND t.trial_ends_at IS NOT NULL
        AND t.trial_reminder_sent_at IS NULL
        AND t.trial_ends_at <= now() + make_interval(days => $1::int)`,
    [REMIND_WITHIN_DAYS]
  );

  for (const t of rows) {
    if (!t.admin_email) continue;
    const daysLeft = Math.max(0, Math.ceil((new Date(t.trial_ends_at) - Date.now()) / DAY_MS));
    const sent = await sendTrialReminderEmail({
      to: t.admin_email,
      tenantName: t.name,
      daysLeft,
      expiresAt: t.trial_ends_at,
    });
    if (sent) {
      await query(`UPDATE tenants SET trial_reminder_sent_at = now() WHERE id = $1`, [t.id]);
      console.log(`[trial-reminders] aviso enviado a ${t.admin_email} (${t.name})`);
    }
  }
}

/**
 * Programa el chequeo: una corrida ~30s despues de arrancar y luego cada 24h.
 * No-op si no hay SMTP configurado.
 */
export function startTrialReminderJob() {
  if (!emailConfigured()) {
    console.log('[trial-reminders] SMTP sin configurar: job desactivado');
    return null;
  }
  const tick = () => {
    runTrialReminders().catch((err) => console.error('[trial-reminders]', err.message));
  };
  setTimeout(tick, 30_000);
  const id = setInterval(tick, DAY_INTERVAL_MS);
  if (id.unref) id.unref(); // que el timer no impida que el proceso cierre
  console.log('[trial-reminders] job activo (cada 24h)');
  return id;
}
