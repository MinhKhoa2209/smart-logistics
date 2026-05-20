import { query } from '../config/database';
import { queryWithContext } from '../middleware/appContext';

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

export async function getActiveProductsCount(): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM products WHERE is_active = true`;
  const result = await query<{ count: string; }>(sql);
  return parseInt(result.rows[0].count, 10);
}

export async function getActiveWarehousesCount(): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM warehouses WHERE is_active = true`;
  const result = await query<{ count: string; }>(sql);
  return parseInt(result.rows[0].count, 10);
}

export async function getLowStockCount(userId = 1): Promise<number> {
  const sql = `SELECT COUNT(*) as count FROM inventory WHERE quantity <= reorder_point`;
  const result = await queryWithContext<{ count: string; }>(sql, [], userId);
  return parseInt(result.rows[0].count, 10);
}

export async function getShipmentStatusCounts(): Promise<Record<string, number>> {
  const sql = `
    SELECT status, COUNT(*) as count
    FROM shipments
    GROUP BY status
  `;
  const result = await query<{ status: string; count: string; }>(sql);

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

export async function getLowStockAlerts(userId = 1): Promise<LowStockAlertRow[]> {
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
  const result = await queryWithContext<LowStockAlertRow>(sql, [], userId);
  return result.rows;
}
