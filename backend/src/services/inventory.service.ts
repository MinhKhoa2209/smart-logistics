import * as inventoryRepository from '../repositories/inventory.repository';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { InventoryRow } from '../repositories/inventory.repository';

/**
 * Inventory service — business logic coordination for inventory.
 */

interface ListInventoryOptions {
  page?: string;
  pageSize?: string;
  warehouse_id?: string;
  low_stock?: string;
  /** The user_id from the request context, used for RLS evaluation. */
  userId?: number;
}

/**
 * Get paginated list of inventory records with optional filters.
 * Default page size is 50 records per page.
 *
 * Passes userId down to the repository so RLS policies restrict rows
 * to what the current user is allowed to see.
 */
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
