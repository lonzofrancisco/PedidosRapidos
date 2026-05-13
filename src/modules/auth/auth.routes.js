import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as authService from './auth.service.js';

const router = Router();

// Maximo 10 intentos cada 15 minutos por IP. Frena brute force pero deja
// margen para que un admin que se equivoca pueda reintentar.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos.' },
});

const loginSchema = z.object({
  tenant_slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json(result);
  })
);

export default router;
