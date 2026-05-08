import { ZodError } from 'zod';
import { badRequest } from '../utils/httpError.js';

/**
 * Valida req.body / req.params / req.query con un schema de Zod.
 * Reemplaza la propiedad correspondiente con el valor parseado.
 *
 *   router.post('/x', validate({ body: schema }), handler)
 */
export const validate = (schemas) => (req, res, next) => {
  try {
    if (schemas.body)   req.body   = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query)  req.query  = schemas.query.parse(req.query);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return next(badRequest('Validation error', err.flatten()));
    }
    next(err);
  }
};
