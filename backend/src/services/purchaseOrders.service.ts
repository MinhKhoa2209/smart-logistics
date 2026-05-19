import * as purchaseOrdersRepository from '../repositories/purchaseOrders.repository';
import { CreatePurchaseOrderInput, ReceivePurchaseOrderInput } from '../validators/purchaseOrders.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { PurchaseOrderRow, PurchaseOrderDetailRow } from '../repositories/purchaseOrders.repository';

/**
 * Purchase Orders service — business logic coordination for purchase orders.
 */

interface ListPurchaseOrdersOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  supplier_id?: string;
}

/**
 * Get paginated list of purchase orders with optional filters.
 */
export async function listPurchaseOrders(
  options: ListPurchaseOrdersOptions
): Promise<PaginatedResponse<PurchaseOrderRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await purchaseOrdersRepository.findAll({
    page,
    pageSize,
    status: options.status,
    supplier_id: options.supplier_id ? parseInt(options.supplier_id, 10) : undefined,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

/**
 * Get a single purchase order by ID with items.
 */
export async function getPurchaseOrder(orderId: number): Promise<PurchaseOrderDetailRow> {
  const order = await purchaseOrdersRepository.findById(orderId);
  if (!order) {
    throw new AppError(404, 'Purchase order not found');
  }
  return order;
}

/**
 * Create a new purchase order with items within a single transaction.
 * Calculates total_amount as sum of (ordered_quantity * unit_cost) for all items.
 */
export async function createPurchaseOrder(
  data: CreatePurchaseOrderInput
): Promise<PurchaseOrderDetailRow> {
  // Calculate total amount
  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.ordered_quantity * item.unit_cost,
    0
  );

  try {
    const orderId = await withTransaction(async (client) => {
      return purchaseOrdersRepository.createWithItems(
        client,
        {
          supplier_id: data.supplier_id,
          warehouse_id: data.warehouse_id,
          total_amount: totalAmount,
          notes: data.notes,
        },
        data.items
      );
    });

    // Fetch the created order with full details
    const order = await purchaseOrdersRepository.findById(orderId);
    return order!;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

/**
 * Receive goods against a purchase order.
 * Validates over-receiving, updates received quantities, inserts stock movements,
 * and updates PO status within a single transaction.
 */
export async function receivePurchaseOrder(
  orderId: number,
  data: ReceivePurchaseOrderInput
): Promise<PurchaseOrderDetailRow> {
  try {
    await withTransaction(async (client) => {
      // Get the warehouse_id for this PO
      const warehouseId = await purchaseOrdersRepository.getOrderWarehouseId(client, orderId);
      if (warehouseId === null) {
        throw new AppError(404, 'Purchase order not found');
      }

      // Get current order items
      const orderItems = await purchaseOrdersRepository.getOrderItems(client, orderId);
      if (orderItems.length === 0) {
        throw new AppError(404, 'Purchase order not found');
      }

      // Build a map of order items for quick lookup
      const orderItemMap = new Map(
        orderItems.map((item) => [item.order_item_id, item])
      );

      // Validate each received item and check for over-receiving
      for (const receivedItem of data.items) {
        const orderItem = orderItemMap.get(receivedItem.order_item_id);
        if (!orderItem) {
          throw new AppError(400, `Order item ${receivedItem.order_item_id} not found in this purchase order`);
        }

        const newTotal = orderItem.received_quantity + receivedItem.received_quantity;
        if (newTotal > orderItem.ordered_quantity) {
          throw new AppError(400, 'Over-receiving is not allowed', {
            order_item_id: receivedItem.order_item_id,
            product_name: orderItem.product_name,
            ordered_quantity: orderItem.ordered_quantity,
            already_received: orderItem.received_quantity,
            attempted_receive: receivedItem.received_quantity,
            max_receivable: orderItem.ordered_quantity - orderItem.received_quantity,
          });
        }
      }

      // Update received quantities and insert stock movements
      for (const receivedItem of data.items) {
        const orderItem = orderItemMap.get(receivedItem.order_item_id)!;

        // Update received_quantity
        await purchaseOrdersRepository.updateReceivedQuantity(
          client,
          receivedItem.order_item_id,
          receivedItem.received_quantity
        );

        // Insert inbound stock movement
        await purchaseOrdersRepository.insertInboundMovement(client, {
          product_id: orderItem.product_id,
          warehouse_id: warehouseId,
          change_amount: receivedItem.received_quantity,
          reference_type: `po_${orderId}`,
        });
      }

      // Determine new PO status based on all items' received vs ordered quantities
      // Re-fetch items to get updated received_quantity values
      const updatedItems = await purchaseOrdersRepository.getOrderItems(client, orderId);

      const allFullyReceived = updatedItems.every(
        (item) => item.received_quantity >= item.ordered_quantity
      );
      const someReceived = updatedItems.some((item) => item.received_quantity > 0);

      let newStatus: string;
      if (allFullyReceived) {
        newStatus = 'received';
      } else if (someReceived) {
        newStatus = 'partially_received';
      } else {
        // No change needed if nothing received (shouldn't happen given validation)
        return;
      }

      await purchaseOrdersRepository.updateStatus(client, orderId, newStatus);
    });

    // Fetch and return the updated order
    const order = await purchaseOrdersRepository.findById(orderId);
    return order!;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}
