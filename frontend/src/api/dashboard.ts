import apiClient from './client';

export interface DashboardMetrics {
  activeProducts: number;
  activeWarehouses: number;
  lowStockCount: number;
  shipmentsByStatus: Record<string, number>;
}

export interface RecentMovement {
  movement_id: number;
  product_name: string;
  warehouse_name: string;
  movement_type: string;
  change_amount: number;
  created_at: string;
}

export interface LowStockAlert {
  product_name: string;
  sku: string;
  warehouse_name: string;
  quantity: number;
  reorder_point: number;
}

export async function getMetrics(): Promise<DashboardMetrics> {
  const { data } = await apiClient.get('/dashboard/metrics');
  return data;
}

export async function getRecentMovements(): Promise<RecentMovement[]> {
  const { data } = await apiClient.get('/dashboard/recent-movements');
  return data;
}

export async function getLowStockAlerts(): Promise<LowStockAlert[]> {
  const { data } = await apiClient.get('/dashboard/low-stock');
  return data;
}
