import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveTenantBySlug, requireTenantContext } from '../../middleware/tenant.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import * as service from './products.service.js';

// ---------- Schemas ----------------------------------------------------
// id opcional: cuando se envia, el backend hace UPDATE; si no, INSERT.
const optionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  price_delta: z.number().nonnegative().optional(),
  position: z.number().int().optional(),
  active: z.boolean().optional(),
});

const groupSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(['single', 'multi', 'quantity']),
  required: z.boolean().optional(),
  min_select: z.number().int().min(0).optional(),
  max_select: z.number().int().min(1).optional(),
  position: z.number().int().optional(),
  options: z.array(optionSchema).default([]),
});

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().nonnegative(),
  image_url: z.string().url().optional(),
  category_id: z.string().uuid().optional(),
  active: z.boolean().optional(),
  option_groups: z.array(groupSchema).optional(),
});

// PATCH acepta los mismos campos en modo opcional, incluyendo option_groups
// como reemplazo total (con diff por id en backend).
const updateProductSchema = createProductSchema.partial();

const idParam = z.object({ id: z.string().uuid() });

// ---------- Public storefront router ----------------------------------
// Montado en: /api/v1/t/:tenantSlug/products
export const publicProductsRouter = Router({ mergeParams: true });

publicProductsRouter.use(resolveTenantBySlug);

publicProductsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await service.listProducts(req.tenantId, { onlyActive: true });
    res.json({
      tenant: {
        slug: req.tenant.slug,
        name: req.tenant.name,
        currency: req.tenant.currency,
        image_url: req.tenant.image_url,
      },
      products,
    });
  })
);

publicProductsRouter.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const product = await service.getProduct(req.tenantId, req.params.id);
    res.json(product);
  })
);

// ---------- Admin router ----------------------------------------------
// Montado en: /api/v1/admin/products
export const adminProductsRouter = Router();

adminProductsRouter.use(requireAuth, requireRole('admin'), requireTenantContext);

adminProductsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await service.listProducts(req.tenantId, { onlyActive: false });
    res.json({ products });
  })
);

adminProductsRouter.post(
  '/',
  validate({ body: createProductSchema }),
  asyncHandler(async (req, res) => {
    const product = await service.createProduct(req.tenantId, req.body);
    res.status(201).json(product);
  })
);

adminProductsRouter.patch(
  '/:id',
  validate({ params: idParam, body: updateProductSchema }),
  asyncHandler(async (req, res) => {
    const product = await service.updateProduct(req.tenantId, req.params.id, req.body);
    res.json(product);
  })
);

adminProductsRouter.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await service.deleteProduct(req.tenantId, req.params.id);
    res.status(204).end();
  })
);
