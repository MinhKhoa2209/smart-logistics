import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import { productLotsFilterSchema, expiringLotsFilterSchema } from '../validators/productLots.validator';
import * as productLotsService from '../services/productLots.service';

const router = Router();

/**
 * GET /api/lots
 * Paginated list of all product lots ordered by expiry_date ASC (FIFO).
 * Includes product name, supplier name, and inventory quantities across warehouses.
 */
router.get(
  '/',
  validate({ query: productLotsFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productLotsService.listLots({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/lots/expiring
 * Lots expiring within 30 days using idx_product_lots_expiry partial index.
 * Includes expiry classification: 'critical' (≤7 days), 'warning' (8-30 days).
 */
router.get(
  '/expiring',
  validate({ query: expiringLotsFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await productLotsService.listExpiringLots({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
