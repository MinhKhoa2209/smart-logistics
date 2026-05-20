import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import { stockMovementsFilterSchema } from '../validators/stockMovements.validator';
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

export default router;
