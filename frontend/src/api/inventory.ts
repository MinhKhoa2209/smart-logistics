import apiClient from './client';

export interface InventoryItem {
  inventory_id: number;
  product_id: number;
  product_name: string;
  sku: string;
  warehouse_id: number;
  warehouse_name: string;
  lot_number: string | null;
  quantity: number;
  reorder_point: number;
  max_stock_level: number | null;
  is_low_stock: boolean;
  status: 'low_stock' | 'in_stock' | 'overstock';
}

export interface InventoryListResponse {
  data: InventoryItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getInventory(params: {
  page?: number;
  pageSize?: number;
  warehouse_id?: number;
  low_stock?: boolean;
  status?: 'low_stock' | 'in_stock' | 'overstock';
}): Promise<InventoryListResponse> {
  const { data } = await apiClient.get('/inventory', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}
