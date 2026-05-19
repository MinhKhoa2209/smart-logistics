import { PoolClient } from 'pg';
import { query } from '../config/database';

/**
 * Transfer Orders repository — handles all database queries for the transfers domain.
 */

export interface TransferOrderRow {
  transfer_id: number;
  from_warehouse_id: number;
  from_warehouse_name: string;
  to_warehouse_id: number;
  to_warehouse_name: string;
  status: string;
  completed_at: string | null;
  created_by: number | null;
  created_by_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransferItemRow {
  transfer_item_id: number;
  transfer_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  received_quantity: number;
}

export interface TransferOrderDetailRow extends TransferOrderRow {
  items: TransferItemRow[];
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  status?: string;
  from_warehouse_id?: number;
  to_warehouse_id?: number;
}

/**
 * Find all transfer orders with pagination and optional filters.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: TransferOrderRow[]; total: number }> {
  const { page, pageSize, status, from_warehouse_id, to_warehouse_id } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`t.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (from_warehouse_id) {
    conditions.push(`t.from_warehouse_id = $${paramIndex}`);
    params.push(from_warehouse_id);
    paramIndex++;
  }

  if (to_warehouse_id) {
    conditions.push(`t.to_warehouse_id = $${paramIndex}`);
    params.push(to_warehouse_id);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM transfer_orders t ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query with warehouse and user joins
  const dataSql = `
    SELECT 
      t.transfer_id,
      t.from_warehouse_id,
      fw.name as from_warehouse_name,
      t.to_warehouse_id,
      tw.name as to_warehouse_name,
      t.status,
      t.completed_at,
      t.requested_by,
      u.full_name as created_by_name,
      t.note,
      t.created_at,
      t.updated_at
    FROM transfer_orders t
    JOIN warehouses fw ON t.from_warehouse_id = fw.warehouse_id
    JOIN warehouses tw ON t.to_warehouse_id = tw.warehouse_id
    LEFT JOIN users u ON t.requested_by = u.user_id
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<TransferOrderRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

/**
 * Find a transfer order by ID with its items.
 */
export async function findById(transferId: number): Promise<TransferOrderDetailRow | null> {
  const orderSql = `
    SELECT 
      t.transfer_id,
      t.from_warehouse_id,
      fw.name as from_warehouse_name,
      t.to_warehouse_id,
      tw.name as to_warehouse_name,
      t.status,
      t.completed_at,
      t.requested_by,
      u.full_name as created_by_name,
      t.note,
      t.created_at,
      t.updated_at
    FROM transfer_orders t
    JOIN warehouses fw ON t.from_warehouse_id = fw.warehouse_id
    JOIN warehouses tw ON t.to_warehouse_id = tw.warehouse_id
    LEFT JOIN users u ON t.requested_by = u.user_id
    WHERE t.transfer_id = $1
  `;

  const orderResult = await query<TransferOrderRow>(orderSql, [transferId]);
  if (orderResult.rows.length === 0) {
    return null;
  }

  // Get transfer items
  const itemsSql = `
    SELECT 
      ti.transfer_item_id,
      ti.transfer_id,
      ti.product_id,
      p.name as product_name,
      ti.quantity,
      ti.received_quantity
    FROM transfer_items ti
    JOIN products p ON ti.product_id = p.product_id
    WHERE ti.transfer_id = $1
    ORDER BY ti.transfer_item_id ASC
  `;

  const itemsResult = await query<TransferItemRow>(itemsSql, [transferId]);

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
}

/**
 * Execute the move_stock_advanced stored function within a transaction.
 * This function uses SELECT ... FOR UPDATE to lock the source inventory row.
 */
export async function executeMoveStock(
  client: PoolClient,
  data: {
    from_warehouse_id: number;
    to_warehouse_id: number;
    product_id: number;
    quantity: number;
    lot_id: number | null;
    user_id: number | null;
  }
): Promise<void> {
  const sql = `
    SELECT move_stock_advanced($1, $2, $3, $4, $5, $6)
  `;
  await client.query(sql, [
    data.from_warehouse_id,
    data.to_warehouse_id,
    data.product_id,
    data.quantity,
    data.lot_id,
    data.user_id,
  ]);
}

/**
 * Create a transfer order record within a transaction.
 */
export async function createTransferOrder(
  client: PoolClient,
  data: {
    from_warehouse_id: number;
    to_warehouse_id: number;
    status: string;
    completed_at?: string | null;
    notes?: string | null;
  }
): Promise<number> {
  const sql = `
    INSERT INTO transfer_orders (from_warehouse_id, to_warehouse_id, status, completed_at, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING transfer_id
  `;
  const result = await client.query<{ transfer_id: number }>(sql, [
    data.from_warehouse_id,
    data.to_warehouse_id,
    data.status,
    data.completed_at || null,
    data.notes || null,
  ]);
  return result.rows[0].transfer_id;
}

/**
 * Create a transfer item record within a transaction.
 */
export async function createTransferItem(
  client: PoolClient,
  data: {
    transfer_id: number;
    product_id: number;
    quantity: number;
  }
): Promise<void> {
  const sql = `
    INSERT INTO transfer_items (transfer_id, product_id, quantity, received_quantity)
    VALUES ($1, $2, $3, $3)
  `;
  await client.query(sql, [data.transfer_id, data.product_id, data.quantity]);
}

/**
 * Get available inventory quantity for a product in a specific warehouse.
 * Used for validation before transfer execution.
 */
export async function getAvailableQuantity(
  client: PoolClient,
  warehouseId: number,
  productId: number,
  lotId: number | null
): Promise<number> {
  let sql: string;
  let params: any[];

  if (lotId) {
    sql = `
      SELECT COALESCE(SUM(quantity), 0) as available
      FROM inventory
      WHERE warehouse_id = $1 AND product_id = $2 AND lot_id = $3
    `;
    params = [warehouseId, productId, lotId];
  } else {
    sql = `
      SELECT COALESCE(SUM(quantity), 0) as available
      FROM inventory
      WHERE warehouse_id = $1 AND product_id = $2
    `;
    params = [warehouseId, productId];
  }

  const result = await client.query<{ available: string }>(sql, params);
  return parseInt(result.rows[0].available, 10);
}
