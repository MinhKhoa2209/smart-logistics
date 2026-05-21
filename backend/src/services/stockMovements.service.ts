import * as stockMovementsRepository from '../repositories/stockMovements.repository';
import { PoolClient } from 'pg';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { StockMovementRow } from '../repositories/stockMovements.repository';
import { CreateStockMovementInput, UpdateStockMovementInput } from '../validators/stockMovements.validator';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';

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

export async function getStockMovement(movementId: number): Promise<StockMovementRow> {
  const movement = await stockMovementsRepository.findById(movementId);
  if (!movement) {
    throw new AppError(404, 'Stock movement not found');
  }
  return movement;
}

export async function createStockMovement(data: CreateStockMovementInput): Promise<StockMovementRow> {
  try {
    return await withTransaction(async (client) => {
      await client.query("SET LOCAL app.current_user_id = '1'");
      return stockMovementsRepository.create(client, data);
    });
  } catch (error: any) {
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

export async function updateStockMovement(
  movementId: number,
  data: UpdateStockMovementInput
): Promise<StockMovementRow> {
  try {
    return await withTransaction(async (client) => {
      await client.query("SET LOCAL app.current_user_id = '1'");

      const existing = await stockMovementsRepository.findByIdForUpdate(client, movementId);
      if (!existing) {
        throw new AppError(404, 'Stock movement not found');
      }

      await applyInventoryDelta(client, {
        product_id: existing.product_id,
        warehouse_id: existing.warehouse_id,
        lot_id: existing.lot_id,
        change_amount: -existing.change_amount,
      });

      const updated = await stockMovementsRepository.update(client, movementId, data);
      if (!updated) {
        throw new AppError(404, 'Stock movement not found');
      }

      await applyInventoryDelta(client, {
        product_id: updated.product_id,
        warehouse_id: updated.warehouse_id,
        lot_id: updated.lot_id,
        change_amount: updated.change_amount,
      });

      return updated;
    });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

async function applyInventoryDelta(
  client: PoolClient,
  movement: { product_id: number; warehouse_id: number; lot_id: number | null; change_amount: number }
): Promise<void> {
  if (movement.change_amount < 0) {
    const stockResult = await client.query<{ quantity: number }>(
      `
        SELECT quantity
        FROM inventory
        WHERE warehouse_id = $1
          AND product_id = $2
          AND (lot_id = $3 OR (lot_id IS NULL AND $3 IS NULL))
        FOR UPDATE
      `,
      [movement.warehouse_id, movement.product_id, movement.lot_id]
    );

    const currentQuantity = stockResult.rows[0]?.quantity ?? 0;
    if (currentQuantity < Math.abs(movement.change_amount)) {
      throw new AppError(400, 'Insufficient inventory for this movement adjustment', {
        warehouse_id: movement.warehouse_id,
        product_id: movement.product_id,
        lot_id: movement.lot_id,
        currentQuantity,
        requiredQuantity: Math.abs(movement.change_amount),
      });
    }
  }

  const updateResult = await client.query(
    `
      UPDATE inventory
      SET quantity = quantity + $1,
          last_counted_at = CURRENT_TIMESTAMP
      WHERE warehouse_id = $2
        AND product_id = $3
        AND (lot_id = $4 OR (lot_id IS NULL AND $4 IS NULL))
    `,
    [movement.change_amount, movement.warehouse_id, movement.product_id, movement.lot_id]
  );

  if (updateResult.rowCount === 0) {
    await client.query(
      `
        INSERT INTO inventory (warehouse_id, product_id, lot_id, quantity, last_counted_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `,
      [movement.warehouse_id, movement.product_id, movement.lot_id, movement.change_amount]
    );
  }
}
