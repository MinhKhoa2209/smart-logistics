import * as transfersRepository from '../repositories/transfers.repository';
import { CreateTransferInput } from '../validators/transfers.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { TransferOrderRow, TransferOrderDetailRow } from '../repositories/transfers.repository';

/**
 * Transfer Orders service — business logic coordination for inter-warehouse transfers.
 * Uses the move_stock_advanced() stored function with pessimistic locking (SELECT ... FOR UPDATE).
 */

interface ListTransfersOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
}

/**
 * Get paginated list of transfer orders with optional filters.
 */
export async function listTransfers(
  options: ListTransfersOptions
): Promise<PaginatedResponse<TransferOrderRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await transfersRepository.findAll({
    page,
    pageSize,
    status: options.status,
    from_warehouse_id: options.from_warehouse_id ? parseInt(options.from_warehouse_id, 10) : undefined,
    to_warehouse_id: options.to_warehouse_id ? parseInt(options.to_warehouse_id, 10) : undefined,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

/**
 * Create and execute a transfer order.
 * 
 * Flow:
 * 1. Validate quantity against available inventory (quantity must be in range [1, available])
 * 2. Call move_stock_advanced() stored function (uses SELECT ... FOR UPDATE for locking)
 * 3. Create transfer_order with status 'completed' and set completed_at
 * 4. Create transfer_item record
 * 
 * Error handling:
 * - P0001 (raise_exception): Insufficient stock — return 400 with available quantity
 * - 55P03 (lock_not_available): Lock timeout — return 503 with retry_after_ms
 */
export async function createTransfer(
  data: CreateTransferInput
): Promise<TransferOrderDetailRow> {
  try {
    const transferId = await withTransaction(async (client) => {
      // Check available quantity for validation
      const available = await transfersRepository.getAvailableQuantity(
        client,
        data.from_warehouse_id,
        data.product_id,
        data.lot_id ?? null
      );

      // Validate quantity range [1, available]
      if (available === 0) {
        throw new AppError(400, 'Insufficient stock for transfer', {
          requested_quantity: data.quantity,
          available_quantity: available,
          product_id: data.product_id,
          warehouse_id: data.from_warehouse_id,
        });
      }

      if (data.quantity > available) {
        throw new AppError(400, 'Insufficient stock for transfer', {
          requested_quantity: data.quantity,
          available_quantity: available,
          product_id: data.product_id,
          warehouse_id: data.from_warehouse_id,
          allowed_range: `1 to ${available}`,
        });
      }

      // Execute the move_stock_advanced stored function
      // This uses SELECT ... FOR UPDATE to lock the source inventory row
      await transfersRepository.executeMoveStock(client, {
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        product_id: data.product_id,
        quantity: data.quantity,
        lot_id: data.lot_id ?? null,
        user_id: null, // Will be set by app context if available
      });

      // Create transfer order with status 'completed'
      const id = await transfersRepository.createTransferOrder(client, {
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // Create transfer item
      await transfersRepository.createTransferItem(client, {
        transfer_id: id,
        product_id: data.product_id,
        quantity: data.quantity,
      });

      return id;
    });

    // Fetch the created transfer with full details
    const transfer = await transfersRepository.findById(transferId);
    return transfer!;
  } catch (error: any) {
    // Re-throw AppError instances as-is
    if (error instanceof AppError) throw error;

    // Handle PostgreSQL error codes
    if (error.code && error.code.length === 5) {
      // P0001: raise_exception from move_stock_advanced (insufficient stock)
      if (error.code === 'P0001') {
        throw new AppError(400, 'Insufficient stock for transfer', {
          detail: error.message,
          product_id: data.product_id,
          warehouse_id: data.from_warehouse_id,
        });
      }

      // 55P03: lock_not_available (lock timeout)
      if (error.code === '55P03') {
        throw new AppError(503, 'Transfer could not be completed due to a concurrent operation', {
          retry_after_ms: 1000,
        });
      }

      // Other PG errors — use generic parser
      throw parsePgError(error);
    }

    throw error;
  }
}
