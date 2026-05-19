import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import { inventoryFilterSchema } from '../validators/inventory.validator';
import * as inventoryService from '../services/inventory.service';

const router = Router();

/**
 * GET /api/inventory
 * Paginated cross-warehouse inventory list (50/page) with warehouse and low-stock filters.
 */
router.get(
  '/',
  validate({ query: inventoryFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await inventoryService.listInventory({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        warehouse_id: req.query.warehouse_id as string | undefined,
        low_stock: req.query.low_stock as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
