import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createStockMovementSchema,
  stockMovementIdParamSchema,
  stockMovementsFilterSchema,
  updateStockMovementSchema,
} from '../validators/stockMovements.validator';
import * as stockMovementsService from '../services/stockMovements.service';

const router = Router();

router.get(
  '/',
  validate({ query: stockMovementsFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await stockMovementsService.listStockMovements({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
        movement_type: req.query.movement_type as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/:id',
  validate({ params: stockMovementIdParamSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const movementId = parseInt(req.params.id as string, 10);
      const movement = await stockMovementsService.getStockMovement(movementId);
      res.json(movement);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/',
  validate({ body: createStockMovementSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const movement = await stockMovementsService.createStockMovement(req.body);
      res.status(201).json(movement);
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/:id',
  validate({ params: stockMovementIdParamSchema, body: updateStockMovementSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const movementId = parseInt(req.params.id as string, 10);
      const movement = await stockMovementsService.updateStockMovement(movementId, req.body);
      res.json(movement);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
