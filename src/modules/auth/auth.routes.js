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

const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá 1 hora.' },
});

const loginSchema = z.object({
  tenant_slug: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
  tenant_slug: z.string().min(1, 'Slug requerido'),
});

const verifyResetTokenSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  tenant_slug: z.string().min(1, 'Slug requerido'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido'),
  tenant_slug: z.string().min(1, 'Slug requerido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
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

router.post(
  '/forgot-password',
  passwordResetLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.requestPasswordReset(
      req.body.email,
      req.body.tenant_slug,
      req
    );
    res.json(result);
  })
);

router.post(
  '/verify-reset-token',
  validate({ body: verifyResetTokenSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.verifyResetToken(
      req.body.token,
      req.body.tenant_slug
    );
    res.json(result);
  })
);

router.post(
  '/reset-password',
  passwordResetLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.resetPasswordWithToken(
      req.body.token,
      req.body.tenant_slug,
      req.body.password
    );
    res.json(result);
  })
);

export default router;
