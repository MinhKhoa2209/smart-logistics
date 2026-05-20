import * as shipmentsRepository from '../repositories/shipments.repository';
import { CreateShipmentInput, UpdateShipmentStatusInput } from '../validators/shipments.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { ShipmentRow, ShipmentDetailRow } from '../repositories/shipments.repository';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['in_transit', 'failed'],
  in_transit: ['delivered'],
  delivered: ['returned'],
};

interface ListShipmentsOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  origin_warehouse_id?: string;
}

export async function listShipments(
  options: ListShipmentsOptions
): Promise<PaginatedResponse<ShipmentRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await shipmentsRepository.findAll({
    page,
    pageSize,
    status: options.status,
    origin_warehouse_id: options.origin_warehouse_id
      ? parseInt(options.origin_warehouse_id, 10)
      : undefined,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

export async function getShipment(shipmentId: number): Promise<ShipmentDetailRow> {
  const shipment = await shipmentsRepository.findById(shipmentId);
  if (!shipment) {
    throw new AppError(404, 'Shipment not found');
  }
  return shipment;
}

export async function createShipment(
  data: CreateShipmentInput
): Promise<ShipmentDetailRow> {
  try {
    const shipmentId = await withTransaction(async (client) => {
      const insufficientItems: Array<{
        product_id: number;
        requested: number;
        available: number;
      }> = [];

      for (const item of data.items) {
        const available = await shipmentsRepository.getAvailableInventory(
          client,
          data.origin_warehouse_id,
          item.product_id
        );

        if (item.quantity > available) {
          insufficientItems.push({
            product_id: item.product_id,
            requested: item.quantity,
            available,
          });
        }
      }

      if (insufficientItems.length > 0) {
        throw new AppError(400, 'Insufficient inventory for shipment', {
          insufficient_items: insufficientItems,
        });
      }

      const shipmentId = await shipmentsRepository.createShipment(client, {
        origin_warehouse_id: data.origin_warehouse_id,
        destination_address: data.destination_address,
        carrier: data.carrier,
        tracking_number: data.tracking_number,
      });

      for (const item of data.items) {
        const unitPrice = await shipmentsRepository.getProductUnitPrice(client, item.product_id);

        await shipmentsRepository.createShipmentItem(client, {
          shipment_id: shipmentId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice,
        });

        await shipmentsRepository.insertOutboundMovement(client, {
          product_id: item.product_id,
          warehouse_id: data.origin_warehouse_id,
          change_amount: -item.quantity,
          reference_type: `shipment_${shipmentId}`,
        });
      }

      return shipmentId;
    });

    const shipment = await shipmentsRepository.findById(shipmentId);
    return shipment!;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

export async function updateShipmentStatus(
  shipmentId: number,
  data: UpdateShipmentStatusInput
): Promise<ShipmentDetailRow> {
  try {
    await withTransaction(async (client) => {
      const currentStatus = await shipmentsRepository.getShipmentStatus(client, shipmentId);
      if (currentStatus === null) {
        throw new AppError(404, 'Shipment not found');
      }

      const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNextStatuses.includes(data.status)) {
        throw new AppError(400, `Invalid status transition: cannot change from '${currentStatus}' to '${data.status}'. Allowed transitions from '${currentStatus}': ${allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none'}`);
      }

      const setDeliveredAt = data.status === 'delivered';
      await shipmentsRepository.updateStatus(client, shipmentId, data.status, setDeliveredAt);
    });

    const shipment = await shipmentsRepository.findById(shipmentId);
    return shipment!;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}
