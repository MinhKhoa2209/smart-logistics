import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import { productLotsFilterSchema, expiringLotsFilterSchema } from '../validators/productLots.validator';
import * as productLotsService from '../services/productLots.service';

const router = Router();

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
