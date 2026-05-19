import * as dashboardRepository from '../repositories/dashboard.repository';
import { DashboardMetrics, RecentMovementRow, LowStockAlertRow } from '../repositories/dashboard.repository';

/**
 * Dashboard service — business logic coordination for dashboard data.
 */

/**
 * Get all dashboard metrics: active products, active warehouses, low stock count,
 * and shipment counts grouped by status.
 */
export async function getMetrics(): Promise<DashboardMetrics> {
  const [activeProducts, activeWarehouses, lowStockCount, shipmentsByStatus] = await Promise.all([
    dashboardRepository.getActiveProductsCount(),
    dashboardRepository.getActiveWarehousesCount(),
    dashboardRepository.getLowStockCount(),
    dashboardRepository.getShipmentStatusCounts(),
  ]);

  return {
    activeProducts,
    activeWarehouses,
    lowStockCount,
    shipmentsByStatus,
  };
}

/**
 * Get the 10 most recent stock movements.
 * Includes product name, warehouse name, movement_type, change_amount, and created_at.
 */
export async function getRecentMovements(): Promise<RecentMovementRow[]> {
  return dashboardRepository.getRecentMovements();
}

/**
 * Get up to 50 low stock alerts ordered by criticality (quantity/reorder_point ratio ASC).
 * Uses the idx_inventory_low_stock partial index for efficient querying.
 */
export async function getLowStockAlerts(): Promise<LowStockAlertRow[]> {
  return dashboardRepository.getLowStockAlerts();
}
