import apiClient from './client';

export interface CustomerOrder {
  customer_order_id: number;
  order_id?: number; // alias for compatibility
  customer_name: string;
  status: string;
  total_amount: number;
  payment_status: string;
  shipping_address: string;
  created_at: string;
  items?: CustomerOrderItem[];
}

export interface CustomerOrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface CustomerOrderListResponse {
  data: CustomerOrder[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getCustomerOrders(params?: {
  page?: number;
  pageSize?: number;
}): Promise<CustomerOrderListResponse> {
  const { data } = await apiClient.get('/customer-orders', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function updateOrderStatus(id: number, status: string): Promise<CustomerOrder> {
  const { data } = await apiClient.patch(`/customer-orders/${id}/status`, { status });
  return data;
}

export async function recordPayment(id: number, input: { amount: number; payment_method: string }): Promise<any> {
  const { data } = await apiClient.post(`/customer-orders/${id}/payments`, input);
  return data;
}
