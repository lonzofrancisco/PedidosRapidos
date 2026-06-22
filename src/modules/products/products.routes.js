import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveTenantBySlug, requireTenantContext, requirePlanActive } from '../../middleware/tenant.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { badRequest } from '../../utils/httpError.js';
import * as service from './products.service.js';

// ---------- Upload de imagen ------------------------------------------
// Mismo esquema que el logo del tenant: guardamos en /app/uploads/products/
// <uuid>.<ext>. El directorio se monta como volumen compartido con nginx,
// que lo sirve en /uploads/...
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';
const PRODUCT_UPLOAD_DIR = path.join(UPLOAD_DIR, 'products');
fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PRODUCT_UPLOAD_DIR),
  // Ignoramos el nombre original (path traversal, charset, etc) y derivamos
  // la extension del mime que ya pasamos por whitelist.
  filename: (req, file, cb) => {
    const ext = MIME_TO_EXT[file.mimetype] ?? '';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (req, file, cb) => {
    if (!MIME_TO_EXT[file.mimetype]) {
      return cb(badRequest('Formato no permitido. Usa JPG, PNG, WEBP o GIF.'));
    }
    cb(null, true);
  },
});

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
  // Acepta URL absoluta o path relativo "/uploads/..." (lo que devuelve el
  // upload local). null permite limpiar la imagen en un PATCH.
  image_url: z.union([z.string().url(), z.string().startsWith('/uploads/'), z.null()]).optional(),
  // Galeria ordenada: la primera es la portada. image_url se deriva de aca.
  image_urls: z
    .array(z.union([z.string().url(), z.string().startsWith('/uploads/')]))
    .max(8)
    .optional(),
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
        background_url: req.tenant.background_url,
        is_open: req.tenant.is_open,
        shipping_cost: req.tenant.shipping_cost,
        min_order_amount: req.tenant.min_order_amount,
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

adminProductsRouter.use(requireAuth, requireRole('admin'), requireTenantContext, requirePlanActive);

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

// Sube una imagen y devuelve su path publico. No la asocia a ningun producto:
// el form la incluye luego en el create/update. Asi funciona igual para
// productos nuevos (sin id todavia) y para edicion.
adminProductsRouter.post(
  '/image',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Falta el archivo "image"');
    const image_url = `/uploads/products/${req.file.filename}`;
    res.status(201).json({ image_url });
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
