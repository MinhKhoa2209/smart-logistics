import apiClient from './client';

export interface StockMovement {
  movement_id: number;
  product_name: string;
  sku: string;
  warehouse_name: string;
  change_amount: number;
  movement_type: string;
  lot_number: string | null;
  reference_type: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface StockMovementListResponse {
  data: StockMovement[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getStockMovements(params: {
  page?: number;
  pageSize?: number;
  movement_type?: string;
  start_date?: string;
  end_date?: string;
}): Promise<StockMovementListResponse> {
  const { data } = await apiClient.get('/stock-movements', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}
