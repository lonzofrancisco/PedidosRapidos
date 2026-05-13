import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Detras de nginx: leer X-Forwarded-Proto/Host para que req.protocol y
  // req.get('host') reflejen el origen real con el que entro el cliente.
  app.set('trust proxy', true);
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '256kb' }));
  app.use(morgan('tiny'));

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
