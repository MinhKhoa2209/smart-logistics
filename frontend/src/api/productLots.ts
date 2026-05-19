import apiClient from './client';

export interface ProductLot {
  lot_id: number;
  lot_number: string;
  product_name: string;
  sku: string;
  manufacture_date: string;
  expiry_date: string;
  supplier_name: string | null;
  quantity?: number;
  warehouse_name?: string;
  days_until_expiry?: number;
  expiry_status?: 'critical' | 'warning' | 'ok';
}

export interface ProductLotListResponse {
  data: ProductLot[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getProductLots(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ProductLotListResponse> {
  const { data } = await apiClient.get('/lots', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function getExpiringLots(): Promise<ProductLot[]> {
  const { data } = await apiClient.get('/lots/expiring');
  return data.data || data;
}
