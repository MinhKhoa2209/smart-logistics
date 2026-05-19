import { query } from '../config/database';

/**
 * Stock Movements repository — handles all database queries for the stock movements domain.
 * The stock_movements table is partitioned by RANGE on created_at (yearly partitions).
 * Date range filters enable PostgreSQL partition pruning for efficient queries.
 */

export interface StockMovementRow {
  movement_id: string;
  product_id: number;
  product_name: string;
  warehouse_id: number;
  warehouse_name: string;
  change_amount: number;
  movement_type: string;
  lot_id: number | null;
  lot_number: string | null;
  reference_type: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  start_date?: string;
  end_date?: string;
  movement_type?: string;
}

/**
 * Find all stock movement records with pagination, date range filter, and movement_type filter.
 * Date range filters leverage partition pruning on the stock_movements partitioned table.
 * Default sort: created_at DESC.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: StockMovementRow[]; total: number }> {
  const { page, pageSize, start_date, end_date, movement_type } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Date range filter — enables partition pruning on created_at
  if (start_date) {
    conditions.push(`sm.created_at >= $${paramIndex}`);
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    conditions.push(`sm.created_at <= $${paramIndex}`);
    params.push(end_date);
    paramIndex++;
  }

  // Movement type filter
  if (movement_type) {
    conditions.push(`sm.movement_type = $${paramIndex}`);
    params.push(movement_type);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query with product, warehouse, lot, and user joins
  const dataSql = `
    SELECT 
      sm.movement_id,
      sm.product_id,
      p.name as product_name,
      sm.warehouse_id,
      w.name as warehouse_name,
      sm.change_amount,
      sm.movement_type,
      sm.lot_id,
      pl.lot_number,
      sm.reference_type,
      sm.created_by,
      u.full_name as created_by_name,
      sm.created_at
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.product_id
    JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
    LEFT JOIN product_lots pl ON sm.lot_id = pl.lot_id
    LEFT JOIN users u ON sm.created_by = u.user_id
    ${whereClause}
    ORDER BY sm.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<StockMovementRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}
