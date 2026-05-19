import apiClient from './client';

export interface Transfer {
  transfer_id: number;
  product_name: string;
  from_warehouse_name: string;
  to_warehouse_name: string;
  quantity: number;
  status: string;
  created_at: string;
}

export interface TransferCreateInput {
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
  lot_id?: number;
}

export interface TransferListResponse {
  data: Transfer[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getTransfers(params?: {
  page?: number;
  pageSize?: number;
}): Promise<TransferListResponse> {
  const { data } = await apiClient.get('/transfers', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function createTransfer(input: TransferCreateInput): Promise<Transfer> {
  const { data } = await apiClient.post('/transfers', input);
  return data;
}
