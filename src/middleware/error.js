import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
}

export function errorHandler(err, req, res, _next) { // eslint-disable-line no-unused-vars
  const errorContext = {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    tenantId: req.tenantId,
    userId: req.user?.id,
    statusCode: 500,
  };

  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Log de error 500 con contexto completo
  logger.error({ ...errorContext, stack: err.stack }, `[500] ${err.message}`);

  res.status(500).json({ error: 'Internal server error' });
}
