import * as productLotsRepository from '../repositories/productLots.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { ProductLotWithInventory, ExpiringLotRow } from '../repositories/productLots.repository';

export interface ExpiringLotWithClassification extends ExpiringLotRow {
  expiry_classification: 'critical' | 'warning';
}

interface ListLotsOptions {
  page?: string;
  pageSize?: string;
}

export async function listLots(options: ListLotsOptions): Promise<PaginatedResponse<ProductLotWithInventory>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await productLotsRepository.findAll({ page, pageSize });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

export async function listExpiringLots(options: ListLotsOptions): Promise<PaginatedResponse<ExpiringLotWithClassification>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await productLotsRepository.findExpiring({ page, pageSize });

  const classifiedRows: ExpiringLotWithClassification[] = rows.map((lot) => ({
    ...lot,
    expiry_classification: classifyExpiry(lot.days_until_expiry),
  }));

  return formatPaginatedResponse(classifiedRows, total, page, pageSize);
}

export function classifyExpiry(daysUntilExpiry: number): 'critical' | 'warning' {
  if (daysUntilExpiry <= 7) {
    return 'critical';
  }
  return 'warning';
}
