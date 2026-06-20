import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { requireTenantContext, requirePlanActive } from '../../middleware/tenant.js';
import * as service from './reports.service.js';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 };
const DAY_MS = 86_400_000;

// ---------- Admin router ----------------------------------------------
// Montado en: /api/v1/admin/reports
export const adminReportsRouter = Router();
adminReportsRouter.use(requireAuth, requireRole('admin'), requireTenantContext, requirePlanActive);

adminReportsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    // range con default 30d; cualquier valor invalido cae a 30 dias.
    const days = RANGE_DAYS[req.query.range] ?? 30;
    const to = new Date();
    const from = new Date(to.getTime() - days * DAY_MS);

    const summary = await service.getSummary(req.tenantId, {
      from: from.toISOString(),
      to: to.toISOString(),
    });

    res.json({ ...summary, range: { days, from: from.toISOString(), to: to.toISOString() } });
  })
);
