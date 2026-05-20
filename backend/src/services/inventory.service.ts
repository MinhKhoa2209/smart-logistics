import * as inventoryRepository from '../repositories/inventory.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { InventoryRow } from '../repositories/inventory.repository';

interface ListInventoryOptions {
  page?: string;
  pageSize?: string;
  warehouse_id?: string;
  low_stock?: string;

  userId?: number;
}

export async function listInventory(options: ListInventoryOptions): Promise<PaginatedResponse<InventoryRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    50
  );

  const { rows, total } = await inventoryRepository.findAll({
    page,
    pageSize,
    warehouse_id: options.warehouse_id ? parseInt(options.warehouse_id, 10) : undefined,
    low_stock: options.low_stock === 'true',
    userId: options.userId ?? 1,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}
