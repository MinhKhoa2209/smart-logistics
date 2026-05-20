/**
 * PG Features Demo service — interactive demonstrations of PostgreSQL features.
 * Each demo captures the SQL executed, the result, and execution time in milliseconds.
 */

import { PoolClient } from 'pg';
import { getClient, query } from '../config/database';
import { generateEmbedding } from '../utils/embedding';
import { AppError } from '../middleware';

/**
 * Standard response structure for all PG feature demonstrations.
 */
export interface DemoExecutionResult {
  sql: string;
  result: unknown;
  executionTimeMs: number;
  error?: string;
}

/**
 * Module-level store for open demo transaction clients.
 * Keyed by session ID to allow commit/rollback from separate requests.
 */
const openTransactions = new Map<string, { client: PoolClient; startedAt: number }>();

// Auto-cleanup stale transactions after 5 minutes
const TRANSACTION_TIMEOUT_MS = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, entry] of openTransactions.entries()) {
    if (now - entry.startedAt > TRANSACTION_TIMEOUT_MS) {
      entry.client.query('ROLLBACK').catch(() => {});
      entry.client.release();
      openTransactions.delete(sessionId);
    }
  }
}, 60_000);

/**
 * Execute a demo SQL statement and capture timing + results.
 */
async function executeDemoSql(
  client: PoolClient,
  sql: string,
  params?: any[]
): Promise<DemoExecutionResult> {
  const start = Date.now();
  try {
    const result = await client.query(sql, params);
    const executionTimeMs = Date.now() - start;
    return {
      sql: formatSqlWithParams(sql, params),
      result: {
        rows: result.rows,
        rowCount: result.rowCount,
      },
      executionTimeMs,
    };
  } catch (error: any) {
    const executionTimeMs = Date.now() - start;
    return {
      sql: formatSqlWithParams(sql, params),
      result: null,
      executionTimeMs,
      error: error.message,
    };
  }
}

/**
 * Format SQL with parameter values substituted for display purposes.
 */
function formatSqlWithParams(sql: string, params?: any[]): string {
  if (!params || params.length === 0) return sql.trim();
  let formatted = sql;
  params.forEach((param, index) => {
    const placeholder = `$${index + 1}`;
    const value = param === null ? 'NULL' : typeof param === 'string' ? `'${param}'` : String(param);
    formatted = formatted.replace(placeholder, value);
  });
  return formatted.trim();
}

// ─── Transactions Demo ───────────────────────────────────────────────────────

/**
 * Demonstrates a PO receiving operation within an open transaction.
 * The transaction is kept open until the user explicitly commits or rolls back.
 *
 * Steps:
 * 1. BEGIN
 * 2. UPDATE order_items SET received_quantity
 * 3. INSERT INTO stock_movements (inbound)
 * 4. Transaction remains open — user must call commit or rollback
 *
 * Returns the SQL statements and intermediate results.
 */
export async function transactionsDemo(sessionId: string): Promise<DemoExecutionResult[]> {
  // Clean up any existing transaction for this session
  if (openTransactions.has(sessionId)) {
    const existing = openTransactions.get(sessionId)!;
    await existing.client.query('ROLLBACK').catch(() => {});
    existing.client.release();
    openTransactions.delete(sessionId);
  }

  const client = await getClient();
  const results: DemoExecutionResult[] = [];

  try {
    // BEGIN transaction
    const beginStart = Date.now();
    await client.query('BEGIN');
    // Set app context so RLS policies on inventory (triggered by stock_movements insert) pass.
    // Uses admin (user_id=1) for the demo since there is no auth system yet.
    await client.query("SET LOCAL app.current_user_id = '1'");
    results.push({
      sql: 'BEGIN',
      result: { message: 'Transaction started' },
      executionTimeMs: Date.now() - beginStart,
    });

    // Find a pending PO with items to demonstrate receiving
    const findPoSql = `
      SELECT oi.order_item_id, oi.product_id, oi.ordered_quantity, oi.received_quantity,
             po.order_id, po.warehouse_id, p.name as product_name
      FROM order_items oi
      JOIN purchase_orders po ON oi.order_id = po.order_id
      JOIN products p ON oi.product_id = p.product_id
      WHERE po.status IN ('pending', 'approved', 'ordered', 'partially_received')
        AND oi.received_quantity < oi.ordered_quantity
      LIMIT 1
    `;
    const findResult = await executeDemoSql(client, findPoSql);
    results.push(findResult);

    if (findResult.error || !(findResult.result as any)?.rows?.length) {
      // No suitable PO found — rollback and return
      await client.query('ROLLBACK');
      client.release();
      results.push({
        sql: 'ROLLBACK',
        result: { message: 'No pending purchase order items found for demo. Transaction rolled back.' },
        executionTimeMs: 0,
      });
      return results;
    }

    const item = (findResult.result as any).rows[0];
    const receiveQty = Math.min(5, item.ordered_quantity - item.received_quantity);

    // UPDATE order_items — increase received_quantity
    const updateSql = `
      UPDATE order_items
      SET received_quantity = received_quantity + $1
      WHERE order_item_id = $2
      RETURNING order_item_id, product_id, ordered_quantity, received_quantity
    `;
    const updateResult = await executeDemoSql(client, updateSql, [receiveQty, item.order_item_id]);
    results.push(updateResult);

    // INSERT stock_movement — inbound movement
    const movementSql = `
      INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, reference_type)
      VALUES ($1, $2, $3, 'inbound', $4)
      RETURNING movement_id, product_id, warehouse_id, change_amount, movement_type
    `;
    const movementResult = await executeDemoSql(client, movementSql, [
      item.product_id,
      item.warehouse_id,
      receiveQty,
      `po_demo_${item.order_id}`,
    ]);
    results.push(movementResult);

    // Store the open transaction for later commit/rollback
    openTransactions.set(sessionId, { client, startedAt: Date.now() });

    results.push({
      sql: '-- Transaction is now OPEN. Call /commit or /rollback to finalize.',
      result: {
        message: 'Transaction remains open. Use commit or rollback endpoint to finalize.',
        sessionId,
        orderItemId: item.order_item_id,
        productName: item.product_name,
        receivedQuantity: receiveQty,
      },
      executionTimeMs: 0,
    });

    return results;
  } catch (error: any) {
    // On error, rollback and release
    await client.query('ROLLBACK').catch(() => {});
    client.release();
    throw new AppError(500, `Transaction demo failed: ${error.message}`);
  }
}

/**
 * Commit an open demo transaction.
 */
export async function commitTransaction(sessionId: string): Promise<DemoExecutionResult> {
  const entry = openTransactions.get(sessionId);
  if (!entry) {
    throw new AppError(404, 'No open transaction found for this session. It may have expired or already been finalized.');
  }

  const { client } = entry;
  const start = Date.now();

  try {
    await client.query('COMMIT');
    const executionTimeMs = Date.now() - start;
    return {
      sql: 'COMMIT',
      result: { message: 'Transaction committed successfully. All changes are now permanent.' },
      executionTimeMs,
    };
  } catch (error: any) {
    return {
      sql: 'COMMIT',
      result: null,
      executionTimeMs: Date.now() - start,
      error: error.message,
    };
  } finally {
    client.release();
    openTransactions.delete(sessionId);
  }
}

/**
 * Rollback an open demo transaction.
 */
export async function rollbackTransaction(sessionId: string): Promise<DemoExecutionResult> {
  const entry = openTransactions.get(sessionId);
  if (!entry) {
    throw new AppError(404, 'No open transaction found for this session. It may have expired or already been finalized.');
  }

  const { client } = entry;
  const start = Date.now();

  try {
    await client.query('ROLLBACK');
    const executionTimeMs = Date.now() - start;
    return {
      sql: 'ROLLBACK',
      result: { message: 'Transaction rolled back successfully. All changes have been discarded.' },
      executionTimeMs,
    };
  } catch (error: any) {
    return {
      sql: 'ROLLBACK',
      result: null,
      executionTimeMs: Date.now() - start,
      error: error.message,
    };
  } finally {
    client.release();
    openTransactions.delete(sessionId);
  }
}

// ─── Locking Demo ────────────────────────────────────────────────────────────

/**
 * Demonstrates pessimistic locking (SELECT ... FOR UPDATE) by simulating
 * two concurrent transfers on the same inventory row.
 *
 * Flow:
 * 1. Transfer A acquires lock via move_stock_advanced
 * 2. Transfer B attempts the same row and waits for the lock
 * 3. Measures lock wait time for Transfer B
 *
 * Both transfers are rolled back after the demo to avoid modifying data.
 */
export async function lockingDemo(params: {
  product_id?: number;
  warehouse_id?: number;
}): Promise<DemoExecutionResult[]> {
  const results: DemoExecutionResult[] = [];

  // Find a suitable inventory row for the demo
  const clientA = await getClient();
  const clientB = await getClient();

  try {
    // Find an inventory row with sufficient quantity
    const findSql = `
      SELECT i.inventory_id, i.product_id, i.warehouse_id, i.quantity, i.lot_id,
             p.name as product_name, w.name as warehouse_name
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.quantity >= 2
      ${params.product_id ? 'AND i.product_id = $1' : ''}
      ${params.warehouse_id ? `AND i.warehouse_id = $${params.product_id ? '2' : '1'}` : ''}
      LIMIT 1
    `;
    const findParams: any[] = [];
    if (params.product_id) findParams.push(params.product_id);
    if (params.warehouse_id) findParams.push(params.warehouse_id);

    const findResult = await clientA.query(findSql, findParams);

    if (findResult.rows.length === 0) {
      clientA.release();
      clientB.release();
      results.push({
        sql: findSql.trim(),
        result: { message: 'No inventory row with quantity >= 2 found for locking demo.' },
        executionTimeMs: 0,
      });
      return results;
    }

    const row = findResult.rows[0];
    results.push({
      sql: formatSqlWithParams(findSql, findParams),
      result: {
        message: `Selected inventory row for demo`,
        product_name: row.product_name,
        warehouse_name: row.warehouse_name,
        quantity: row.quantity,
      },
      executionTimeMs: 0,
    });

    // Transfer A: BEGIN and acquire lock
    const transferAStart = Date.now();
    await clientA.query('BEGIN');
    
    const lockSql = `
      SELECT * FROM inventory
      WHERE product_id = $1 AND warehouse_id = $2
      FOR UPDATE
    `;
    const lockResult = await clientA.query(lockSql, [row.product_id, row.warehouse_id]);
    const transferALockTime = Date.now() - transferAStart;

    results.push({
      sql: `-- Transfer A: Acquire lock\nBEGIN;\n${formatSqlWithParams(lockSql, [row.product_id, row.warehouse_id])}`,
      result: {
        message: 'Transfer A acquired lock on inventory row',
        lockedRows: lockResult.rowCount,
        lockAcquiredInMs: transferALockTime,
      },
      executionTimeMs: transferALockTime,
    });

    // Transfer B: BEGIN and attempt to acquire the same lock (will wait)
    await clientB.query('BEGIN');
    // Set a short lock_timeout so we don't block forever
    await clientB.query('SET LOCAL lock_timeout = \'5s\'');

    const transferBStart = Date.now();

    // Run Transfer B lock attempt concurrently, then release A's lock
    const transferBPromise = clientB.query(lockSql, [row.product_id, row.warehouse_id])
      .then((res) => ({ success: true, result: res, waitMs: Date.now() - transferBStart }))
      .catch((err) => ({ success: false, error: err.message, waitMs: Date.now() - transferBStart }));

    // Wait a short moment to ensure B is waiting, then release A's lock
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Rollback Transfer A to release the lock
    await clientA.query('ROLLBACK');
    const transferATotalTime = Date.now() - transferAStart;

    results.push({
      sql: '-- Transfer A: Release lock\nROLLBACK;',
      result: {
        message: 'Transfer A rolled back, lock released',
        totalExecutionTimeMs: transferATotalTime,
      },
      executionTimeMs: transferATotalTime,
    });

    // Wait for Transfer B to complete
    const transferBResult = await transferBPromise;

    if (transferBResult.success) {
      results.push({
        sql: `-- Transfer B: Waited for lock\nBEGIN;\nSET LOCAL lock_timeout = '5s';\n${formatSqlWithParams(lockSql, [row.product_id, row.warehouse_id])}`,
        result: {
          message: 'Transfer B acquired lock after waiting',
          lockWaitMs: transferBResult.waitMs,
          lockedRows: (transferBResult as any).result?.rowCount,
        },
        executionTimeMs: transferBResult.waitMs,
      });
    } else {
      results.push({
        sql: `-- Transfer B: Lock wait timeout\nBEGIN;\nSET LOCAL lock_timeout = '5s';\n${formatSqlWithParams(lockSql, [row.product_id, row.warehouse_id])}`,
        result: {
          message: 'Transfer B timed out waiting for lock',
          lockWaitMs: transferBResult.waitMs,
        },
        executionTimeMs: transferBResult.waitMs,
        error: (transferBResult as any).error,
      });
    }

    // Rollback Transfer B
    await clientB.query('ROLLBACK');

    // Summary
    results.push({
      sql: '-- Summary: Pessimistic Locking (SELECT ... FOR UPDATE)',
      result: {
        explanation: 'Transfer A acquired an exclusive row lock using SELECT ... FOR UPDATE. Transfer B attempted to lock the same row and was blocked until Transfer A released the lock via ROLLBACK.',
        transferA_totalMs: transferATotalTime,
        transferB_lockWaitMs: transferBResult.waitMs,
        product: row.product_name,
        warehouse: row.warehouse_name,
      },
      executionTimeMs: 0,
    });

    return results;
  } catch (error: any) {
    // Cleanup on error
    await clientA.query('ROLLBACK').catch(() => {});
    await clientB.query('ROLLBACK').catch(() => {});
    throw new AppError(500, `Locking demo failed: ${error.message}`);
  } finally {
    clientA.release();
    clientB.release();
  }
}


// ─── Triggers Demo ───────────────────────────────────────────────────────────

/**
 * Demonstrates the trg_check_reorder_after_inventory_change trigger.
 *
 * Flow:
 * 1. Find a product with inventory near reorder_point
 * 2. Insert a stock_movement that causes inventory to reach reorder_point
 * 3. The trigger auto-creates a purchase order
 * 4. Capture the auto-created PO
 * 5. ROLLBACK to avoid modifying real data
 */
export async function triggersDemo(): Promise<DemoExecutionResult[]> {
  const client = await getClient();
  const results: DemoExecutionResult[] = [];

  try {
    // BEGIN transaction
    const beginStart = Date.now();
    await client.query('BEGIN');
    // Set app context so RLS policies on inventory (triggered by stock_movements insert) pass.
    await client.query("SET LOCAL app.current_user_id = '1'");
    results.push({
      sql: 'BEGIN',
      result: { message: 'Transaction started (will ROLLBACK at end to preserve data)' },
      executionTimeMs: Date.now() - beginStart,
    });

    // Find a product with inventory above reorder_point (so we can reduce it to trigger)
    const findSql = `
      SELECT i.inventory_id, i.product_id, i.warehouse_id, i.quantity, i.reorder_point,
             i.max_stock_level, i.lot_id,
             p.name as product_name, p.supplier_id, p.sku,
             w.name as warehouse_name, s.name as supplier_name
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
      WHERE i.quantity > i.reorder_point
        AND p.supplier_id IS NOT NULL
        AND w.warehouse_type != 'returns'
      ORDER BY (i.quantity - i.reorder_point) ASC
      LIMIT 1
    `;
    const findResult = await executeDemoSql(client, findSql);
    results.push(findResult);

    if (findResult.error || !(findResult.result as any)?.rows?.length) {
      await client.query('ROLLBACK');
      client.release();
      results.push({
        sql: 'ROLLBACK',
        result: { message: 'No suitable inventory record found for trigger demo. Need a product with quantity > reorder_point and a supplier assigned.' },
        executionTimeMs: 0,
      });
      return results;
    }

    const inv = (findResult.result as any).rows[0];
    // Calculate the change_amount needed to bring quantity to reorder_point
    const changeAmount = -(inv.quantity - inv.reorder_point);

    // Delete any existing pending PO for this product/warehouse to ensure trigger fires
    const deletePendingPoSql = `
      DELETE FROM order_items
      WHERE order_id IN (
        SELECT po.order_id FROM purchase_orders po
        JOIN order_items oi ON po.order_id = oi.order_id
        WHERE po.warehouse_id = $1 AND oi.product_id = $2 AND po.status = 'pending'
      )
    `;
    await client.query(deletePendingPoSql, [inv.warehouse_id, inv.product_id]);
    const deletePendingPoSql2 = `
      DELETE FROM purchase_orders
      WHERE warehouse_id = $1 AND status = 'pending'
        AND order_id IN (
          SELECT po.order_id FROM purchase_orders po
          WHERE po.warehouse_id = $1 AND po.status = 'pending'
            AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = po.order_id)
        )
    `;
    await client.query(deletePendingPoSql2, [inv.warehouse_id]);

    // Record the max order_id before the movement (to detect auto-created PO)
    const maxPoResult = await client.query('SELECT COALESCE(MAX(order_id), 0) as max_id FROM purchase_orders');
    const maxPoIdBefore = maxPoResult.rows[0].max_id;

    // Insert stock_movement that will trigger inventory sync → reorder trigger
    const movementSql = `
      INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, lot_id, reference_type)
      VALUES ($1, $2, $3, 'adjustment', $4, 'trigger_demo')
      RETURNING movement_id, product_id, warehouse_id, change_amount, movement_type, created_at
    `;
    const movementParams = [inv.product_id, inv.warehouse_id, changeAmount, inv.lot_id];
    const movementResult = await executeDemoSql(client, movementSql, movementParams);
    results.push(movementResult);

    // Check the inventory after the movement (should now be at reorder_point)
    const checkInvSql = `
      SELECT quantity, reorder_point FROM inventory
      WHERE product_id = $1 AND warehouse_id = $2
        AND (lot_id = $3 OR (lot_id IS NULL AND $3::int IS NULL))
    `;
    const checkInvResult = await executeDemoSql(client, checkInvSql, [inv.product_id, inv.warehouse_id, inv.lot_id]);
    results.push(checkInvResult);

    // Check for auto-created purchase order
    const findPoSql = `
      SELECT po.order_id, po.supplier_id, po.warehouse_id, po.status, po.total_amount, po.note,
             s.name as supplier_name,
             oi.product_id, oi.ordered_quantity, oi.unit_cost,
             p.name as product_name
      FROM purchase_orders po
      JOIN order_items oi ON po.order_id = oi.order_id
      JOIN products p ON oi.product_id = p.product_id
      LEFT JOIN suppliers s ON po.supplier_id = s.supplier_id
      WHERE po.order_id > $1
        AND po.warehouse_id = $2
      ORDER BY po.order_id DESC
      LIMIT 1
    `;
    const findPoResult = await executeDemoSql(client, findPoSql, [maxPoIdBefore, inv.warehouse_id]);
    results.push(findPoResult);

    // ROLLBACK to preserve data
    const rollbackStart = Date.now();
    await client.query('ROLLBACK');
    results.push({
      sql: 'ROLLBACK',
      result: { message: 'Transaction rolled back. All changes discarded — data is unchanged.' },
      executionTimeMs: Date.now() - rollbackStart,
    });

    // Summary
    const autoPoRows = (findPoResult.result as any)?.rows || [];
    results.push({
      sql: '-- Summary: Trigger trg_check_reorder_after_inventory_change',
      result: {
        explanation: 'Inserted a stock_movement that reduced inventory to reorder_point. The trg_sync_inventory_after_movement trigger updated inventory, then trg_check_reorder_after_inventory_change detected low stock and auto-created a purchase order.',
        product: inv.product_name,
        warehouse: inv.warehouse_name,
        supplier: inv.supplier_name,
        originalQuantity: inv.quantity,
        changeAmount,
        newQuantity: inv.reorder_point,
        reorderPoint: inv.reorder_point,
        autoPoCreated: autoPoRows.length > 0,
        autoPo: autoPoRows.length > 0 ? {
          orderId: autoPoRows[0].order_id,
          supplierName: autoPoRows[0].supplier_name,
          orderedQuantity: autoPoRows[0].ordered_quantity,
          totalAmount: autoPoRows[0].total_amount,
          status: autoPoRows[0].status,
          note: autoPoRows[0].note,
        } : null,
      },
      executionTimeMs: 0,
    });

    return results;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw new AppError(500, `Triggers demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

// ─── Stored Procedures Demo ──────────────────────────────────────────────────

/**
 * Validates and executes a stored procedure/function by name.
 * Supported: suggest_smart_warehouse, move_stock_advanced, calculate_distance
 */
export async function storedProcedureDemo(
  name: string,
  params: Record<string, any>
): Promise<DemoExecutionResult[]> {
  switch (name) {
    case 'suggest_smart_warehouse':
      return executeSuggestSmartWarehouse(params);
    case 'move_stock_advanced':
      return executeMoveStockAdvanced(params);
    case 'calculate_distance':
      return executeCalculateDistance(params);
    default:
      throw new AppError(400, `Unknown stored procedure: "${name}". Supported: suggest_smart_warehouse, move_stock_advanced, calculate_distance`);
  }
}

async function executeSuggestSmartWarehouse(params: Record<string, any>): Promise<DemoExecutionResult[]> {
  const results: DemoExecutionResult[] = [];

  // Validate parameters
  const { product_id, required_quantity, latitude, longitude } = params;

  if (!product_id || !Number.isInteger(Number(product_id))) {
    throw new AppError(400, 'Invalid parameter: product_id must be a valid integer');
  }
  if (!required_quantity || Number(required_quantity) < 1) {
    throw new AppError(400, 'Invalid parameter: required_quantity must be >= 1');
  }
  if (latitude === undefined || latitude === null || Number(latitude) < -90 || Number(latitude) > 90) {
    throw new AppError(400, 'Invalid parameter: latitude must be between -90 and 90');
  }
  if (longitude === undefined || longitude === null || Number(longitude) < -180 || Number(longitude) > 180) {
    throw new AppError(400, 'Invalid parameter: longitude must be between -180 and 180');
  }

  // Verify product exists
  const productCheck = await query('SELECT product_id, name FROM products WHERE product_id = $1', [Number(product_id)]);
  if (productCheck.rows.length === 0) {
    throw new AppError(400, `Invalid parameter: product_id ${product_id} does not exist`);
  }

  const sql = `SELECT * FROM suggest_smart_warehouse($1, $2, $3, $4)`;
  const sqlParams = [Number(product_id), Number(required_quantity), Number(latitude), Number(longitude)];

  const start = Date.now();
  try {
    const result = await query(sql, sqlParams);
    const executionTimeMs = Date.now() - start;

    results.push({
      sql: formatSqlWithParams(sql, sqlParams),
      result: {
        rows: result.rows,
        rowCount: result.rowCount,
        productName: productCheck.rows[0].name,
        message: result.rows.length > 0
          ? `Suggested warehouse: ${result.rows[0].warehouse_name} (stock: ${result.rows[0].current_stock}, distance: ${result.rows[0].distance_km} km)`
          : 'No warehouse found with sufficient stock for the required quantity',
      },
      executionTimeMs,
    });
  } catch (error: any) {
    results.push({
      sql: formatSqlWithParams(sql, sqlParams),
      result: null,
      executionTimeMs: Date.now() - start,
      error: error.message,
    });
  }

  return results;
}

async function executeMoveStockAdvanced(params: Record<string, any>): Promise<DemoExecutionResult[]> {
  const results: DemoExecutionResult[] = [];

  const { from_warehouse_id, to_warehouse_id, product_id, quantity, lot_id, user_id } = params;

  if (!quantity || Number(quantity) < 1) {
    throw new AppError(400, 'Invalid parameter: quantity must be >= 1');
  }
  if (!from_warehouse_id) {
    throw new AppError(400, 'Invalid parameter: from_warehouse_id is required');
  }
  if (!to_warehouse_id) {
    throw new AppError(400, 'Invalid parameter: to_warehouse_id is required');
  }
  if (!product_id) {
    throw new AppError(400, 'Invalid parameter: product_id is required');
  }

  // Execute within a transaction and ROLLBACK to avoid modifying data
  const client = await getClient();

  try {
    await client.query('BEGIN');
    // Set app context so RLS policies on inventory (triggered by move_stock_advanced) pass.
    await client.query("SET LOCAL app.current_user_id = '1'");
    results.push({
      sql: 'BEGIN',
      result: { message: 'Transaction started (will ROLLBACK to preserve data)' },
      executionTimeMs: 0,
    });

    const sql = `SELECT move_stock_advanced($1, $2, $3, $4, $5, $6) as result`;
    const sqlParams = [
      Number(product_id),
      Number(from_warehouse_id),
      Number(to_warehouse_id),
      lot_id ? Number(lot_id) : null,
      Number(quantity),
      user_id ? Number(user_id) : 1,
    ];

    const start = Date.now();
    try {
      const result = await client.query(sql, sqlParams);
      const executionTimeMs = Date.now() - start;

      // Get updated inventory for both warehouses
      const invSql = `
        SELECT i.product_id, i.warehouse_id, i.quantity, i.lot_id,
               p.name as product_name, w.name as warehouse_name
        FROM inventory i
        JOIN products p ON i.product_id = p.product_id
        JOIN warehouses w ON i.warehouse_id = w.warehouse_id
        WHERE i.product_id = $1
          AND i.warehouse_id IN ($2, $3)
      `;
      const invResult = await client.query(invSql, [Number(product_id), Number(from_warehouse_id), Number(to_warehouse_id)]);

      results.push({
        sql: formatSqlWithParams(sql, sqlParams),
        result: {
          functionResult: result.rows[0]?.result,
          updatedInventory: invResult.rows,
          message: 'move_stock_advanced executed successfully',
        },
        executionTimeMs,
      });
    } catch (error: any) {
      results.push({
        sql: formatSqlWithParams(sql, sqlParams),
        result: null,
        executionTimeMs: Date.now() - start,
        error: error.message,
      });
    }

    // ROLLBACK
    await client.query('ROLLBACK');
    results.push({
      sql: 'ROLLBACK',
      result: { message: 'Transaction rolled back. No data was modified.' },
      executionTimeMs: 0,
    });

    return results;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw new AppError(500, `move_stock_advanced demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

async function executeCalculateDistance(params: Record<string, any>): Promise<DemoExecutionResult[]> {
  const results: DemoExecutionResult[] = [];

  const { lat1, lon1, lat2, lon2 } = params;

  if (lat1 === undefined || lat1 === null || Number(lat1) < -90 || Number(lat1) > 90) {
    throw new AppError(400, 'Invalid parameter: lat1 must be between -90 and 90');
  }
  if (lon1 === undefined || lon1 === null || Number(lon1) < -180 || Number(lon1) > 180) {
    throw new AppError(400, 'Invalid parameter: lon1 must be between -180 and 180');
  }
  if (lat2 === undefined || lat2 === null || Number(lat2) < -90 || Number(lat2) > 90) {
    throw new AppError(400, 'Invalid parameter: lat2 must be between -90 and 90');
  }
  if (lon2 === undefined || lon2 === null || Number(lon2) < -180 || Number(lon2) > 180) {
    throw new AppError(400, 'Invalid parameter: lon2 must be between -180 and 180');
  }

  const sql = `SELECT calculate_distance($1, $2, $3, $4) as distance_km`;
  const sqlParams = [Number(lat1), Number(lon1), Number(lat2), Number(lon2)];

  const start = Date.now();
  try {
    const result = await query(sql, sqlParams);
    const executionTimeMs = Date.now() - start;

    results.push({
      sql: formatSqlWithParams(sql, sqlParams),
      result: {
        distance_km: result.rows[0]?.distance_km,
        message: `Distance between (${lat1}, ${lon1}) and (${lat2}, ${lon2}): ${result.rows[0]?.distance_km} km`,
      },
      executionTimeMs,
    });
  } catch (error: any) {
    results.push({
      sql: formatSqlWithParams(sql, sqlParams),
      result: null,
      executionTimeMs: Date.now() - start,
      error: error.message,
    });
  }

  return results;
}

// ─── Partial Indexes Demo ────────────────────────────────────────────────────

/**
 * Demonstrates partial index performance by comparing EXPLAIN ANALYZE output
 * with and without the idx_inventory_low_stock index.
 */
export async function partialIndexesDemo(): Promise<{
  withIndex: DemoExecutionResult;
  withoutIndex: DemoExecutionResult;
  indexMetadata: DemoExecutionResult;
  comparison: {
    withIndex: { scanType: string; executionTimeMs: number; cost: string; rowsScanned: number };
    withoutIndex: { scanType: string; executionTimeMs: number; cost: string; rowsScanned: number };
    speedup: string;
    costRatio: number;
    totalRows: number;
    indexSize: string;
    tableSize: string;
    indexVsTablePct: string;
    rowsScanRatio: string | null;
    explanation: string;
  };
}> {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    // Set app context so RLS on inventory passes for all queries in this demo
    await client.query('SET LOCAL app.current_user_id = 1');

    const querySql = `SELECT * FROM inventory WHERE quantity <= reorder_point`;
    const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${querySql}`;
    const RUNS = 20;

    // 1. Run WITH index
    let withIndexTotalMs = 0;
    let withIndexPlan = '';
    for (let i = 0; i < RUNS; i++) {
      const t = Date.now();
      const r = await client.query(explainSql);
      withIndexTotalMs += Date.now() - t;
      if (i === RUNS - 1) withIndexPlan = r.rows.map((row: any) => row['QUERY PLAN']).join('\n');
    }
    const withIndexAvgMs = withIndexTotalMs / RUNS;

    // 2. Force seq scan and run WITHOUT index
    await client.query('SET LOCAL enable_indexscan = off');
    await client.query('SET LOCAL enable_bitmapscan = off');
    let withoutIndexTotalMs = 0;
    let withoutIndexPlan = '';
    for (let i = 0; i < RUNS; i++) {
      const t = Date.now();
      const r = await client.query(explainSql);
      withoutIndexTotalMs += Date.now() - t;
      if (i === RUNS - 1) withoutIndexPlan = r.rows.map((row: any) => row['QUERY PLAN']).join('\n');
    }
    const withoutIndexAvgMs = withoutIndexTotalMs / RUNS;
    await client.query('RESET enable_indexscan');
    await client.query('RESET enable_bitmapscan');

    // 3. Index metadata
    const indexMetaSql = `
      SELECT indexname, tablename, indexdef,
             pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size
      FROM pg_indexes
      WHERE indexname = 'idx_inventory_low_stock'
    `;
    const indexMetaStart = Date.now();
    const indexMetaResult = await client.query(indexMetaSql);
    const indexMetaTime = Date.now() - indexMetaStart;

    // 4. Total rows + index/table size (inside transaction so RLS passes)
    const totalRowsResult = await client.query('SELECT COUNT(*) as total FROM inventory');
    const totalRows = parseInt(totalRowsResult.rows[0].total, 10);

    const sizeResult = await client.query(
      `SELECT pg_size_pretty(pg_relation_size('idx_inventory_low_stock')) AS index_size,
              pg_size_pretty(pg_total_relation_size('inventory')) AS table_total_size,
              pg_relation_size('idx_inventory_low_stock') AS index_bytes,
              pg_total_relation_size('inventory') AS table_bytes`
    );
    const indexSize = sizeResult.rows[0]?.index_size || 'N/A';
    const tableSize = sizeResult.rows[0]?.table_total_size || 'N/A';
    const indexBytes = parseInt(sizeResult.rows[0]?.index_bytes || '0', 10);
    const tableBytes = parseInt(sizeResult.rows[0]?.table_bytes || '0', 10);
    const indexVsTablePct = tableBytes > 0 ? ((indexBytes / tableBytes) * 100).toFixed(1) : '0';

    await client.query('ROLLBACK');

    // Parse plans
    const withIndexScanType = parseScanType(withIndexPlan);
    const withoutIndexScanType = parseScanType(withoutIndexPlan);
    const withIndexExecTime = parseExecutionTime(withIndexPlan);
    const withoutIndexExecTime = parseExecutionTime(withoutIndexPlan);
    const withIndexCost = parseCost(withIndexPlan);
    const withoutIndexCost = parseCost(withoutIndexPlan);

    // Parse actual rows scanned from EXPLAIN ANALYZE output
    const parseRowsScanned = (plan: string): number => {
      const match = plan.match(/actual time=[\d.]+\.\.[\d.]+ rows=(\d+)/);
      if (match) return parseInt(match[1], 10);
      const fallback = plan.match(/rows=(\d+)/);
      return fallback ? parseInt(fallback[1], 10) : 0;
    };
    const withIndexRowsScanned = parseRowsScanned(withIndexPlan);
    const withoutIndexRowsScanned = parseRowsScanned(withoutIndexPlan);

    // Cost ratio — planner cost is the most meaningful metric for small tables
    const withIndexCostNum = parseFloat(withIndexCost.split('..')[1] || '0');
    const withoutIndexCostNum = parseFloat(withoutIndexCost.split('..')[1] || '0');
    let speedup: string;
    let costRatio: number;
    if (withIndexCostNum > 0 && withoutIndexCostNum > 0) {
      costRatio = withoutIndexCostNum / withIndexCostNum;
      speedup = costRatio > 1
        ? `${costRatio.toFixed(2)}x lower planner cost with index`
        : `Costs similar at this scale — index advantage grows with table size`;
    } else {
      costRatio = 1;
      speedup = `Cost: with index ${withIndexCost} vs without ${withoutIndexCost}`;
    }

    const rowsScanRatio = (withoutIndexRowsScanned > 0 && withIndexRowsScanned > 0)
      ? (withoutIndexRowsScanned / withIndexRowsScanned).toFixed(1)
      : null;

    return {
      withIndex: {
        sql: `-- Run ${RUNS}x with partial index\n${explainSql}`,
        result: { plan: withIndexPlan, scanType: withIndexScanType, executionTimeMs: parseFloat(withIndexExecTime.toFixed(3)), cost: withIndexCost, note: `Average of ${RUNS} runs` },
        executionTimeMs: parseFloat(withIndexAvgMs.toFixed(3)),
      },
      withoutIndex: {
        sql: `-- Run ${RUNS}x without index (forced Seq Scan)\nSET LOCAL enable_indexscan = off;\nSET LOCAL enable_bitmapscan = off;\n${explainSql}`,
        result: { plan: withoutIndexPlan, scanType: withoutIndexScanType, executionTimeMs: parseFloat(withoutIndexExecTime.toFixed(3)), cost: withoutIndexCost, note: `Average of ${RUNS} runs` },
        executionTimeMs: parseFloat(withoutIndexAvgMs.toFixed(3)),
      },
      indexMetadata: {
        sql: indexMetaSql.trim(),
        result: { rows: indexMetaResult.rows, rowCount: indexMetaResult.rowCount },
        executionTimeMs: indexMetaTime,
      },
      comparison: {
        withIndex: { scanType: withIndexScanType, executionTimeMs: parseFloat(withIndexExecTime.toFixed(3)), cost: withIndexCost, rowsScanned: withIndexRowsScanned },
        withoutIndex: { scanType: withoutIndexScanType, executionTimeMs: parseFloat(withoutIndexExecTime.toFixed(3)), cost: withoutIndexCost, rowsScanned: withoutIndexRowsScanned },
        speedup,
        costRatio: parseFloat(costRatio.toFixed(2)),
        totalRows,
        indexSize,
        tableSize,
        indexVsTablePct,
        rowsScanRatio,
        explanation: `Index reads only ${withIndexRowsScanned} matching rows out of ${totalRows} total. Seq scan reads all ${totalRows} rows. Index is ${indexSize} vs table ${tableSize} (${indexVsTablePct}% of table size).`,
      },
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw new AppError(500, `Partial indexes demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Parse the scan type from an EXPLAIN ANALYZE output.
 */
function parseScanType(plan: string): string {
  if (plan.includes('Index Scan') || plan.includes('Index Only Scan')) {
    const match = plan.match(/(Index(?:\sOnly)?\sScan(?:\sBackward)?\susing\s\S+)/);
    return match ? match[1] : 'Index Scan';
  }
  if (plan.includes('Bitmap Heap Scan')) {
    const indexMatch = plan.match(/Bitmap Index Scan on (\S+)/);
    return indexMatch ? `Bitmap Heap Scan (via ${indexMatch[1]})` : 'Bitmap Heap Scan';
  }
  if (plan.includes('Seq Scan')) {
    return 'Seq Scan';
  }
  return 'Unknown';
}

/**
 * Parse execution time from EXPLAIN ANALYZE output.
 */
function parseExecutionTime(plan: string): number {
  const match = plan.match(/Execution Time:\s*([\d.]+)\s*ms/);
  return match ? parseFloat(match[1]) : 0;
}

/**
 * Parse cost from EXPLAIN ANALYZE output.
 */
function parseCost(plan: string): string {
  const match = plan.match(/cost=([\d.]+)\.\.([\d.]+)/);
  return match ? `${match[1]}..${match[2]}` : 'N/A';
}

// ─── Materialized Views Demo ─────────────────────────────────────────────────

/**
 * The materialized view name used for demos.
 * This view aggregates inventory summary by warehouse.
 */
const MV_NAME = 'mv_inventory_summary';

/**
 * SQL to create the materialized view if it doesn't exist.
 * Aggregates inventory data by warehouse for fast reporting.
 */
const MV_CREATE_SQL = `
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_inventory_summary AS
SELECT
  w.warehouse_id,
  w.name AS warehouse_name,
  w.warehouse_type,
  COUNT(DISTINCT i.product_id) AS product_count,
  COALESCE(SUM(i.quantity), 0) AS total_quantity,
  COUNT(CASE WHEN i.quantity <= i.reorder_point THEN 1 END) AS low_stock_count
FROM warehouses w
LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
WHERE w.is_active = true
GROUP BY w.warehouse_id, w.name, w.warehouse_type
WITH DATA
`;

/**
 * Ensures the materialized view exists, creating it if necessary.
 * Also creates a unique index required for CONCURRENTLY refresh.
 */
async function ensureMaterializedView(client: PoolClient): Promise<void> {
  // Check if MV exists
  const checkResult = await client.query(
    `SELECT matviewname FROM pg_matviews WHERE matviewname = $1`,
    [MV_NAME]
  );

  if (checkResult.rows.length === 0) {
    await client.query(MV_CREATE_SQL);
    // Create unique index required for REFRESH CONCURRENTLY
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_inventory_summary_wh ON mv_inventory_summary (warehouse_id)`
    );
  }
}

/**
 * Refreshes the materialized view concurrently.
 * Returns execution time in ms.
 */
export async function refreshMaterializedView(): Promise<DemoExecutionResult> {
  const client = await getClient();

  try {
    await ensureMaterializedView(client);

    const sql = `REFRESH MATERIALIZED VIEW CONCURRENTLY ${MV_NAME}`;
    const start = Date.now();

    try {
      await client.query(sql);
      const executionTimeMs = Date.now() - start;

      // Get last refresh time
      const refreshTimeResult = await client.query(
        `SELECT pg_stat_get_last_analyze_time(c.oid) as last_refresh
         FROM pg_class c WHERE c.relname = $1`,
        [MV_NAME]
      );

      return {
        sql,
        result: {
          message: `Materialized view '${MV_NAME}' refreshed successfully`,
          executionTimeMs,
          lastRefresh: refreshTimeResult.rows[0]?.last_refresh || new Date().toISOString(),
        },
        executionTimeMs,
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - start;
      return {
        sql,
        result: null,
        executionTimeMs,
        error: error.message,
      };
    }
  } finally {
    client.release();
  }
}

/**
 * Compares EXPLAIN ANALYZE output between querying the MV and the base tables.
 * Returns side-by-side comparison with execution times.
 */
export async function compareMaterializedView(): Promise<{
  mvQuery: DemoExecutionResult;
  baseQuery: DemoExecutionResult;
  comparison: {
    mvExecutionTimeMs: number;
    baseExecutionTimeMs: number;
    speedup: string;
    mvScanType: string;
    baseScanType: string;
  };
}> {
  const client = await getClient();

  try {
    await ensureMaterializedView(client);

    const RUNS = 30;

    // Query the materialized view (multiple runs for stable timing)
    const mvSql = `SELECT * FROM ${MV_NAME} ORDER BY warehouse_name`;
    const mvExplainSql = `EXPLAIN (ANALYZE, BUFFERS) ${mvSql}`;

    let mvTotalMs = 0;
    let mvPlan = '';
    for (let i = 0; i < RUNS; i++) {
      const t = Date.now();
      const r = await client.query(mvExplainSql);
      mvTotalMs += Date.now() - t;
      if (i === RUNS - 1) mvPlan = r.rows.map((row: any) => row['QUERY PLAN']).join('\n');
    }
    const mvAvgMs = mvTotalMs / RUNS;

    // Equivalent base table query (multiple runs)
    const baseSql = `
SELECT
  w.warehouse_id,
  w.name AS warehouse_name,
  w.warehouse_type,
  COUNT(DISTINCT i.product_id) AS product_count,
  COALESCE(SUM(i.quantity), 0) AS total_quantity,
  COUNT(CASE WHEN i.quantity <= i.reorder_point THEN 1 END) AS low_stock_count
FROM warehouses w
LEFT JOIN inventory i ON w.warehouse_id = i.warehouse_id
WHERE w.is_active = true
GROUP BY w.warehouse_id, w.name, w.warehouse_type
ORDER BY w.name`;
    const baseExplainSql = `EXPLAIN (ANALYZE, BUFFERS) ${baseSql}`;

    let baseTotalMs = 0;
    let basePlan = '';
    for (let i = 0; i < RUNS; i++) {
      const t = Date.now();
      const r = await client.query(baseExplainSql);
      baseTotalMs += Date.now() - t;
      if (i === RUNS - 1) basePlan = r.rows.map((row: any) => row['QUERY PLAN']).join('\n');
    }
    const baseAvgMs = baseTotalMs / RUNS;

    const mvExecTime = parseExecutionTime(mvPlan);
    const baseExecTime = parseExecutionTime(basePlan);
    const mvCost = parseCost(mvPlan);
    const baseCost = parseCost(basePlan);

    // Compare planner cost (more reliable than wall-clock for small data)
    const mvCostNum = parseFloat(mvCost.split('..')[1] || '0');
    const baseCostNum = parseFloat(baseCost.split('..')[1] || '0');

    let speedup: string;
    if (baseCostNum > 0 && mvCostNum > 0) {
      const ratio = baseCostNum / mvCostNum;
      speedup = ratio > 1
        ? `${ratio.toFixed(2)}x lower planner cost with MV`
        : `Base query cost: ${baseCost} vs MV cost: ${mvCost} (MV overhead on small data — scales better with large datasets)`;
    } else if (baseExecTime > 0 && mvExecTime > 0) {
      const ratio = baseExecTime / mvExecTime;
      speedup = ratio > 1
        ? `${ratio.toFixed(2)}x faster with MV (avg ${RUNS} runs)`
        : `${(1 / ratio).toFixed(2)}x MV overhead (data too small — MV shines at scale)`;
    } else {
      speedup = `MV cost: ${mvCost} | Base cost: ${baseCost}`;
    }

    return {
      mvQuery: {
        sql: `-- Average of ${RUNS} runs\n${mvExplainSql}`,
        result: {
          plan: mvPlan,
          scanType: parseScanType(mvPlan),
          executionTimeMs: parseFloat(mvAvgMs.toFixed(3)),
          cost: mvCost,
          note: `Avg ${RUNS} runs — reads pre-computed table, no JOIN`,
        },
        executionTimeMs: parseFloat(mvAvgMs.toFixed(3)),
      },
      baseQuery: {
        sql: `-- Average of ${RUNS} runs\n${baseExplainSql}`,
        result: {
          plan: basePlan,
          scanType: parseScanType(basePlan),
          executionTimeMs: parseFloat(baseAvgMs.toFixed(3)),
          cost: baseCost,
          note: `Avg ${RUNS} runs — requires JOIN + GROUP BY every time`,
        },
        executionTimeMs: parseFloat(baseAvgMs.toFixed(3)),
      },
      comparison: {
        mvExecutionTimeMs: parseFloat(mvAvgMs.toFixed(3)),
        baseExecutionTimeMs: parseFloat(baseAvgMs.toFixed(3)),
        speedup,
        mvScanType: parseScanType(mvPlan),
        baseScanType: parseScanType(basePlan),
      },
    };
  } catch (error: any) {
    throw new AppError(500, `Materialized view comparison failed: ${error.message}`);
  } finally {
    client.release();
  }
}

// ─── Audit Demo ──────────────────────────────────────────────────────────────

/**
 * Demonstrates audit logging by performing a sample UPDATE on a product record
 * within a transaction, capturing the resulting audit_log entry, then rolling back.
 */
export async function auditDemo(): Promise<DemoExecutionResult[]> {
  const client = await getClient();
  const results: DemoExecutionResult[] = [];

  try {
    // BEGIN
    await client.query('BEGIN');
    results.push({
      sql: 'BEGIN',
      result: { message: 'Transaction started (will ROLLBACK after capturing audit entry)' },
      executionTimeMs: 0,
    });

    // Set app context for audit trigger
    await client.query("SET LOCAL app.current_user_id = '1'");
    results.push({
      sql: "SET LOCAL app.current_user_id = '1'",
      result: { message: 'Set session user context for audit trigger' },
      executionTimeMs: 0,
    });

    // Find a product to update
    const findSql = `SELECT product_id, name, unit_cost, unit_price FROM products WHERE is_active = true LIMIT 1`;
    const findResult = await executeDemoSql(client, findSql);
    results.push(findResult);

    if (findResult.error || !(findResult.result as any)?.rows?.length) {
      await client.query('ROLLBACK');
      client.release();
      results.push({
        sql: 'ROLLBACK',
        result: { message: 'No active product found for audit demo.' },
        executionTimeMs: 0,
      });
      return results;
    }

    const product = (findResult.result as any).rows[0];

    // Record max audit log ID before the update
    const maxLogResult = await client.query('SELECT COALESCE(MAX(log_id), 0) as max_id FROM audit_logs');
    const maxLogIdBefore = maxLogResult.rows[0].max_id;

    // Perform UPDATE on the product (change unit_cost slightly)
    const newCost = (parseFloat(product.unit_cost) + 1.5).toFixed(2);
    const updateSql = `
      UPDATE products
      SET unit_cost = $1
      WHERE product_id = $2
      RETURNING product_id, name, unit_cost
    `;
    const updateResult = await executeDemoSql(client, updateSql, [newCost, product.product_id]);
    results.push(updateResult);

    // Query the resulting audit_log entry
    const auditSql = `
      SELECT log_id, user_id, action, table_name, record_id,
             old_value, new_value, ip_address, created_at
      FROM audit_logs
      WHERE log_id > $1
        AND table_name = 'products'
        AND record_id = $2
      ORDER BY log_id DESC
      LIMIT 1
    `;
    const auditResult = await executeDemoSql(client, auditSql, [maxLogIdBefore, product.product_id]);
    results.push(auditResult);

    // Compute JSONB diff if audit entry exists
    const auditRows = (auditResult.result as any)?.rows || [];
    let jsonbDiff: any = null;
    if (auditRows.length > 0) {
      const oldValue = auditRows[0].old_value;
      const newValue = auditRows[0].new_value;
      if (oldValue && newValue) {
        jsonbDiff = computeJsonbDiff(oldValue, newValue);
      }
    }

    // ROLLBACK
    await client.query('ROLLBACK');
    results.push({
      sql: 'ROLLBACK',
      result: { message: 'Transaction rolled back. Product and audit_log changes discarded.' },
      executionTimeMs: 0,
    });

    // Summary
    results.push({
      sql: '-- Summary: Audit Logging with JSONB Diff',
      result: {
        explanation: 'Updated a product record within a transaction. The audit trigger automatically captured the old and new values as JSONB. The diff shows exactly which fields changed.',
        product: { id: product.product_id, name: product.name },
        originalCost: product.unit_cost,
        newCost,
        auditEntry: auditRows.length > 0 ? auditRows[0] : null,
        jsonbDiff,
      },
      executionTimeMs: 0,
    });

    return results;
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    throw new AppError(500, `Audit demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

/**
 * Compute a diff between two JSONB objects, identifying changed, added, and removed keys.
 */
function computeJsonbDiff(oldValue: Record<string, any>, newValue: Record<string, any>): {
  changed: Record<string, { old: any; new: any }>;
  added: Record<string, any>;
  removed: Record<string, any>;
} {
  const changed: Record<string, { old: any; new: any }> = {};
  const added: Record<string, any> = {};
  const removed: Record<string, any> = {};

  const allKeys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);

  for (const key of allKeys) {
    const oldVal = oldValue[key];
    const newVal = newValue[key];

    if (!(key in oldValue)) {
      added[key] = newVal;
    } else if (!(key in newValue)) {
      removed[key] = oldVal;
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changed[key] = { old: oldVal, new: newVal };
    }
  }

  return { changed, added, removed };
}

// ─── pgvector Demo ───────────────────────────────────────────────────────────

/**
 * Demonstrates pgvector semantic search with SQL display.
 * Accepts a query text, generates embedding, executes cosine similarity search.
 */
export async function pgvectorDemo(queryText: string): Promise<DemoExecutionResult[]> {
  const results: DemoExecutionResult[] = [];

  if (!queryText || queryText.trim().length < 2) {
    throw new AppError(400, 'Query text must be at least 2 characters long');
  }

  // Step 1: Generate embedding
  let embedding: number[];
  const embeddingStart = Date.now();
  try {
    embedding = await generateEmbedding(queryText.trim());
    results.push({
      sql: `-- Generate embedding for: "${queryText.trim()}"`,
      result: {
        message: 'Embedding generated successfully',
        dimensions: embedding.length,
        sampleValues: embedding.slice(0, 5),
      },
      executionTimeMs: Date.now() - embeddingStart,
    });
  } catch (error: any) {
    results.push({
      sql: `-- Generate embedding for: "${queryText.trim()}"`,
      result: null,
      executionTimeMs: Date.now() - embeddingStart,
      error: error.message,
    });
    return results;
  }

  // Step 2: Execute cosine similarity search
  const vectorStr = `[${embedding.join(',')}]`;
  const searchSql = `
SELECT product_id, name, sku, category,
       1 - (embedding <=> $1::vector) AS similarity
FROM products
WHERE embedding IS NOT NULL
  AND 1 - (embedding <=> $1::vector) >= 0.3
ORDER BY similarity DESC
LIMIT 20`;

  // Display SQL with the vector operator visible
  const displaySql = `SELECT product_id, name, sku, category,\n       1 - (embedding <=> '[...]'::vector) AS similarity\nFROM products\nWHERE embedding IS NOT NULL\n  AND 1 - (embedding <=> '[...]'::vector) >= 0.3\nORDER BY similarity DESC\nLIMIT 20`;

  const searchStart = Date.now();
  try {
    const searchResult = await query(searchSql, [vectorStr]);
    const executionTimeMs = Date.now() - searchStart;

    results.push({
      sql: displaySql,
      result: {
        rows: searchResult.rows.map((row: any) => ({
          product_id: row.product_id,
          name: row.name,
          sku: row.sku,
          category: row.category,
          similarity: parseFloat(Number(row.similarity).toFixed(4)),
        })),
        rowCount: searchResult.rowCount,
        message: searchResult.rows.length > 0
          ? `Found ${searchResult.rows.length} products matching "${queryText.trim()}"`
          : 'No matching products found with similarity >= 0.3',
        operator: '<=> (cosine distance operator from pgvector)',
      },
      executionTimeMs,
    });
  } catch (error: any) {
    results.push({
      sql: displaySql,
      result: null,
      executionTimeMs: Date.now() - searchStart,
      error: error.message,
    });
  }

  return results;
}

// ─── RLS Demo ────────────────────────────────────────────────────────────────

/**
 * Demonstrates Row Level Security by setting session variables for different roles
 * and querying inventory to show how RLS policies restrict access.
 */
export async function rlsDemo(): Promise<{
  explanation: string;
  policies: DemoExecutionResult;
  roles: Array<{
    role: string;
    userId: number;
    sql: string;
    rowCount: number;
    sampleRows: any[];
    executionTimeMs: number;
  }>;
}> {
  const client = await getClient();

  try {
    // Get RLS policy definitions
    const policySql = `
      SELECT polname AS policy_name,
             CASE polcmd
               WHEN 'r' THEN 'SELECT'
               WHEN 'a' THEN 'INSERT'
               WHEN 'w' THEN 'UPDATE'
               WHEN 'd' THEN 'DELETE'
               WHEN '*' THEN 'ALL'
             END AS command,
             pg_get_expr(polqual, polrelid) AS using_expression,
             pg_get_expr(polwithcheck, polrelid) AS with_check_expression
      FROM pg_policy
      WHERE polrelid = 'inventory'::regclass
      ORDER BY polname
    `;
    const policyStart = Date.now();
    const policyResult = await client.query(policySql);
    const policyTime = Date.now() - policyStart;

    // Get users for different roles
    const usersResult = await client.query(`
      SELECT user_id, username, full_name, role, assigned_warehouse_id
      FROM users
      WHERE is_active = true
      ORDER BY
        CASE role
          WHEN 'staff' THEN 1
          WHEN 'warehouse_manager' THEN 2
          WHEN 'admin' THEN 3
        END
      LIMIT 3
    `);

    // Build role demos - query inventory with different user contexts
    const roleResults: Array<{
      role: string;
      userId: number;
      sql: string;
      rowCount: number;
      sampleRows: any[];
      executionTimeMs: number;
    }> = [];

    // Define demo roles - use actual users if available, otherwise simulate
    const demoRoles = [
      { role: 'staff', userId: 0 },
      { role: 'warehouse_manager', userId: 0 },
      { role: 'admin', userId: 0 },
    ];

    // Map actual users to roles
    for (const user of usersResult.rows) {
      const roleEntry = demoRoles.find((r) => r.role === user.role);
      if (roleEntry && roleEntry.userId === 0) {
        roleEntry.userId = user.user_id;
      }
    }

    // If no users found for some roles, use fallback IDs
    if (demoRoles[0].userId === 0) demoRoles[0].userId = 3; // staff
    if (demoRoles[1].userId === 0) demoRoles[1].userId = 2; // manager
    if (demoRoles[2].userId === 0) demoRoles[2].userId = 1; // admin

    // Sample query — used for sampleRows (LIMIT 5)
    const inventorySql = `
      SELECT i.inventory_id, i.product_id, i.warehouse_id, i.quantity,
             p.name AS product_name, w.name AS warehouse_name
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
      ORDER BY i.inventory_id
      LIMIT 5
    `;

    // Count query — must use the same JOIN structure so RLS USING clause is evaluated.
    // A bare COUNT(*) FROM inventory without joins can be optimized away by the planner,
    // bypassing RLS. Joining products and warehouses forces a sequential scan with policy checks.
    const countSql = `
      SELECT COUNT(*) AS total
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    `;

    for (const demoRole of demoRoles) {
      await client.query('BEGIN');

      // SET LOCAL scopes the variable to this transaction only — safe with connection pooling.
      const setContextSql = `SET LOCAL app.current_user_id = '${demoRole.userId}'`;
      await client.query(setContextSql);

      const roleStart = Date.now();
      try {
        // Run both queries inside the same transaction so SET LOCAL applies to both
        const [roleResult, countResult] = await Promise.all([
          client.query(inventorySql),
          client.query(countSql),
        ]);
        const roleTime = Date.now() - roleStart;

        roleResults.push({
          role: demoRole.role,
          userId: demoRole.userId,
          sql: `${setContextSql};\n${inventorySql.trim()}`,
          rowCount: parseInt(countResult.rows[0].total, 10),
          sampleRows: roleResult.rows,
          executionTimeMs: roleTime,
        });
      } catch (error: any) {
        roleResults.push({
          role: demoRole.role,
          userId: demoRole.userId,
          sql: `${setContextSql};\n${inventorySql.trim()}`,
          rowCount: 0,
          sampleRows: [],
          executionTimeMs: Date.now() - roleStart,
        });
      }

      await client.query('ROLLBACK');
    }

    return {
      explanation: 'Row Level Security (RLS) restricts which rows a user can see based on their role. Staff can only see inventory in their assigned warehouse. Warehouse managers can see inventory in warehouses they manage. Admins can see all inventory.',
      policies: {
        sql: policySql.trim(),
        result: {
          rows: policyResult.rows,
          rowCount: policyResult.rowCount,
        },
        executionTimeMs: policyTime,
      },
      roles: roleResults,
    };
  } catch (error: any) {
    throw new AppError(500, `RLS demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

// ─── Partitioning Demo ───────────────────────────────────────────────────────

/**
 * Demonstrates table partitioning by executing EXPLAIN ANALYZE on a date-filtered
 * query on stock_movements, showing partition pruning in the execution plan.
 */
export async function partitioningDemo(): Promise<{
  explanation: string;
  partitions: DemoExecutionResult;
  queryPlan: DemoExecutionResult;
  partitionPruning: {
    prunedPartitions: string[];
    scannedPartitions: string[];
    executionTimeMs: number;
  };
}> {
  const client = await getClient();

  try {
    // Get partition info
    const partitionSql = `
      SELECT
        child.relname AS partition_name,
        pg_get_expr(child.relpartbound, child.oid) AS partition_range,
        pg_size_pretty(pg_relation_size(child.oid)) AS size
      FROM pg_inherits
      JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
      JOIN pg_class child ON pg_inherits.inhrelid = child.oid
      WHERE parent.relname = 'stock_movements'
      ORDER BY child.relname
    `;
    const partitionStart = Date.now();
    const partitionResult = await client.query(partitionSql);
    const partitionTime = Date.now() - partitionStart;

    // Execute EXPLAIN ANALYZE with a date filter that should trigger partition pruning
    // Query only 2025 data — should prune 2024, 2026, and default partitions
    const querySql = `
SELECT sm.movement_id, sm.product_id, sm.warehouse_id, sm.change_amount,
       sm.movement_type, sm.created_at
FROM stock_movements sm
WHERE sm.created_at >= '2025-01-01' AND sm.created_at < '2026-01-01'
ORDER BY sm.created_at DESC
LIMIT 20`;
    const explainSql = `EXPLAIN ANALYZE ${querySql}`;

    const explainStart = Date.now();
    const explainResult = await client.query(explainSql);
    const explainTime = Date.now() - explainStart;
    const plan = explainResult.rows.map((r: any) => r['QUERY PLAN']).join('\n');

    // Parse which partitions were scanned vs pruned
    const allPartitions = partitionResult.rows.map((r: any) => r.partition_name);
    const scannedPartitions: string[] = [];
    const prunedPartitions: string[] = [];

    for (const partition of allPartitions) {
      if (plan.includes(partition)) {
        scannedPartitions.push(partition);
      } else {
        prunedPartitions.push(partition);
      }
    }

    const execTime = parseExecutionTime(plan);

    return {
      explanation: 'The stock_movements table is range-partitioned by created_at (yearly: 2024, 2025, 2026, default). When querying with a date filter, PostgreSQL prunes partitions that cannot contain matching rows, scanning only the relevant partition(s).',
      partitions: {
        sql: partitionSql.trim(),
        result: {
          rows: partitionResult.rows,
          rowCount: partitionResult.rowCount,
        },
        executionTimeMs: partitionTime,
      },
      queryPlan: {
        sql: explainSql,
        result: {
          plan,
          executionTimeMs: execTime,
          dateFilter: "created_at >= '2025-01-01' AND created_at < '2026-01-01'",
        },
        executionTimeMs: explainTime,
      },
      partitionPruning: {
        prunedPartitions,
        scannedPartitions,
        executionTimeMs: execTime,
      },
    };
  } catch (error: any) {
    throw new AppError(500, `Partitioning demo failed: ${error.message}`);
  } finally {
    client.release();
  }
}

// ─── Reset Demo Data ─────────────────────────────────────────────────────────

/**
 * Resets demo-specific data by cleaning up records created during demos
 * and re-seeding with initial demo data.
 */
export async function resetDemoData(): Promise<DemoExecutionResult> {
  const client = await getClient();
  const start = Date.now();

  try {
    await client.query('BEGIN');

    // Clean up demo-specific stock movements (those with reference_type containing 'demo')
    await client.query(`
      DELETE FROM stock_movements
      WHERE reference_type LIKE '%demo%'
        OR reference_type LIKE '%trigger_demo%'
    `);

    // Clean up any demo purchase orders (those with note containing 'demo')
    await client.query(`
      DELETE FROM order_items
      WHERE order_id IN (
        SELECT order_id FROM purchase_orders WHERE note LIKE '%demo%'
      )
    `);
    await client.query(`
      DELETE FROM purchase_orders WHERE note LIKE '%demo%'
    `);

    // Refresh the materialized view if it exists
    const mvExists = await client.query(
      `SELECT 1 FROM pg_matviews WHERE matviewname = $1`,
      [MV_NAME]
    );
    if (mvExists.rows.length > 0) {
      await client.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${MV_NAME}`);
    }

    await client.query('COMMIT');
    const executionTimeMs = Date.now() - start;

    return {
      sql: '-- Reset Demo Data: Cleaned demo stock_movements, demo purchase_orders, refreshed MV',
      result: {
        message: 'Demo data has been reset successfully. All demo-specific records have been cleaned up.',
        actionsPerformed: [
          'Deleted stock_movements with demo reference_type',
          'Deleted demo purchase_orders and their order_items',
          'Refreshed materialized view (if exists)',
        ],
      },
      executionTimeMs,
    };
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    const executionTimeMs = Date.now() - start;
    return {
      sql: '-- Reset Demo Data (FAILED)',
      result: null,
      executionTimeMs,
      error: error.message,
    };
  } finally {
    client.release();
  }
}
