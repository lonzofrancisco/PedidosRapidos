import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveTenantBySlug, requireTenantContext } from '../../middleware/tenant.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as service from './orders.service.js';

// ---------- Schemas ----------------------------------------------------
const createOrderSchema = z.object({
  customer: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(6).max(30),
    address: z.string().max(300).optional(),
    notes: z.string().max(500).optional(),
  }),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
    option_ids: z.array(z.string().uuid()).optional(),
    notes: z.string().max(200).optional(),
  })).min(1),
});

const idParam = z.object({ id: z.string().uuid() });
const statusBody = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
});

// ---------- Public router ---------------------------------------------
// Montado en: /api/v1/t/:tenantSlug/orders
export const publicOrdersRouter = Router({ mergeParams: true });

publicOrdersRouter.use(resolveTenantBySlug);

publicOrdersRouter.post(
  '/',
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.createOrder(req.tenant, req.body);
    res.status(201).json(result);
  })
);

// Permite al cliente consultar el estado por id (no expone datos sensibles).
publicOrdersRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const order = await service.getOrder(req.tenantId, req.params.id);
    res.json(order);
  })
);

// ---------- Admin router ----------------------------------------------
// Montado en: /api/v1/admin/orders
export const adminOrdersRouter = Router();

adminOrdersRouter.use(requireAuth, requireRole('admin'), requireTenantContext);

adminOrdersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await service.listOrders(req.tenantId, {
      status: req.query.status,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });
    res.json({ orders });
  })
);

adminOrdersRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const order = await service.getOrder(req.tenantId, req.params.id);
    res.json(order);
  })
);

adminOrdersRouter.patch(
  '/:id/status',
  validate({ params: idParam, body: statusBody }),
  asyncHandler(async (req, res) => {
    const order = await service.updateStatus(req.tenantId, req.params.id, req.body.status);
    res.json(order);
  })
);
