import { Router } from 'express';
import authRouter from './modules/auth/auth.routes.js';
import { publicProductsRouter, adminProductsRouter } from './modules/products/products.routes.js';
import { publicOrdersRouter, publicOrderByIdRouter, adminOrdersRouter } from './modules/orders/orders.routes.js';
import { adminTenantRouter } from './modules/tenants/tenants.routes.js';
import { signupRouter } from './modules/signup/signup.routes.js';
import superadminRouter from './modules/superadmin/superadmin.routes.js';

const router = Router();

// Healthcheck
router.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---------- Auth -------------------------------------------------------
router.use('/auth',   authRouter);
router.use('/signup', signupRouter);

// ---------- Super admin (dueno del sistema) ---------------------------
// /api/v1/superadmin/login  + endpoints protegidos por requireSuperAdmin
router.use('/superadmin', superadminRouter);

// ---------- Storefront publico (por tenant slug) ----------------------
// /api/v1/t/:tenantSlug/products
// /api/v1/t/:tenantSlug/orders
router.use('/t/:tenantSlug/products', publicProductsRouter);
router.use('/t/:tenantSlug/orders',   publicOrdersRouter);

// Pedido por id (magic link compartido, sin slug)
router.use('/orders', publicOrderByIdRouter);

// ---------- Admin (autenticado, tenant via JWT) -----------------------
router.use('/admin/products', adminProductsRouter);
router.use('/admin/orders',   adminOrdersRouter);
router.use('/admin/tenant',   adminTenantRouter);

export default router;
