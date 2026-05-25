import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireTenantContext, requirePlanActive } from '../../middleware/tenant.js';
import { badRequest } from '../../utils/httpError.js';
import * as service from './tenants.service.js';

// ---------- Upload de imagen ------------------------------------------
// Guardamos en /app/uploads/tenants/<uuid>.<ext>. El directorio se monta
// como volumen compartido con nginx, que lo sirve en /uploads/...
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';
const TENANT_UPLOAD_DIR = path.join(UPLOAD_DIR, 'tenants');
fs.mkdirSync(TENANT_UPLOAD_DIR, { recursive: true });

const MIME_TO_EXT = {
  'image/jpeg': '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TENANT_UPLOAD_DIR),
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

// Igual que `upload` pero con limite mayor: una imagen de fondo pesa mas que
// un logo, y como se muestra difuminada no necesita ser liviana al milimetro.
const uploadBg = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!MIME_TO_EXT[file.mimetype]) {
      return cb(badRequest('Formato no permitido. Usa JPG, PNG, WEBP o GIF.'));
    }
    cb(null, true);
  },
});

// ---------- Schemas ----------------------------------------------------
const updateTenantSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  whatsapp_number: z.string().min(6).max(30).optional(),
  // Acepta tanto URL absoluta como path relativo "/uploads/..." (el upload
  // local devuelve un path relativo).
  image_url: z.union([z.string().url(), z.string().startsWith('/uploads/'), z.null()]).optional(),
  background_url: z.union([z.string().url(), z.string().startsWith('/uploads/'), z.null()]).optional(),
});

// ---------- Router -----------------------------------------------------
// Montado en /api/v1/admin/tenant
export const adminTenantRouter = Router();
adminTenantRouter.use(requireAuth, requireRole('admin'), requireTenantContext);

adminTenantRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenant = await service.getTenant(req.tenantId);
    res.json(tenant);
  })
);

adminTenantRouter.patch(
  '/',
  requirePlanActive,
  validate({ body: updateTenantSchema }),
  asyncHandler(async (req, res) => {
    const tenant = await service.updateTenant(req.tenantId, req.body);
    res.json(tenant);
  })
);

adminTenantRouter.post(
  '/image',
  requirePlanActive,
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Falta el archivo "image"');
    const publicPath = `/uploads/tenants/${req.file.filename}`;
    const tenant = await service.updateTenant(req.tenantId, { image_url: publicPath });
    res.status(201).json({ image_url: publicPath, tenant });
  })
);

adminTenantRouter.post(
  '/background',
  requirePlanActive,
  uploadBg.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Falta el archivo "image"');
    const publicPath = `/uploads/tenants/${req.file.filename}`;
    const tenant = await service.updateTenant(req.tenantId, { background_url: publicPath });
    res.status(201).json({ background_url: publicPath, tenant });
  })
);
