import { Router } from 'express';
import authRouter from './modules/auth/auth.routes.js';
import { publicProductsRouter, adminProductsRouter } from './modules/products/products.routes.js';
import { publicOrdersRouter, adminOrdersRouter } from './modules/orders/orders.routes.js';

const router = Router();

// Healthcheck
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---------- Auth -------------------------------------------------------
router.use('/auth', authRouter);

// ---------- Storefront publico (por tenant slug) ----------------------
// /api/v1/t/:tenantSlug/products
// /api/v1/t/:tenantSlug/orders
router.use('/t/:tenantSlug/products', publicProductsRouter);
router.use('/t/:tenantSlug/orders',   publicOrdersRouter);

// ---------- Admin (autenticado, tenant via JWT) -----------------------
router.use('/admin/products', adminProductsRouter);
router.use('/admin/orders',   adminOrdersRouter);

export default router;
