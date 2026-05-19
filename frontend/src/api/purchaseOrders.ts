import apiClient from './client';

export interface PurchaseOrder {
  order_id: number;
  supplier_name: string;
  warehouse_name: string;
  status: string;
  total_amount: number;
  note: string | null;
  created_at: string;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  order_item_id: number;
  product_id: number;
  product_name: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
}

export interface POCreateInput {
  supplier_id: number;
  warehouse_id: number;
  note?: string;
  items: { product_id: number; ordered_quantity: number; unit_cost: number }[];
}

export interface POReceiveInput {
  items: { order_item_id: number; received_quantity: number }[];
}

export interface PurchaseOrderListResponse {
  data: PurchaseOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getPurchaseOrders(params?: {
  page?: number;
  pageSize?: number;
}): Promise<PurchaseOrderListResponse> {
  const { data } = await apiClient.get('/purchase-orders', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function createPurchaseOrder(input: POCreateInput): Promise<PurchaseOrder> {
  const { data } = await apiClient.post('/purchase-orders', input);
  return data;
}

export async function receivePurchaseOrder(id: number, input: POReceiveInput): Promise<PurchaseOrder> {
  const { data } = await apiClient.post(`/purchase-orders/${id}/receive`, input);
  return data;
}
