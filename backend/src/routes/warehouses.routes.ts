import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  warehouseIdParamsSchema,
  warehouseListQuerySchema,
  warehouseInventoryQuerySchema,
} from '../validators/warehouses.validator';
import * as warehousesService from '../services/warehouses.service';

const router = Router();

/**
 * GET /api/warehouses
 * List all warehouses with optional type and active status filters.
 */
router.get(
  '/',
  validate({ query: warehouseListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = req.query as unknown as {
        warehouse_type?: string;
        is_active?: boolean;
      };
      const warehouses = await warehousesService.listWarehouses(filters);
      res.json({ data: warehouses });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/warehouses/:id
 * Get warehouse detail by ID.
 */
router.get(
  '/:id',
  validate({ params: warehouseIdParamsSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const warehouse = await warehousesService.getWarehouseById(id);
      res.json({ data: warehouse });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/warehouses/:id/inventory
 * Get inventory records for a specific warehouse.
 */
router.get(
  '/:id/inventory',
  validate({ params: warehouseIdParamsSchema, query: warehouseInventoryQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { page, pageSize } = req.query as unknown as {
        page?: number;
        pageSize?: number;
      };
      const result = await warehousesService.getWarehouseInventory(
        id,
        page || 1,
        pageSize || 50
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
