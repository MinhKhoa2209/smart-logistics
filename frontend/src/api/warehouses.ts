import apiClient from './client';

export interface Warehouse {
  warehouse_id: number;
  name: string;
  warehouse_type: string;
  location: string;
  latitude: number;
  longitude: number;
  capacity: number;
  manager_name?: string;
  is_active: boolean;
}

export interface WarehouseInventory {
  product_name: string;
  sku: string;
  lot_number: string | null;
  quantity: number;
  reorder_point: number;
  max_stock_level: number;
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const { data } = await apiClient.get('/warehouses');
  return data.data || data;
}

export async function getWarehouse(id: number): Promise<Warehouse> {
  const { data } = await apiClient.get(`/warehouses/${id}`);
  return data;
}

export async function getWarehouseInventory(id: number): Promise<WarehouseInventory[]> {
  const { data } = await apiClient.get(`/warehouses/${id}/inventory`);
  return data.data || data;
}
