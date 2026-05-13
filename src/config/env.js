import 'dotenv/config';

const required = (key, fallback) => {
  const v = process.env[key] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
};

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
};
