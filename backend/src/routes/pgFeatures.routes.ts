import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import * as pgFeaturesService from '../services/pgFeatures.service';

const router = Router();

router.post(
  '/transactions/demo',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = (req.body.sessionId as string) || randomUUID();
      const results = await pgFeaturesService.transactionsDemo(sessionId);
      res.json({ sessionId, steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/transactions/commit',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.body.sessionId as string;
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }
      const result = await pgFeaturesService.commitTransaction(sessionId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/transactions/rollback',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.body.sessionId as string;
      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }
      const result = await pgFeaturesService.rollbackTransaction(sessionId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/locking/demo',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { product_id, warehouse_id } = req.body;
      const results = await pgFeaturesService.lockingDemo({
        product_id: product_id ? Number(product_id) : undefined,
        warehouse_id: warehouse_id ? Number(warehouse_id) : undefined,
      });
      res.json({ steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/triggers/demo',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await pgFeaturesService.triggersDemo();
      res.json({ steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/stored-procedures/:name',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const name = req.params.name as string;
      const results = await pgFeaturesService.storedProcedureDemo(name, req.body);
      res.json({ steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/partial-indexes/demo',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.partialIndexesDemo();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/materialized-views/refresh',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.refreshMaterializedView();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/materialized-views/compare',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.compareMaterializedView();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/audit/demo',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const results = await pgFeaturesService.auditDemo();
      res.json({ steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/pgvector/demo',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query: queryText } = req.body;
      if (!queryText || typeof queryText !== 'string') {
        return res.status(400).json({ error: 'query is required and must be a string' });
      }
      const results = await pgFeaturesService.pgvectorDemo(queryText);
      res.json({ steps: results });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/rls/demo',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.rlsDemo();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/partitioning/demo',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.partitioningDemo();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/reset-demo-data',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pgFeaturesService.resetDemoData();
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
