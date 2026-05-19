/**
 * Pagination utility helpers for offset calculation and response formatting.
 */

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
}

/**
 * Calculate the SQL OFFSET value from 1-based page number and page size.
 */
export function calculateOffset(page: number, pageSize: number): number {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  return (safePage - 1) * safePageSize;
}

/**
 * Format a paginated response with metadata.
 */
export function formatPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResponse<T> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.ceil(total / safePageSize);

  return {
    data,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

/**
 * Parse pagination query parameters with defaults.
 */
export function parsePaginationParams(
  query: { page?: string; pageSize?: string },
  defaultPageSize: number = 20
): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const pageSize = Math.max(1, parseInt(query.pageSize || String(defaultPageSize), 10) || defaultPageSize);

  return { page, pageSize };
}
