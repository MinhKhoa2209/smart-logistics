import { query } from '../config/database';

/**
 * Dashboard repository — handles all database queries for the dashboard metrics.
 */

export interface DashboardMetrics {
  activeProducts: number;
  activeWarehouses: number;
  lowStockCount: number;
  shipmentsByStatus: Record<string, number>;
}

export interface RecentMovementRow {
  movement_id: string;
  product_name: string;
  warehouse_name: string;
  movement_type: string;
  change_amount: number;
  created_at: string;
}

export interface LowStockAlertRow {
  inventory_id: number;
  product_name: string;
  warehouse_name: string;
  quantity: number;
  reorder_point: number;
}

/**
 * Get the count of active products.
 */
export async function getActiveProductsCount(): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM products WHERE is_active = true`;
  const result = await query<{ count: string }>(sql);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get the count of active warehouses.
 */
export async function getActiveWarehousesCount(): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM warehouses WHERE is_active = true`;
  const result = await query<{ count: string }>(sql);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get the count of low stock items using the idx_inventory_low_stock partial index.
 * The partial index is defined as: WHERE quantity <= reorder_point
 */
export async function getLowStockCount(): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM inventory WHERE quantity <= reorder_point`;
  const result = await query<{ count: string }>(sql);
  return parseInt(result.rows[0].count, 10);
}

/**
 * Get shipment counts grouped by status.
 * Returns counts for: pending, in_transit, delivered, failed, returned.
 */
export async function getShipmentStatusCounts(): Promise<Record<string, number>> {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM shipments
    GROUP BY status
  `;
  const result = await query<{ status: string; count: string }>(sql);

  // Initialize all statuses to 0
  const counts: Record<string, number> = {
    pending: 0,
    in_transit: 0,
    delivered: 0,
    failed: 0,
    returned: 0,
  };

  for (const row of result.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  return counts;
}

/**
 * Get the 10 most recent stock movements ordered by created_at DESC.
 * Includes product name, warehouse name, movement_type, change_amount, and created_at.
 */
export async function getRecentMovements(): Promise<RecentMovementRow[]> {
  const sql = `
    SELECT 
      sm.movement_id,
      p.name as product_name,
      w.name as warehouse_name,
      sm.movement_type,
      sm.change_amount,
      sm.created_at
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.product_id
    JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
    ORDER BY sm.created_at DESC
    LIMIT 10
  `;
  const result = await query<RecentMovementRow>(sql);
  return result.rows;
}

/**
 * Get up to 50 low stock items using the idx_inventory_low_stock partial index.
 * Ordered by (quantity / reorder_point) ASC — most critical items first.
 * Includes product name, current quantity, reorder_point, and warehouse name.
 */
export async function getLowStockAlerts(): Promise<LowStockAlertRow[]> {
  const sql = `
    SELECT 
      i.inventory_id,
      p.name as product_name,
      w.name as warehouse_name,
      i.quantity,
      i.reorder_point
    FROM inventory i
    JOIN products p ON i.product_id = p.product_id
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    WHERE i.quantity <= i.reorder_point
    ORDER BY (i.quantity::float / NULLIF(i.reorder_point, 0)) ASC
    LIMIT 50
  `;
  const result = await query<LowStockAlertRow>(sql);
  return result.rows;
}
