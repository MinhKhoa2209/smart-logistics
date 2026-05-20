import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createShipmentSchema,
  updateShipmentStatusSchema,
  shipmentFilterSchema,
  shipmentIdParamSchema,
} from '../validators/shipments.validator';
import * as shipmentsService from '../services/shipments.service';

const router = Router();

router.get(
  '/',
  validate({ query: shipmentFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await shipmentsService.listShipments({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        status: req.query.status as string | undefined,
        origin_warehouse_id: req.query.origin_warehouse_id as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate({ body: createShipmentSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shipment = await shipmentsService.createShipment(req.body);
      res.status(201).json(shipment);
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/:id/status',
  validate({ params: shipmentIdParamSchema, body: updateShipmentStatusSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shipmentId = parseInt(req.params.id as string, 10);
      const shipment = await shipmentsService.updateShipmentStatus(shipmentId, req.body);
      res.json(shipment);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
