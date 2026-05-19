/**
 * Transaction wrapper utility for PostgreSQL operations.
 * Provides a helper that manages BEGIN/COMMIT/ROLLBACK and client release.
 */

import { PoolClient } from 'pg';
import { getClient } from '../config/database';

/**
 * Execute an async callback within a database transaction.
 * Automatically handles BEGIN, COMMIT, ROLLBACK, and client release.
 *
 * @param callback - An async function that receives a PoolClient to execute queries within the transaction
 * @returns The result of the callback function
 * @throws Re-throws any error from the callback after performing ROLLBACK
 *
 * @example
 * ```typescript
 * const result = await withTransaction(async (client) => {
 *   await client.query('INSERT INTO orders ...');
 *   await client.query('INSERT INTO order_items ...');
 *   return { success: true };
 * });
 * ```
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
