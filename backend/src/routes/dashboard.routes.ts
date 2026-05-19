import { Router, Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';

const router = Router();

/**
 * GET /api/dashboard/metrics
 * Returns active products count, active warehouses count, low stock count,
 * and shipment counts grouped by status.
 */
router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await dashboardService.getMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/recent-movements
 * Returns the 10 most recent stock movements ordered by created_at DESC.
 */
router.get('/recent-movements', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const movements = await dashboardService.getRecentMovements();
    res.json(movements);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/dashboard/low-stock
 * Returns up to 50 low stock items ordered by criticality (quantity/reorder_point ratio ASC).
 */
router.get('/low-stock', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await dashboardService.getLowStockAlerts();
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export default router;
