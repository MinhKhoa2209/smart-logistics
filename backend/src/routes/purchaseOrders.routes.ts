import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  purchaseOrderFilterSchema,
  purchaseOrderIdParamSchema,
} from '../validators/purchaseOrders.validator';
import * as purchaseOrdersService from '../services/purchaseOrders.service';

const router = Router();

/**
 * GET /api/purchase-orders
 * Paginated list of purchase orders with optional status and supplier filters.
 */
router.get(
  '/',
  validate({ query: purchaseOrderFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await purchaseOrdersService.listPurchaseOrders({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        status: req.query.status as string | undefined,
        supplier_id: req.query.supplier_id as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/purchase-orders
 * Create a new purchase order with items (transactional).
 */
router.post(
  '/',
  validate({ body: createPurchaseOrderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const order = await purchaseOrdersService.createPurchaseOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/purchase-orders/:id/receive
 * Receive goods against a purchase order (transactional).
 * Validates over-receiving and updates PO status.
 */
router.post(
  '/:id/receive',
  validate({ params: purchaseOrderIdParamSchema, body: receivePurchaseOrderSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = parseInt(req.params.id as string, 10);
      const order = await purchaseOrdersService.receivePurchaseOrder(orderId, req.body);
      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
