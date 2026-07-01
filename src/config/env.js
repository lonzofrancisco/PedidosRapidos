import 'dotenv/config';

const required = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

const PLACEHOLDER_SECRETS = new Set(['change-me-in-prod', 'changeme', 'secret']);

const DEFAULT_SUPERADMIN_PASSWORD = 'superadmin123';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET', 'change-me-in-prod'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '12h',
  // URL publica del frontend (sin trailing slash). Si esta seteada, se usa
  // para armar el link al detalle del pedido en el mensaje de WhatsApp.
  // Si no, se deriva del Host del request entrante.
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? '',
  // Origenes permitidos para CORS, separados por coma. Vacio = allow-all
  // (solo en dev). En produccion la prod docker-compose lo setea al dominio.
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  // ---- Super admin (dueno del sistema, no es un tenant) ----------------
  // Credenciales unicas para entrar a /superAdmin. Login con email+password,
  // emite un JWT con scope 'superadmin'. Cambiar SIEMPRE en produccion.
  superadminEmail: process.env.SUPERADMIN_EMAIL ?? 'owner@pedidos.local',
  superadminPassword: process.env.SUPERADMIN_PASSWORD ?? DEFAULT_SUPERADMIN_PASSWORD,
  // Tiempo de vida del token de superadmin (mas corto que el de tenant).
  superadminJwtExpiresIn: process.env.SUPERADMIN_JWT_EXPIRES_IN ?? '8h',
  // ---- SMTP / email transaccional (OPCIONAL) ---------------------------
  // Si SMTP_HOST/SMTP_USER no estan seteadas, los emails se omiten (no rompe
  // nada). Sirve cualquier proveedor SMTP (Brevo, Gmail, Mailgun, ...).
  appName: process.env.APP_NAME ?? 'Pedidos Rapidos',
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpSecure: (process.env.SMTP_SECURE ?? 'false') === 'true',
  emailFrom: process.env.EMAIL_FROM ?? 'Pedidos Rapidos <no-reply@pedidos.local>',
  // ---- Mercado Pago / cobro de la suscripcion (OPCIONAL) ---------------
  // Sin MP_ACCESS_TOKEN + MP_PLAN_PRICE el cobro online queda deshabilitado:
  // el endpoint de renovar devuelve un error claro y el webhook no hace nada.
  mpAccessToken: process.env.MP_ACCESS_TOKEN ?? '',
  mpPlanPrice: Number(process.env.MP_PLAN_PRICE ?? 0),
  mpPlanDays: Number(process.env.MP_PLAN_DAYS ?? 30),
  mpPlanCurrency: process.env.MP_PLAN_CURRENCY ?? 'ARS',
  // ---- Password Reset (recuperacion de contraseña) ----------------------
  // Tiempo de vida de los links de recuperacion de contraseña (en minutos).
  passwordResetTokenExpiry: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY ?? 30),
  // ---- Logging Centralizado (Loki) - OPCIONAL ----------------------------
  // Si LOKI_HOST no está seteado, los logs solo van a consola.
  lokiHost: process.env.LOKI_HOST ?? 'http://loki:3100',
  lokiUser: process.env.LOKI_USER ?? '',
  lokiPass: process.env.LOKI_PASS ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

// Fail-fast si en produccion arrancamos con el secret placeholder.
if (env.nodeEnv === 'production' && PLACEHOLDER_SECRETS.has(env.jwtSecret)) {
  throw new Error(
    'JWT_SECRET tiene el valor por defecto. Generá uno con `openssl rand -hex 32` antes de levantar en producción.'
  );
}

// Fail-fast si en produccion el superadmin quedo con la password por defecto.
if (env.nodeEnv === 'production' && env.superadminPassword === DEFAULT_SUPERADMIN_PASSWORD) {
  throw new Error(
    'SUPERADMIN_PASSWORD tiene el valor por defecto. Definí SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD antes de levantar en producción.'
  );
}
