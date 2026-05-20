import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import {
  createTransferSchema,
  transferFilterSchema,
} from '../validators/transfers.validator';
import * as transfersService from '../services/transfers.service';

const router = Router();

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
