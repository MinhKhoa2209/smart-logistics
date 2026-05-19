import apiClient from './client';

export interface AuditLog {
  log_id: number;
  user_id: number;
  username: string;
  action: string;
  table_name: string;
  record_id: number;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function getAuditLogs(params?: {
  page?: number;
  pageSize?: number;
  table_name?: string;
  user_id?: number;
  action?: string;
  start_date?: string;
  end_date?: string;
}): Promise<AuditLogListResponse> {
  const { data } = await apiClient.get('/audit-logs', { params });
  return {
    data: data.data,
    pagination: { page: data.page, pageSize: data.pageSize, total: data.total, totalPages: data.totalPages },
  };
}
