import apiClient from './client';

export interface StockMovement {
  movement_id: number;
  product_id: number;
  product_name: string;
  warehouse_id: number;
  warehouse_name: string;
  change_amount: number;
  movement_type: string;
  lot_id: number | null;
  lot_number: string | null;
  unit_cost: number | null;
  reference_id: number | null;
  reference_type: string | null;
  note: string | null;
  created_by: number | null;
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

export interface StockMovementInput {
  product_id: number;
  warehouse_id: number;
  change_amount: number;
  movement_type: string;
  lot_id?: number | null;
  unit_cost?: number | null;
  reference_id?: number | null;
  reference_type?: string | null;
  note?: string | null;
  created_by?: number | null;
}

export async function createStockMovement(input: StockMovementInput): Promise<StockMovement> {
  const { data } = await apiClient.post('/stock-movements', input);
  return data;
}

export async function updateStockMovement(id: number, input: Partial<StockMovementInput>): Promise<StockMovement> {
  const { data } = await apiClient.put(`/stock-movements/${id}`, input);
  return data;
}
