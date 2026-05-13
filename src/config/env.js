import 'dotenv/config';

const required = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

const PLACEHOLDER_SECRETS = new Set(['change-me-in-prod', 'changeme', 'secret']);

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
};

// Fail-fast si en produccion arrancamos con el secret placeholder.
if (env.nodeEnv === 'production' && PLACEHOLDER_SECRETS.has(env.jwtSecret)) {
  throw new Error(
    'JWT_SECRET tiene el valor por defecto. Generá uno con `openssl rand -hex 32` antes de levantar en producción.'
  );
}
