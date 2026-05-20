import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  updateCustomerOrderStatusSchema,
  createPaymentSchema,
  customerOrderFilterSchema,
  customerOrderIdParamSchema,
} from '../validators/customerOrders.validator';
import * as customerOrdersService from '../services/customerOrders.service';

const router = Router();

router.get(
  '/',
  validate({ query: customerOrderFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await customerOrdersService.listCustomerOrders({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        status: req.query.status as string | undefined,
        payment_status: req.query.payment_status as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id/status',
  validate({ params: customerOrderIdParamSchema, body: updateCustomerOrderStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerOrderId = parseInt(req.params.id as string, 10);
      const order = await customerOrdersService.updateCustomerOrderStatus(customerOrderId, req.body);
      res.json(order);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/:id/payments',
  validate({ params: customerOrderIdParamSchema, body: createPaymentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const customerOrderId = parseInt(req.params.id as string, 10);
      const result = await customerOrdersService.recordPayment(customerOrderId, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
