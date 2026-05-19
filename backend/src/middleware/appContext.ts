import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database';

/**
 * Middleware to set PostgreSQL session variable `app.current_user_id`.
 * This is used by audit triggers to record which user performed an action.
 *
 * Uses SET LOCAL to scope the variable to the current transaction.
 * Since there is no auth system, defaults to user_id 1 (admin).
 *
 * Note: SET LOCAL only takes effect within a transaction block.
 * For non-transactional queries, the audit trigger will use
 * current_setting('app.current_user_id', true) which returns NULL
 * if the variable is not set. The service layer should call
 * setAppContext() within transactions that need audit tracking.
 */
export function appContext() {
  return async (_req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Store the user_id on the request for use in service layer transactions
    (_req as any).userId = 1;
    next();
  };
}

/**
 * Set the app.current_user_id session variable on a database client.
 * Should be called within a transaction (after BEGIN) for audit trigger usage.
 *
 * @param client - A pg PoolClient (from getClient())
 * @param userId - The user ID to set (defaults to 1 for admin)
 */
export async function setAppContext(client: { query: (text: string, params?: any[]) => Promise<any> }, userId: number = 1): Promise<void> {
  await client.query('SET LOCAL app.current_user_id = $1', [userId.toString()]);
}

/**
 * Set the app.current_user_id session variable using the pool query helper.
 * Useful for simple single-query operations that still need audit context.
 * Note: This only works within a transaction block.
 *
 * @param userId - The user ID to set (defaults to 1 for admin)
 */
export async function setAppContextPool(userId: number = 1): Promise<void> {
  await query('SET LOCAL app.current_user_id = $1', [userId.toString()]);
}
