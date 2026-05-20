import * as stockMovementsRepository from '../repositories/stockMovements.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { StockMovementRow } from '../repositories/stockMovements.repository';

interface ListStockMovementsOptions {
  page?: string;
  pageSize?: string;
  start_date?: string;
  end_date?: string;
  movement_type?: string;
}

export async function listStockMovements(
  options: ListStockMovementsOptions
): Promise<PaginatedResponse<StockMovementRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await stockMovementsRepository.findAll({
    page,
    pageSize,
    start_date: options.start_date,
    end_date: options.end_date,
    movement_type: options.movement_type,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}
