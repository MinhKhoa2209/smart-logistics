import * as customerOrdersRepository from '../repositories/customerOrders.repository';
import { UpdateCustomerOrderStatusInput, CreatePaymentInput } from '../validators/customerOrders.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { CustomerOrderRow } from '../repositories/customerOrders.repository';

/**
 * Customer Orders service — business logic coordination for customer orders.
 */

interface ListCustomerOrdersOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  payment_status?: string;
}

/**
 * Get paginated list of customer orders with optional filters.
 */
export async function listCustomerOrders(
  options: ListCustomerOrdersOptions
): Promise<PaginatedResponse<CustomerOrderRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await customerOrdersRepository.findAll({
    page,
    pageSize,
    status: options.status,
    payment_status: options.payment_status,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

/**
 * Update customer order status with business logic validation.
 *
 * - Status update to 'processing': validates inventory for all items in assigned warehouse.
 * - Status update to 'shipped': creates shipment, links via shipment_orders,
 *   inserts outbound movements, and updates status — all in one transaction.
 */
export async function updateCustomerOrderStatus(
  customerOrderId: number,
  data: UpdateCustomerOrderStatusInput
): Promise<CustomerOrderRow> {
  try {
    const result = await withTransaction(async (client) => {
      // Get the order
      const order = await customerOrdersRepository.findById(client, customerOrderId);
      if (!order) {
        throw new AppError(404, 'Customer order not found');
      }

      // Get order items
      const items = await customerOrdersRepository.getOrderItems(client, customerOrderId);

      if (data.status === 'processing') {
        // Validate inventory for all items in the assigned warehouse
        const insufficientItems: Array<{
          product_id: number;
          product_name: string;
          requested: number;
          available: number;
        }> = [];

        for (const item of items) {
          const available = await customerOrdersRepository.getAvailableInventory(
            client,
            order.warehouse_id,
            item.product_id
          );

          if (item.quantity > available) {
            insufficientItems.push({
              product_id: item.product_id,
              product_name: item.product_name,
              requested: item.quantity,
              available,
            });
          }
        }

        if (insufficientItems.length > 0) {
          throw new AppError(400, 'Insufficient inventory for order processing', {
            insufficient_items: insufficientItems,
          });
        }

        // Update status to processing
        await customerOrdersRepository.updateStatus(client, customerOrderId, 'processing');
      } else if (data.status === 'shipped') {
        // Create shipment, link via shipment_orders, insert outbound movements, update status
        // All in one transaction

        // Step 1: Create shipment record
        const shipmentId = await customerOrdersRepository.createShipment(client, {
          origin_warehouse_id: order.warehouse_id,
          destination_address: order.shipping_address,
        });

        // Step 2: Link shipment to customer order via shipment_orders
        await customerOrdersRepository.createShipmentOrder(client, shipmentId, customerOrderId);

        // Step 3: Insert outbound stock movements for each order item
        for (const item of items) {
          await customerOrdersRepository.insertOutboundMovement(client, {
            product_id: item.product_id,
            warehouse_id: order.warehouse_id,
            change_amount: -item.quantity,
            reference_type: `customer_order_${customerOrderId}`,
          });
        }

        // Step 4: Update order status to shipped
        await customerOrdersRepository.updateStatus(client, customerOrderId, 'shipped');
      } else {
        // For other status transitions, just update the status
        await customerOrdersRepository.updateStatus(client, customerOrderId, data.status);
      }

      // Return the updated order
      const updatedOrder = await customerOrdersRepository.findById(client, customerOrderId);
      return updatedOrder!;
    });

    return result;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

/**
 * Record a payment for a customer order.
 * Inserts a payment record and updates payment_status:
 * - 'paid' if cumulative payments >= total_amount
 * - 'partial' if cumulative payments < total_amount
 *
 * Rejects if amount <= 0.
 */
export async function recordPayment(
  customerOrderId: number,
  data: CreatePaymentInput
): Promise<{ payment_id: number; payment_status: string }> {
  try {
    const result = await withTransaction(async (client) => {
      // Verify order exists
      const order = await customerOrdersRepository.findById(client, customerOrderId);
      if (!order) {
        throw new AppError(404, 'Customer order not found');
      }

      // Reject if amount <= 0 (also validated by Zod, but double-check)
      if (data.amount <= 0) {
        throw new AppError(400, 'Payment amount must be greater than zero');
      }

      // Insert payment record
      const { payment_id } = await customerOrdersRepository.insertPayment(client, {
        customer_order_id: customerOrderId,
        amount: data.amount,
        payment_method: data.payment_method,
      });

      // Get cumulative payments (including the one just inserted)
      const cumulativePayments = await customerOrdersRepository.getCumulativePayments(
        client,
        customerOrderId
      );

      // Determine new payment status
      const totalAmount = parseFloat(String(order.total_amount));
      const newPaymentStatus = cumulativePayments >= totalAmount ? 'paid' : 'partial';

      // Update payment_status on the order
      await customerOrdersRepository.updatePaymentStatus(client, customerOrderId, newPaymentStatus);

      return { payment_id, payment_status: newPaymentStatus };
    });

    return result;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}
