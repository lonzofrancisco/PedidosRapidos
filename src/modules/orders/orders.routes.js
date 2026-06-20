import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveTenantBySlug, requireTenantContext, requirePlanActive } from '../../middleware/tenant.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import * as service from './orders.service.js';

// URL publica con la que se construye el link al detalle del pedido en el
// mensaje de WhatsApp. Si hay PUBLIC_BASE_URL la usamos siempre; sino la
// derivamos del request (Host + X-Forwarded-Proto via 'trust proxy').
function resolvePublicBaseUrl(req) {
  if (env.publicBaseUrl) return env.publicBaseUrl;
  return `${req.protocol}://${req.get('host')}`;
}

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
    // Forma rica: lista de selecciones con cantidad por opcion (qty default 1).
    selections: z.array(z.object({
      option_id: z.string().uuid(),
      quantity: z.number().int().min(1).max(999).optional(),
    })).optional(),
    // Forma compacta retro-compatible: cada id se cuenta como qty 1.
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

// Anti-spam: un cliente real crea 1-2 pedidos; 20 cada 10 min por IP deja
// margen de sobra y frena floods de pedidos falsos (con 'trust proxy' usa la
// IP real del cliente, no la de nginx/Caddy).
const createOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados pedidos seguidos. Esperá unos minutos.' },
});

publicOrdersRouter.post(
  '/',
  createOrderLimiter,
  validate({ body: createOrderSchema }),
  asyncHandler(async (req, res) => {
    const publicBaseUrl = resolvePublicBaseUrl(req);
    const result = await service.createOrder(req.tenant, req.body, { publicBaseUrl });
    res.status(201).json(result);
  })
);

// Lectura del pedido por id para el comprador (magic link): el UUID no es
// enumerable y actua de credencial, por eso alcanza con el id + slug. Devuelve
// los datos del propio pedido, incluido contacto y direccion del cliente.
publicOrdersRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const order = await service.getOrder(req.tenantId, req.params.id);
    res.json(order);
  })
);

// ---------- Pedido por id (magic link, sin slug) ----------------------
// Montado en: /api/v1/orders/:id
// La pagina de detalle compartida la usa para que el comprador (no logueado)
// vea su pedido. El id es un UUID no enumerable, asi que actua de magic link.
export const publicOrderByIdRouter = Router();

publicOrderByIdRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const order = await service.getOrderById(req.params.id);
    res.json(order);
  })
);

// ---------- Admin router ----------------------------------------------
// Montado en: /api/v1/admin/orders
export const adminOrdersRouter = Router();

adminOrdersRouter.use(requireAuth, requireRole('admin'), requireTenantContext, requirePlanActive);

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
