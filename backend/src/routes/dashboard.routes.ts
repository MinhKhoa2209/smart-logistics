import { Router, Request, Response, NextFunction } from 'express';
import * as dashboardService from '../services/dashboard.service';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await dashboardService.getMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

router.get('/recent-movements', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const movements = await dashboardService.getRecentMovements();
    res.json(movements);
  } catch (error) {
    next(error);
  }
});

router.get('/low-stock', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const alerts = await dashboardService.getLowStockAlerts();
    res.json(alerts);
  } catch (error) {
    next(error);
  }
});

export default router;
