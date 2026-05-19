import * as warehousesRepository from '../repositories/warehouses.repository';
import { AppError } from '../middleware';
import { formatPaginatedResponse } from '../utils/pagination';

/**
 * Get all warehouses with optional filters.
 */
export async function listWarehouses(filters: {
  warehouse_type?: string;
  is_active?: boolean;
}) {
  return warehousesRepository.findAll(filters);
}

/**
 * Get a single warehouse by ID. Throws 404 if not found.
 */
export async function getWarehouseById(warehouseId: number) {
  const warehouse = await warehousesRepository.findById(warehouseId);
  if (!warehouse) {
    throw new AppError(404, 'Warehouse not found');
  }
  return warehouse;
}

/**
 * Get paginated inventory for a specific warehouse. Throws 404 if warehouse doesn't exist.
 */
export async function getWarehouseInventory(
  warehouseId: number,
  page: number = 1,
  pageSize: number = 50
) {
  // Verify warehouse exists
  const warehouse = await warehousesRepository.findById(warehouseId);
  if (!warehouse) {
    throw new AppError(404, 'Warehouse not found');
  }

  const { items, total } = await warehousesRepository.findInventoryByWarehouseId(
    warehouseId,
    page,
    pageSize
  );

  return formatPaginatedResponse(items, total, page, pageSize);
}

/**
 * Create a new warehouse.
 */
export async function createWarehouse(data: {
  name: string;
  warehouse_type: string;
  location?: string | null;
  capacity?: number | null;
  manager_id?: number | null;
}) {
  return warehousesRepository.create(data);
}
