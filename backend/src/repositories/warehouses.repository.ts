import { query } from '../config/database';

export interface WarehouseListItem {
  warehouse_id: number;
  name: string;
  warehouse_type: string;
  location: string;
  capacity: number;
  is_active: boolean;
  manager_name: string | null;
}

export interface WarehouseDetail {
  warehouse_id: number;
  name: string;
  warehouse_type: string;
  location: string;
  capacity: number;
  is_active: boolean;
  manager_id: number | null;
  manager_name: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseInventoryItem {
  inventory_id: number;
  product_id: number;
  product_name: string;
  lot_id: number | null;
  lot_number: string | null;
  quantity: number;
  reorder_point: number;
  max_stock_level: number | null;
}

interface ListFilters {
  warehouse_type?: string;
  is_active?: boolean;
}

/**
 * Get all warehouses with manager name (JOIN with users table).
 */
export async function findAll(filters: ListFilters = {}): Promise<WarehouseListItem[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (filters.warehouse_type) {
    conditions.push(`w.warehouse_type = $${paramIndex++}`);
    params.push(filters.warehouse_type);
  }

  if (filters.is_active !== undefined) {
    conditions.push(`w.is_active = $${paramIndex++}`);
    params.push(filters.is_active);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      w.warehouse_id,
      w.name,
      w.warehouse_type,
      w.location,
      w.capacity,
      w.is_active,
      u.full_name AS manager_name
    FROM warehouses w
    LEFT JOIN users u ON w.manager_id = u.user_id
    ${whereClause}
    ORDER BY w.name ASC
  `;

  const result = await query<WarehouseListItem>(sql, params);
  return result.rows;
}

/**
 * Get a single warehouse by ID with all fields.
 */
export async function findById(warehouseId: number): Promise<WarehouseDetail | null> {
  const sql = `
    SELECT
      w.warehouse_id,
      w.name,
      w.warehouse_type,
      w.location,
      w.capacity,
      w.is_active,
      w.manager_id,
      u.full_name AS manager_name,
      NULL::numeric as latitude,
      NULL::numeric as longitude,
      w.created_at,
      w.updated_at
    FROM warehouses w
    LEFT JOIN users u ON w.manager_id = u.user_id
    WHERE w.warehouse_id = $1
  `;

  const result = await query<WarehouseDetail>(sql, [warehouseId]);
  return result.rows[0] || null;
}

/**
 * Get all inventory records for a specific warehouse including product name and lot number.
 */
export async function findInventoryByWarehouseId(
  warehouseId: number,
  page: number = 1,
  pageSize: number = 50
): Promise<{ items: WarehouseInventoryItem[]; total: number }> {
  const offset = (Math.max(1, page) - 1) * pageSize;

  const countSql = `
    SELECT COUNT(*) AS total
    FROM inventory i
    WHERE i.warehouse_id = $1
  `;

  const dataSql = `
    SELECT
      i.inventory_id,
      i.product_id,
      p.name AS product_name,
      i.lot_id,
      pl.lot_number,
      i.quantity,
      i.reorder_point,
      i.max_stock_level
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    LEFT JOIN product_lots pl ON i.lot_id = pl.lot_id
    WHERE i.warehouse_id = $1
    ORDER BY p.name ASC
    LIMIT $2 OFFSET $3
  `;

  const [countResult, dataResult] = await Promise.all([
    query<{ total: string }>(countSql, [warehouseId]),
    query<WarehouseInventoryItem>(dataSql, [warehouseId, pageSize, offset]),
  ]);

  const total = parseInt(countResult.rows[0]?.total || '0', 10);
  return { items: dataResult.rows, total };
}

/**
 * Create a new warehouse.
 */
export async function create(data: {
  name: string;
  warehouse_type: string;
  location?: string | null;
  capacity?: number | null;
  manager_id?: number | null;
}): Promise<WarehouseDetail> {
  const sql = `
    INSERT INTO warehouses (name, warehouse_type, location, capacity, manager_id)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING warehouse_id, name, warehouse_type, location, capacity, is_active,
              manager_id, NULL::numeric as latitude, NULL::numeric as longitude,
              created_at, updated_at
  `;
  const result = await query<WarehouseDetail>(sql, [
    data.name,
    data.warehouse_type,
    data.location || null,
    data.capacity || null,
    data.manager_id || null,
  ]);
  return result.rows[0];
}
