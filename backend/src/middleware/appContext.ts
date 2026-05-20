import { Request, Response, NextFunction } from 'express';
import { getClient, query } from '../config/database';

export function appContext() {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    (_req as any).userId = 1;
    next();
  };
}

export async function setAppContext(
  client: { query: (text: string, params?: any[]) => Promise<any>; },
  userId: number = 1
): Promise<void> {
  await client.query(`SET LOCAL app.current_user_id = ${Math.trunc(userId)}`);
}

export async function queryWithContext<T = any>(
  sql: string,
  params: any[] = [],
  userId: number = 1
): Promise<{ rows: T[]; rowCount: number | null; }> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(`SET LOCAL app.current_user_id = ${Math.trunc(userId)}`);
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

export async function setAppContextPool(userId: number = 1): Promise<void> {
  await query(`SET LOCAL app.current_user_id = ${Math.trunc(userId)}`);
}
