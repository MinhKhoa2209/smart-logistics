import * as auditLogsRepository from '../repositories/auditLogs.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { AuditLogRow } from '../repositories/auditLogs.repository';

export interface JsonbDiff {
  additions: Record<string, any>;
  deletions: Record<string, any>;
  changes: Record<string, { old: any; new: any; }>;
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

export function computeJsonbDiff(
  oldValue: Record<string, any> | null,
  newValue: Record<string, any> | null
): JsonbDiff | null {
  if (!oldValue && !newValue) {
    return null;
  }

  const old = oldValue || {};
  const newVal = newValue || {};

  const oldKeys = Object.keys(old);
  const newKeys = Object.keys(newVal);

  const additions: Record<string, any> = {};
  const deletions: Record<string, any> = {};
  const changes: Record<string, { old: any; new: any; }> = {};

  for (const key of newKeys) {
    if (!(key in old)) {
      additions[key] = newVal[key];
    }
  }

  for (const key of oldKeys) {
    if (!(key in newVal)) {
      deletions[key] = old[key];
    }
  }

  for (const key of oldKeys) {
    if (key in newVal && JSON.stringify(old[key]) !== JSON.stringify(newVal[key])) {
      changes[key] = { old: old[key], new: newVal[key] };
    }
  }

  return { additions, deletions, changes };
}

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

  const rowsWithDiff: AuditLogWithDiff[] = rows.map((row) => ({
    ...row,
    diff: computeJsonbDiff(row.old_value, row.new_value),
  }));

  return formatPaginatedResponse(rowsWithDiff, total, page, pageSize);
}
