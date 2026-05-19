import apiClient from './client';

export interface Shipment {
  shipment_id: number;
  origin_warehouse_name: string;
  destination_address: string;
  carrier: string;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  items?: ShipmentItem[];
}

export interface ShipmentItem {
  product_name: string;
  quantity: number;
}

export interface ShipmentCreateInput {
  warehouse_id: number;
  destination_address: string;
  carrier: string;
  items: { product_id: number; quantity: number; lot_id?: number }[];
}

export interface ShipmentListResponse {
  data: Shipment[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getShipments(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ShipmentListResponse> {
  const { data } = await apiClient.get('/shipments', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}

export async function createShipment(input: ShipmentCreateInput): Promise<Shipment> {
  const { data } = await apiClient.post('/shipments', input);
  return data;
}

export async function updateShipmentStatus(id: number, status: string): Promise<Shipment> {
  const { data } = await apiClient.patch(`/shipments/${id}/status`, { status });
  return data;
}
