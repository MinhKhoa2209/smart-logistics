import { Request, Response, NextFunction } from 'express';
import { getClient, query } from '../config/database';

/**
 * Middleware to set PostgreSQL session variable `app.current_user_id`.
 * This is used by RLS policies and audit triggers to identify the current user.
 *
 * Since there is no auth system yet, defaults to user_id = 1 (admin).
 *
 * Uses SET SESSION so the variable persists for the lifetime of the connection
 * from the pool. Individual transactions can override it with SET LOCAL.
 *
 * IMPORTANT: Because pg uses a connection pool, we set the variable on a
 * dedicated client per-request only when needed (inside transactions).
 * For non-transactional queries that need RLS, use queryWithContext() below.
 */
export function appContext() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    // Hardcoded to user_id = 1 (admin) until auth is implemented.
    // Replace with real user extraction from JWT/session here.
    (_req as any).userId = 1;
    next();
  };
}

/**
 * Set `app.current_user_id` on a pg PoolClient within a transaction.
 * Must be called AFTER `BEGIN` and BEFORE any RLS-protected queries.
 *
 * Uses SET LOCAL so the variable is scoped to the current transaction only,
 * preventing context leaking to the next request that reuses the connection.
 *
 * @param client  - A PoolClient obtained from getClient()
 * @param userId  - The user ID to set (defaults to 1)
 */
export async function setAppContext(
  client: { query: (text: string, params?: any[]) => Promise<any> },
  userId: number = 1
): Promise<void> {
  await client.query('SET LOCAL app.current_user_id = $1', [userId.toString()]);
}

/**
 * Execute a single read-only query with RLS context set correctly.
 *
 * Wraps the query in a transaction so SET LOCAL takes effect, then rolls back
 * (since it is read-only). This ensures RLS policies see the correct user_id
 * without leaking context to other pool connections.
 *
 * @param sql     - The SQL query string
 * @param params  - Query parameters
 * @param userId  - The user ID to set as app context (defaults to 1)
 */
export async function queryWithContext<T = any>(
  sql: string,
  params: any[] = [],
  userId: number = 1
): Promise<{ rows: T[]; rowCount: number | null }> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL app.current_user_id = $1', [userId.toString()]);
    const result = await client.query(sql, params);
    await client.query('COMMIT');
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * @deprecated Use setAppContext(client, userId) inside a withTransaction() block instead.
 * This function sets the variable outside a transaction, which means SET LOCAL
 * behaves like SET SESSION and can leak to other requests via the connection pool.
 */
export async function setAppContextPool(userId: number = 1): Promise<void> {
  await query('SET LOCAL app.current_user_id = $1', [userId.toString()]);
}
