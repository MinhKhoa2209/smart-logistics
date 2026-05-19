import { PoolClient } from 'pg';
import { query } from '../config/database';

/**
 * Customer Orders repository — handles all database queries for the customer orders domain.
 */

export interface CustomerOrderRow {
  customer_order_id: number;
  customer_id: number;
  customer_name: string;
  warehouse_id: number;
  warehouse_name: string;
  status: string;
  shipping_address: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderItemRow {
  customer_order_item_id: number;
  customer_order_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  status?: string;
  payment_status?: string;
}

/**
 * Find all customer orders with pagination and optional filters.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: CustomerOrderRow[]; total: number }> {
  const { page, pageSize, status, payment_status } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`co.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (payment_status) {
    conditions.push(`(SELECT p.payment_status FROM payments p WHERE p.customer_order_id = co.customer_order_id ORDER BY p.created_at DESC LIMIT 1)::text = $${paramIndex}`);
    params.push(payment_status);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM customer_orders co ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query with customer and warehouse joins
  const dataSql = `
    SELECT 
      co.customer_order_id,
      co.customer_id,
      c.full_name as customer_name,
      co.warehouse_id,
      w.name as warehouse_name,
      co.status,
      co.shipping_address,
      co.total_amount,
      COALESCE((SELECT p.payment_status FROM payments p WHERE p.customer_order_id = co.customer_order_id ORDER BY p.created_at DESC LIMIT 1)::text, 'pending') as payment_status,
      co.created_at,
      co.updated_at
    FROM customer_orders co
    JOIN customers c ON co.customer_id = c.customer_id
    JOIN warehouses w ON co.warehouse_id = w.warehouse_id
    ${whereClause}
    ORDER BY co.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<CustomerOrderRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

/**
 * Find a customer order by ID (within a transaction client).
 */
export async function findById(
  client: PoolClient,
  customerOrderId: number
): Promise<CustomerOrderRow | null> {
  const sql = `
    SELECT 
      co.customer_order_id,
      co.customer_id,
      c.full_name as customer_name,
      co.warehouse_id,
      w.name as warehouse_name,
      co.status,
      co.shipping_address,
      co.total_amount,
      COALESCE((SELECT p.payment_status FROM payments p WHERE p.customer_order_id = co.customer_order_id ORDER BY p.created_at DESC LIMIT 1)::text, 'pending') as payment_status,
      co.created_at,
      co.updated_at
    FROM customer_orders co
    JOIN customers c ON co.customer_id = c.customer_id
    JOIN warehouses w ON co.warehouse_id = w.warehouse_id
    WHERE co.customer_order_id = $1
  `;

  const result = await client.query<CustomerOrderRow>(sql, [customerOrderId]);
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Get all items for a customer order (within a transaction client).
 */
export async function getOrderItems(
  client: PoolClient,
  customerOrderId: number
): Promise<CustomerOrderItemRow[]> {
  const sql = `
    SELECT 
      coi.customer_order_item_id,
      coi.customer_order_id,
      coi.product_id,
      p.name as product_name,
      coi.quantity,
      coi.unit_price
    FROM customer_order_items coi
    JOIN products p ON coi.product_id = p.product_id
    WHERE coi.customer_order_id = $1
    ORDER BY coi.customer_order_item_id ASC
  `;

  const result = await client.query<CustomerOrderItemRow>(sql, [customerOrderId]);
  return result.rows;
}

/**
 * Check available inventory for a product in a specific warehouse.
 * Returns the total available quantity across all lots.
 */
export async function getAvailableInventory(
  client: PoolClient,
  warehouseId: number,
  productId: number
): Promise<number> {
  const sql = `
    SELECT COALESCE(SUM(quantity), 0) as available
    FROM inventory
    WHERE warehouse_id = $1 AND product_id = $2
  `;
  const result = await client.query<{ available: string }>(sql, [warehouseId, productId]);
  return parseInt(result.rows[0].available, 10);
}

/**
 * Update customer order status within a transaction.
 */
export async function updateStatus(
  client: PoolClient,
  customerOrderId: number,
  newStatus: string
): Promise<void> {
  const sql = `
    UPDATE customer_orders
    SET status = $1, updated_at = NOW()
    WHERE customer_order_id = $2
  `;
  await client.query(sql, [newStatus, customerOrderId]);
}

/**
 * Create a shipment record within a transaction.
 * Returns the new shipment_id.
 */
export async function createShipment(
  client: PoolClient,
  data: {
    origin_warehouse_id: number;
    destination_address: string;
  }
): Promise<number> {
  const sql = `
    INSERT INTO shipments (origin_warehouse_id, destination_address, status, carrier, tracking_number)
    VALUES ($1, $2, 'pending', 'default', NULL)
    RETURNING shipment_id
  `;
  const result = await client.query<{ shipment_id: number }>(sql, [
    data.origin_warehouse_id,
    data.destination_address,
  ]);
  return result.rows[0].shipment_id;
}

/**
 * Link a shipment to a customer order via shipment_orders table.
 */
export async function createShipmentOrder(
  client: PoolClient,
  shipmentId: number,
  customerOrderId: number
): Promise<void> {
  const sql = `
    INSERT INTO shipment_orders (shipment_id, customer_order_id)
    VALUES ($1, $2)
  `;
  await client.query(sql, [shipmentId, customerOrderId]);
}

/**
 * Insert an outbound stock movement within a transaction.
 */
export async function insertOutboundMovement(
  client: PoolClient,
  data: {
    product_id: number;
    warehouse_id: number;
    change_amount: number;
    reference_type: string;
  }
): Promise<void> {
  const sql = `
    INSERT INTO stock_movements (product_id, warehouse_id, change_amount, movement_type, reference_type)
    VALUES ($1, $2, $3, 'outbound', $4)
  `;
  await client.query(sql, [
    data.product_id,
    data.warehouse_id,
    data.change_amount,
    data.reference_type,
  ]);
}

/**
 * Insert a payment record within a transaction.
 */
export async function insertPayment(
  client: PoolClient,
  data: {
    customer_order_id: number;
    amount: number;
    payment_method: string;
  }
): Promise<{ payment_id: number }> {
  const sql = `
    INSERT INTO payments (customer_order_id, amount, payment_method, payment_status)
    VALUES ($1, $2, $3, 'paid')
    RETURNING payment_id
  `;
  const result = await client.query<{ payment_id: number }>(sql, [
    data.customer_order_id,
    data.amount,
    data.payment_method,
  ]);
  return result.rows[0];
}

/**
 * Get the cumulative payment amount for a customer order.
 */
export async function getCumulativePayments(
  client: PoolClient,
  customerOrderId: number
): Promise<number> {
  const sql = `
    SELECT COALESCE(SUM(amount), 0) as total_paid
    FROM payments
    WHERE customer_order_id = $1
  `;
  const result = await client.query<{ total_paid: string }>(sql, [customerOrderId]);
  return parseFloat(result.rows[0].total_paid);
}

/**
 * Update the payment_status of a customer order.
 * Note: payment_status is derived from payments table, no column to update.
 */
export async function updatePaymentStatus(
  _client: PoolClient,
  _customerOrderId: number,
  _paymentStatus: string
): Promise<void> {
  // payment_status is computed from payments table, no direct column update needed
}
