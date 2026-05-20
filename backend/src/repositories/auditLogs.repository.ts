import { query } from '../config/database';

export interface AuditLogRow {
  log_id: string;
  user_id: number | null;
  user_name: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  table_name?: string;
  user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
}

export async function findAll(options: FindAllOptions): Promise<{ rows: AuditLogRow[]; total: number; }> {
  const { page, pageSize, table_name, user_id, action, start_date, end_date } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (table_name) {
    conditions.push(`al.table_name = $${paramIndex}`);
    params.push(table_name);
    paramIndex++;
  }

  if (user_id) {
    conditions.push(`al.user_id = $${paramIndex}`);
    params.push(parseInt(user_id, 10));
    paramIndex++;
  }

  if (action) {
    conditions.push(`al.action = $${paramIndex}`);
    params.push(action);
    paramIndex++;
  }

  if (start_date) {
    conditions.push(`al.created_at >= $${paramIndex}`);
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    conditions.push(`al.created_at <= $${paramIndex}`);
    params.push(end_date);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
  const countResult = await query<{ total: string; }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT
      al.log_id,
      al.user_id,
      u.full_name as user_name,
      al.action,
      al.table_name,
      al.record_id,
      al.old_value,
      al.new_value,
      al.ip_address,
      al.created_at
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.user_id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<AuditLogRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}
