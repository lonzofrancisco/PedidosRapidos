import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// Transport perezoso: solo se crea si hay SMTP configurado. Si no, todos los
// envios son no-op (devuelven false) y el flujo que los dispara sigue normal.
let transport = null;
let warned = false;

function getTransport() {
  if (!env.smtpHost || !env.smtpUser) {
    if (!warned) {
      console.warn('[email] SMTP sin configurar (SMTP_HOST/SMTP_USER): los emails se omiten');
      warned = true;
    }
    return null;
  }
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpSecure, // true: 465 (SSL) · false: 587/25 (STARTTLS)
      auth: { user: env.smtpUser, pass: env.smtpPass },
    });
  }
  return transport;
}

/**
 * Envia un email. Best-effort: si SMTP no esta configurado o el envio falla,
 * loguea y devuelve false SIN lanzar, para no romper la accion que lo dispara.
 */
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: env.emailFrom, to, subject, html, text: text ?? stripHtml(html) });
    return true;
  } catch (err) {
    console.error('[email] fallo el envio a', to, '-', err.message);
    return false;
  }
}

// ---------- Plantillas -------------------------------------------------
function layout(title, bodyHtml) {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <h2 style="color:#0f172a">${title}</h2>
    ${bodyHtml}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="font-size:12px;color:#64748b">${env.appName}</p>
  </div>`;
}

/** Avisa al admin de un tenant su nueva contrasena (reset hecho por el dueno). */
export function sendPasswordResetEmail({ to, password, tenantSlug }) {
  const loginUrl = env.publicBaseUrl ? `${env.publicBaseUrl}/admin/login` : null;
  return sendEmail({
    to,
    subject: `${env.appName} · Tu nueva contraseña`,
    html: layout('Restablecimos tu contraseña', `
      <p>Se generó una nueva contraseña para tu panel:</p>
      <p style="font-size:18px;font-weight:700;background:#f1f5f9;padding:10px 14px;border-radius:8px;display:inline-block">${password}</p>
      <p>Ingresá con la tienda <b>${tenantSlug}</b> y este email.${loginUrl ? ` <a href="${loginUrl}">Abrir el panel</a>.` : ''}</p>
      <p>Por seguridad, cambiala después de entrar.</p>
    `),
  });
}

/** Avisa que la prueba gratis esta por vencer. */
export function sendTrialReminderEmail({ to, tenantName, daysLeft, expiresAt }) {
  const fecha = expiresAt ? new Date(expiresAt).toLocaleDateString('es-AR') : '';
  const cuando = daysLeft <= 0 ? 'hoy' : daysLeft === 1 ? 'mañana' : `en ${daysLeft} días`;
  return sendEmail({
    to,
    subject: `${env.appName} · Tu prueba gratis vence ${cuando}`,
    html: layout('Tu prueba está por terminar', `
      <p>Hola, la prueba gratis de <b>${tenantName}</b> vence ${cuando}${fecha ? ` (${fecha})` : ''}.</p>
      <p>Para que tu tienda siga online sin cortes, aboná el plan mensual desde
         <b>Tienda → Renovar plan</b> en tu panel.</p>
    `),
  });
}

/** Bienvenida al crear la cuenta. */
export function sendWelcomeEmail({ to, tenantName, slug }) {
  const storeUrl = env.publicBaseUrl ? `${env.publicBaseUrl}/t/${slug}` : `/t/${slug}`;
  return sendEmail({
    to,
    subject: `${env.appName} · Tu tienda ${tenantName} está lista`,
    html: layout('¡Bienvenido!', `
      <p>Creamos tu tienda <b>${tenantName}</b>. Tenés 15 días de prueba gratis.</p>
      <p>Tu link público para compartir con tus clientes:<br><a href="${storeUrl}">${storeUrl}</a></p>
      <p>Entrá al panel para cargar tus productos.</p>
    `),
  });
}

function stripHtml(html = '') {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
