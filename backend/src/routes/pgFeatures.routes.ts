import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import * as pgFeaturesService from '../services/pgFeatures.service';

const router = Router();

// ─── Transactions ────────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/transactions/demo
 * Demonstrates a PO receiving operation within an open transaction.
 * Returns SQL statements and results. Transaction remains open until commit/rollback.
 */
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

/**
 * POST /api/pg-features/transactions/commit
 * Commits an open demo transaction identified by sessionId.
 */
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

/**
 * POST /api/pg-features/transactions/rollback
 * Rolls back an open demo transaction identified by sessionId.
 */
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

// ─── Locking ─────────────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/locking/demo
 * Simulates two concurrent transfers on the same inventory row.
 * Demonstrates SELECT ... FOR UPDATE and measures lock wait time.
 */
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

// ─── Triggers ────────────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/triggers/demo
 * Demonstrates the auto-PO trigger by inserting a stock movement
 * that causes inventory to reach reorder_point.
 */
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

// ─── Stored Procedures ───────────────────────────────────────────────────────

/**
 * POST /api/pg-features/stored-procedures/:name
 * Executes a stored procedure/function by name with provided parameters.
 */
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

// ─── Partial Indexes ─────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/partial-indexes/demo
 * Demonstrates partial index performance with EXPLAIN ANALYZE comparison.
 */
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

// ─── Materialized Views ──────────────────────────────────────────────────────

/**
 * POST /api/pg-features/materialized-views/refresh
 * Executes REFRESH MATERIALIZED VIEW CONCURRENTLY and returns execution time.
 */
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

/**
 * GET /api/pg-features/materialized-views/compare
 * Compares EXPLAIN ANALYZE output between MV query and base table query.
 */
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

// ─── Audit Logging ───────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/audit/demo
 * Performs a sample UPDATE on a product and displays the resulting audit_log entry.
 * Transaction is rolled back after capturing results.
 */
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

// ─── pgvector ────────────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/pgvector/demo
 * Demonstrates semantic search with pgvector cosine similarity.
 * Accepts query text, generates embedding, executes search, returns SQL with <=> operator.
 */
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

// ─── Row Level Security ──────────────────────────────────────────────────────

/**
 * GET /api/pg-features/rls/demo
 * Demonstrates RLS by querying inventory with different role contexts.
 * Shows row counts and sample data per role (staff, manager, admin).
 */
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

// ─── Partitioning ────────────────────────────────────────────────────────────

/**
 * GET /api/pg-features/partitioning/demo
 * Demonstrates partition pruning with EXPLAIN ANALYZE on date-filtered stock_movements.
 */
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

// ─── Reset Demo Data ─────────────────────────────────────────────────────────

/**
 * POST /api/pg-features/reset-demo-data
 * Re-executes cleanup of demo-specific records, restoring initial state.
 */
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
