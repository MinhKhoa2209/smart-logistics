import { queryWithContext } from '../middleware/appContext';

/**
 * Inventory repository — handles all database queries for the inventory domain.
 *
 * All queries run inside a transaction with SET LOCAL app.current_user_id so that
 * RLS policies on the inventory table can correctly identify the current user.
 */

export interface InventoryRow {
  inventory_id: number;
  warehouse_id: number;
  warehouse_name: string;
  product_id: number;
  product_name: string;
  sku: string;
  lot_id: number | null;
  lot_number: string | null;
  quantity: number;
  reorder_point: number;
  max_stock_level: number | null;
  is_low_stock: boolean;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  warehouse_id?: number;
  low_stock?: boolean;
  /** The user_id to set as app context for RLS evaluation. Defaults to 1. */
  userId?: number;
}

/**
 * Find all inventory records with pagination, warehouse filter, and low-stock filter.
 * Uses idx_inventory_low_stock partial index when filtering for low-stock items.
 *
 * Runs inside a transaction with SET LOCAL app.current_user_id so RLS policies
 * restrict rows to what the current user is allowed to see.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: InventoryRow[]; total: number }> {
  const { page, pageSize, warehouse_id, low_stock, userId = 1 } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (warehouse_id) {
    conditions.push(`i.warehouse_id = $${paramIndex}`);
    params.push(warehouse_id);
    paramIndex++;
  }

  if (low_stock) {
    // Matches the idx_inventory_low_stock partial index (WHERE quantity <= reorder_point)
    conditions.push(`i.quantity <= i.reorder_point`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query — runs with RLS context so it only counts visible rows
  const countSql = `SELECT COUNT(*) as total FROM inventory i ${whereClause}`;
  const countResult = await queryWithContext<{ total: string }>(countSql, params, userId);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query with product, warehouse, and lot joins
  const dataSql = `
    SELECT
      i.inventory_id,
      i.warehouse_id,
      w.name as warehouse_name,
      i.product_id,
      p.name as product_name,
      p.sku,
      i.lot_id,
      pl.lot_number,
      i.quantity,
      i.reorder_point,
      i.max_stock_level,
      (i.quantity <= i.reorder_point) as is_low_stock
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    JOIN products p ON i.product_id = p.product_id
    LEFT JOIN product_lots pl ON i.lot_id = pl.lot_id
    ${whereClause}
    ORDER BY i.inventory_id ASC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await queryWithContext<InventoryRow>(dataSql, [...params, pageSize, offset], userId);

  return { rows: dataResult.rows, total };
}
