import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './signup.service.js';

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
  validate({ body: signupSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.signup(req.body);
    res.status(201).json(result);
  })
);
