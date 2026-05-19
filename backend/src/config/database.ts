import { Pool, PoolConfig } from 'pg';

const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(poolConfig);

// Log connection errors without crashing the process
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

// Log successful pool connection on first connect
pool.on('connect', () => {
  console.log('Database pool: new client connected');
});

/**
 * Query the database using the connection pool.
 * Automatically acquires and releases a client.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number | null }> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
    }
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`Query failed after ${duration}ms:`, (error as Error).message);
    throw error;
  }
}

/**
 * Get a client from the pool for transaction support.
 * Caller is responsible for releasing the client.
 */
export async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Gracefully shut down the connection pool.
 * Should be called during process exit.
 */
export async function closePool(): Promise<void> {
  console.log('Closing database connection pool...');
  await pool.end();
  console.log('Database connection pool closed.');
}

/**
 * Check if the database is reachable.
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export default pool;
