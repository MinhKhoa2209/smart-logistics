import * as customerOrdersRepository from '../repositories/customerOrders.repository';
import { UpdateCustomerOrderStatusInput, CreatePaymentInput } from '../validators/customerOrders.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { withTransaction } from '../utils/transaction';
import { AppError, parsePgError } from '../middleware';
import { CustomerOrderRow } from '../repositories/customerOrders.repository';

interface ListCustomerOrdersOptions {
  page?: string;
  pageSize?: string;
  status?: string;
  payment_status?: string;
}

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

export async function updateCustomerOrderStatus(
  customerOrderId: number,
  data: UpdateCustomerOrderStatusInput
): Promise<CustomerOrderRow> {
  try {
    const result = await withTransaction(async (client) => {
      const order = await customerOrdersRepository.findById(client, customerOrderId);
      if (!order) {
        throw new AppError(404, 'Customer order not found');
      }

      const items = await customerOrdersRepository.getOrderItems(client, customerOrderId);

      if (data.status === 'processing') {
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

        await customerOrdersRepository.updateStatus(client, customerOrderId, 'processing');
      } else if (data.status === 'shipped') {
        const shipmentId = await customerOrdersRepository.createShipment(client, {
          origin_warehouse_id: order.warehouse_id,
          destination_address: order.shipping_address,
        });

        await customerOrdersRepository.createShipmentOrder(client, shipmentId, customerOrderId);

        for (const item of items) {
          await customerOrdersRepository.insertOutboundMovement(client, {
            product_id: item.product_id,
            warehouse_id: order.warehouse_id,
            change_amount: -item.quantity,
            reference_type: `customer_order_${customerOrderId}`,
          });
        }

        await customerOrdersRepository.updateStatus(client, customerOrderId, 'shipped');
      } else {
        await customerOrdersRepository.updateStatus(client, customerOrderId, data.status);
      }

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

export async function recordPayment(
  customerOrderId: number,
  data: CreatePaymentInput
): Promise<{ payment_id: number; payment_status: string; }> {
  try {
    const result = await withTransaction(async (client) => {
      const order = await customerOrdersRepository.findById(client, customerOrderId);
      if (!order) {
        throw new AppError(404, 'Customer order not found');
      }

      if (data.amount <= 0) {
        throw new AppError(400, 'Payment amount must be greater than zero');
      }

      const { payment_id } = await customerOrdersRepository.insertPayment(client, {
        customer_order_id: customerOrderId,
        amount: data.amount,
        payment_method: data.payment_method,
      });

      const cumulativePayments = await customerOrdersRepository.getCumulativePayments(
        client,
        customerOrderId
      );

      const totalAmount = parseFloat(String(order.total_amount));
      const newPaymentStatus = cumulativePayments >= totalAmount ? 'paid' : 'partial';

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
