import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware';
import { auditLogsFilterSchema } from '../validators/auditLogs.validator';
import * as auditLogsService from '../services/auditLogs.service';

const router = Router();

router.get(
  '/',
  validate({ query: auditLogsFilterSchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await auditLogsService.listAuditLogs({
        page: req.query.page as string | undefined,
        pageSize: req.query.pageSize as string | undefined,
        table_name: req.query.table_name as string | undefined,
        user_id: req.query.user_id as string | undefined,
        action: req.query.action as string | undefined,
        start_date: req.query.start_date as string | undefined,
        end_date: req.query.end_date as string | undefined,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
