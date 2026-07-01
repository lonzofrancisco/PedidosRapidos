import pino from 'pino';
import pinoLoki from 'pino-loki';
import { env } from '../config/env.js';

const isProduction = env.nodeEnv === 'production';
const lokiEnabled = Boolean(env.lokiHost);

// Configurar transporte a Loki si está disponible
let transport = null;
if (lokiEnabled) {
  transport = pino.transport({
    target: 'pino-loki',
    options: {
      host: env.lokiHost,
      basicAuth: env.lokiUser && env.lokiPass
        ? { username: env.lokiUser, password: env.lokiPass }
        : undefined,
      labels: { job: 'api', env: env.nodeEnv },
      batching: true,
      interval: 5,
    },
  });
}

// Logger que envía a consola y Loki (si está disponible)
export const logger = pino(
  {
    level: env.logLevel || (isProduction ? 'info' : 'debug'),
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport || pino.destination()
);

// Reemplazar console.log/error con logger
export function replaceConsole() {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.log = (...args) => {
    const msg = args[0] || '';
    logger.info({ raw: args }, msg);
  };

  console.error = (...args) => {
    const msg = args[0] || '';
    const err = args[1] instanceof Error ? args[1] : new Error(msg);
    logger.error({ raw: args, error: err }, msg);
  };

  console.warn = (...args) => {
    const msg = args[0] || '';
    logger.warn({ raw: args }, msg);
  };

  console.info = (...args) => {
    const msg = args[0] || '';
    logger.info({ raw: args }, msg);
  };
}

export default logger;
