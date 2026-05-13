import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes.js';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

function corsOptions() {
  if (!env.corsOrigin) return undefined; // dev: allow-all
  const allowed = env.corsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
  return {
    origin: (origin, cb) => {
      // Permitir requests sin Origin (curl, server-to-server, mismo origen).
      if (!origin) return cb(null, true);
      cb(null, allowed.includes(origin));
    },
  };
}

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detras de nginx/Caddy: leer X-Forwarded-Proto/Host para que req.protocol
  // y req.get('host') reflejen el origen real con el que entro el cliente.
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan('tiny'));

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
