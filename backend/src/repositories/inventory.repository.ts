import { query } from '../config/database';

/**
 * Inventory repository — handles all database queries for the inventory domain.
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
}

/**
 * Find all inventory records with pagination, warehouse filter, and low-stock filter.
 * Uses idx_inventory_low_stock partial index when filtering for low-stock items.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: InventoryRow[]; total: number }> {
  const { page, pageSize, warehouse_id, low_stock } = options;
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
    // This condition matches the idx_inventory_low_stock partial index (WHERE quantity <= reorder_point)
    conditions.push(`i.quantity <= i.reorder_point`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM inventory i ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
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

  const dataResult = await query<InventoryRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}
