import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createTransferSchema,
  transferFilterSchema,
} from '../validators/transfers.validator';
import * as transfersService from '../services/transfers.service';

const router = Router();

/**
 * GET /api/transfers
 * Paginated list of transfer orders with optional status and warehouse filters.
 */
router.get(
  '/',
  validate({ query: transferFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await transfersService.listTransfers({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        status: req.query.status as string | undefined,
        from_warehouse_id: req.query.from_warehouse_id as string | undefined,
        to_warehouse_id: req.query.to_warehouse_id as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/transfers
 * Create and execute an inter-warehouse transfer.
 * Calls move_stock_advanced() with pessimistic locking.
 * 
 * Success: 201 with transfer order details
 * Insufficient stock (P0001): 400 with available quantity info
 * Lock timeout (55P03): 503 with retry_after_ms
 */
router.post(
  '/',
  validate({ body: createTransferSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const transfer = await transfersService.createTransfer(req.body);
      res.status(201).json(transfer);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
