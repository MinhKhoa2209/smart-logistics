import * as auditLogsRepository from '../repositories/auditLogs.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { AuditLogRow } from '../repositories/auditLogs.repository';

/**
 * Audit Logs service — business logic coordination for audit logs.
 * Includes JSONB diff computation between old_value and new_value.
 */

export interface JsonbDiff {
  additions: Record<string, any>;
  deletions: Record<string, any>;
  changes: Record<string, { old: any; new: any }>;
}

export interface AuditLogWithDiff extends AuditLogRow {
  diff: JsonbDiff | null;
}

interface ListAuditLogsOptions {
  page?: string;
  pageSize?: string;
  table_name?: string;
  user_id?: string;
  action?: string;
  start_date?: string;
  end_date?: string;
}

/**
 * Compute the JSONB diff between old_value and new_value.
 * - additions: keys present in new_value but not in old_value
 * - deletions: keys present in old_value but not in new_value
 * - changes: keys present in both but with different values
 */
export function computeJsonbDiff(
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null
): JsonbDiff | null {
  // If both are null, no diff to compute
  if (!oldValue && !newValue) {
    return null;
  }

  const old = oldValue || {};
  const newVal = newValue || {};

  const oldKeys = Object.keys(old);
  const newKeys = Object.keys(newVal);

  const additions: Record<string, any> = {};
  const deletions: Record<string, any> = {};
  const changes: Record<string, { old: any; new: any }> = {};

  // Find additions (keys in new but not in old)
  for (const key of newKeys) {
    if (!(key in old)) {
      additions[key] = newVal[key];
    }
  }

  // Find deletions (keys in old but not in new)
  for (const key of oldKeys) {
    if (!(key in newVal)) {
      deletions[key] = old[key];
    }
  }

  // Find changes (keys in both but with different values)
  for (const key of oldKeys) {
    if (key in newVal && JSON.stringify(old[key]) !== JSON.stringify(newVal[key])) {
      changes[key] = { old: old[key], new: newVal[key] };
    }
  }

  return { additions, deletions, changes };
}

/**
 * Get paginated list of audit log records with optional filters and computed JSONB diffs.
 * Default page size is 20 records per page.
 * Supports filters: table_name, user_id, action, date range (start_date, end_date).
 */
export async function listAuditLogs(
  options: ListAuditLogsOptions
): Promise<PaginatedResponse<AuditLogWithDiff>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await auditLogsRepository.findAll({
    page,
    pageSize,
    table_name: options.table_name,
    user_id: options.user_id,
    action: options.action,
    start_date: options.start_date,
    end_date: options.end_date,
  });

  // Compute JSONB diff for each audit log entry
  const rowsWithDiff: AuditLogWithDiff[] = rows.map((row) => ({
    ...row,
    diff: computeJsonbDiff(row.old_value, row.new_value),
  }));

  return formatPaginatedResponse(rowsWithDiff, total, page, pageSize);
}
