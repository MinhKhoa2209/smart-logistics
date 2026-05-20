import * as transfersRepository from '../repositories/transfers.repository';
import { CreateTransferInput } from '../validators/transfers.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { TransferOrderRow, TransferOrderDetailRow } from '../repositories/transfers.repository';

interface ListTransfersOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  from_warehouse_id?: string;
  to_warehouse_id?: string;
}

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

export async function createTransfer(
  data: CreateTransferInput
): Promise<TransferOrderDetailRow> {
  try {
    const transferId = await withTransaction(async (client) => {
      const available = await transfersRepository.getAvailableQuantity(
        client,
        data.from_warehouse_id,
        data.product_id,
        data.lot_id ?? null
      );

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

      await transfersRepository.executeMoveStock(client, {
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        product_id: data.product_id,
        quantity: data.quantity,
        lot_id: data.lot_id ?? null,
        user_id: null,
      });

      const id = await transfersRepository.createTransferOrder(client, {
        from_warehouse_id: data.from_warehouse_id,
        to_warehouse_id: data.to_warehouse_id,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      await transfersRepository.createTransferItem(client, {
        transfer_id: id,
        product_id: data.product_id,
        quantity: data.quantity,
      });

      return id;
    });

    const transfer = await transfersRepository.findById(transferId);
    return transfer!;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (error.code && error.code.length === 5) {
      if (error.code === 'P0001') {
        throw new AppError(400, 'Insufficient stock for transfer', {
          detail: error.message,
          product_id: data.product_id,
          warehouse_id: data.from_warehouse_id,
        });
      }

      if (error.code === '55P03') {
        throw new AppError(503, 'Transfer could not be completed due to a concurrent operation', {
          retry_after_ms: 1000,
        });
      }

      throw parsePgError(error);
    }

    throw error;
  }
}
