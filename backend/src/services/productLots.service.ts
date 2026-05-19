import * as productLotsRepository from '../repositories/productLots.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { ProductLotWithInventory, ExpiringLotRow } from '../repositories/productLots.repository';

/**
 * Product Lots service — business logic coordination for product lots.
 */

export interface ExpiringLotWithClassification extends ExpiringLotRow {
  expiry_classification: 'critical' | 'warning';
}

interface ListLotsOptions {
  page?: string;
  pageSize?: string;
}

/**
 * Get paginated list of all product lots ordered by expiry_date ASC (FIFO).
 * Default page size is 20 records per page.
 */
export async function listLots(options: ListLotsOptions): Promise<PaginatedResponse<ProductLotWithInventory>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await productLotsRepository.findAll({ page, pageSize });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

/**
 * Get paginated list of lots expiring within 30 days with expiry classification.
 * Classification:
 *   - 'critical': expiry_date is within 7 days (days_until_expiry <= 7)
 *   - 'warning': expiry_date is within 8-30 days (days_until_expiry between 8 and 30)
 * Default page size is 20 records per page.
 */
export async function listExpiringLots(options: ListLotsOptions): Promise<PaginatedResponse<ExpiringLotWithClassification>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await productLotsRepository.findExpiring({ page, pageSize });

  // Apply expiry classification based on days_until_expiry
  const classifiedRows: ExpiringLotWithClassification[] = rows.map((lot) => ({
    ...lot,
    expiry_classification: classifyExpiry(lot.days_until_expiry),
  }));

  return formatPaginatedResponse(classifiedRows, total, page, pageSize);
}

/**
 * Classify a lot's expiry urgency based on days until expiry.
 * - critical: ≤ 7 days
 * - warning: 8-30 days
 */
export function classifyExpiry(daysUntilExpiry: number): 'critical' | 'warning' {
  if (daysUntilExpiry <= 7) {
    return 'critical';
  }
  return 'warning';
}
