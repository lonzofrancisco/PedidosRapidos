import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireSuperAdmin } from '../../middleware/superadmin.js';
import * as service from './superadmin.service.js';

const router = Router();

// Login del dueno: limite agresivo (es una sola cuenta, no hay motivo para
// muchos intentos). 5 intentos cada 15 minutos por IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos.' },
});

const slugRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const idParam = z.object({ id: z.string().uuid() });

const planSchema = z.object({
  plan_status: z.enum(['trial', 'active', 'expired']).optional(),
  trial_ends_at: z.string().datetime().nullable().optional(),
  paid_until: z.string().datetime().nullable().optional(),
});

const extendSchema = z.object({ days: z.number().int().min(1).max(3650) });
const activeSchema = z.object({ active: z.boolean() });

const createTenantSchema = z.object({
  tenant_name: z.string().min(1).max(120),
  slug: z.string().min(1).max(40).regex(slugRegex, 'Slug invalido (minusculas, numeros y guiones)'),
  whatsapp_number: z.string().min(6).max(30),
  admin_email: z.string().email(),
  admin_password: z.string().min(8).max(100).optional(),
  trial_days: z.number().int().min(0).max(3650).optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).max(100).optional(),
});

// ---------- Login (publico, rate-limited) -----------------------------
router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    res.json(service.login(req.body));
  })
);

// ---------- A partir de aca, todo requiere token de superadmin --------
router.use(requireSuperAdmin);

// Lista de clientes + estadisticas
router.get(
  '/tenants',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    res.json(await service.listTenants({ limit, offset }));
  })
);

// Crear cliente a mano
router.post(
  '/tenants',
  validate({ body: createTenantSchema }),
  asyncHandler(async (req, res) => {
    res.status(201).json(await service.createTenant(req.body, req.superadmin.email));
  })
);

// Editar plan (vencimientos) manualmente
router.patch(
  '/tenants/:id/plan',
  validate({ params: idParam, body: planSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.updateTenantPlan(req.params.id, req.body, req.superadmin.email));
  })
);

// Atajo: extender N dias
router.post(
  '/tenants/:id/extend',
  validate({ params: idParam, body: extendSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.extendPlan(req.params.id, req.body.days, req.superadmin.email));
  })
);

// Dar de baja / reactivar
router.patch(
  '/tenants/:id/active',
  validate({ params: idParam, body: activeSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.setActive(req.params.id, req.body.active, req.superadmin.email));
  })
);

// Resetear contrasena del admin del tenant
router.post(
  '/tenants/:id/reset-password',
  validate({ params: idParam, body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    res.json(await service.resetAdminPassword(req.params.id, req.body.password, req.superadmin.email));
  })
);

// Eliminar definitivamente (cascade)
router.delete(
  '/tenants/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.deleteTenant(req.params.id, req.superadmin.email));
  })
);

// Entrar al panel de la tienda (genera token de admin del tenant)
router.post(
  '/tenants/:id/impersonate',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    res.json(await service.impersonate(req.params.id));
  })
);

// Log de acciones del superadmin
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    res.json(await service.listAudit(req.query.limit));
  })
);

export default router;
