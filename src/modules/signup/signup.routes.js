import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './signup.service.js';

// Maximo 5 signups por hora por IP. Suficiente para uso real y bloquea
// scripts de creacion masiva de tenants.
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiadas creaciones de tienda desde esta IP. Esperá un rato.' },
});

// slug-friendly: 3-40 chars, lowercase alfanumerico y guiones, sin guion
// al principio ni al final.
const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const signupSchema = z.object({
  tenant_name: z.string().min(1).max(120),
  slug: z.string().min(3).max(40).regex(slugRegex, {
    message: 'Solo minusculas, numeros y guiones. No empieza ni termina con guion.',
  }),
  whatsapp_number: z.string().min(6).max(30),
  admin_email: z.string().email(),
  admin_password: z.string().min(8).max(100),
});

export const signupRouter = Router();

signupRouter.post(
  '/',
  signupLimiter,
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.signup(req.body);
    res.status(201).json(result);
  })
);
