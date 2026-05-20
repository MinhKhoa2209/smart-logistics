import * as dashboardRepository from '../repositories/dashboard.repository';
import { DashboardMetrics, RecentMovementRow, LowStockAlertRow } from '../repositories/dashboard.repository';

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

export async function getRecentMovements(): Promise<RecentMovementRow[]> {
  return dashboardRepository.getRecentMovements();
}

export async function getLowStockAlerts(): Promise<LowStockAlertRow[]> {
  return dashboardRepository.getLowStockAlerts();
}
