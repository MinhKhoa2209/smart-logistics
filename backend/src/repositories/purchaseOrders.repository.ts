import { PoolClient } from 'pg';
import { query } from '../config/database';

/**
 * Purchase Orders repository — handles all database queries for the purchase orders domain.
 */

export interface PurchaseOrderRow {
  order_id: number;
  supplier_id: number;
  supplier_name: string;
  warehouse_id: number;
  warehouse_name: string;
  status: string;
  total_amount: number;
  created_by: number | null;
  created_by_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  order_item_id: number;
  order_id: number;
  product_id: number;
  product_name: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number;
}

export interface PurchaseOrderDetailRow extends PurchaseOrderRow {
  items: OrderItemRow[];
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  status?: string;
  supplier_id?: number;
}

/**
 * Find all purchase orders with pagination and optional filters.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: PurchaseOrderRow[]; total: number }> {
  const { page, pageSize, status, supplier_id } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`po.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (supplier_id) {
    conditions.push(`po.supplier_id = $${paramIndex}`);
    params.push(supplier_id);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM purchase_orders po ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  // Data query with supplier, warehouse, and user joins
  const dataSql = `
    SELECT 
      po.order_id,
      po.supplier_id,
      s.name as supplier_name,
      po.warehouse_id,
      w.name as warehouse_name,
      po.status,
      po.total_amount,
      po.created_by,
      u.full_name as created_by_name,
      po.note,
      po.created_at,
      po.updated_at
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.supplier_id
    JOIN warehouses w ON po.warehouse_id = w.warehouse_id
    LEFT JOIN users u ON po.created_by = u.user_id
    ${whereClause}
    ORDER BY po.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<PurchaseOrderRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

/**
 * Find a purchase order by ID with its items.
 */
export async function findById(orderId: number): Promise<PurchaseOrderDetailRow | null> {
  const orderSql = `
    SELECT 
      po.order_id,
      po.supplier_id,
      s.name as supplier_name,
      po.warehouse_id,
      w.name as warehouse_name,
      po.status,
      po.total_amount,
      po.created_by,
      u.full_name as created_by_name,
      po.note,
      po.created_at,
      po.updated_at
    FROM purchase_orders po
    JOIN suppliers s ON po.supplier_id = s.supplier_id
    JOIN warehouses w ON po.warehouse_id = w.warehouse_id
    LEFT JOIN users u ON po.created_by = u.user_id
    WHERE po.order_id = $1
  `;

  const orderResult = await query<PurchaseOrderRow>(orderSql, [orderId]);
  if (orderResult.rows.length === 0) {
    return null;
  }

  // Get order items
  const itemsSql = `
    SELECT 
      oi.order_item_id,
      oi.order_id,
      oi.product_id,
      p.name as product_name,
      oi.ordered_quantity,
      oi.received_quantity,
      oi.unit_cost
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.order_item_id ASC
  `;

  const itemsResult = await query<OrderItemRow>(itemsSql, [orderId]);

  return {
    ...orderResult.rows[0],
    items: itemsResult.rows,
  };
}

/**
 * Create a purchase order and its items within a transaction.
 * The client must already have an open transaction (BEGIN issued by caller).
 */
export async function createWithItems(
  client: PoolClient,
  data: {
    supplier_id: number;
    warehouse_id: number;
    total_amount: number;
    notes?: string | null;
  },
  items: Array<{ product_id: number; ordered_quantity: number; unit_cost: number }>
): Promise<number> {
  // Insert purchase order
  const orderSql = `
    INSERT INTO purchase_orders (supplier_id, warehouse_id, status, total_amount, notes)
    VALUES ($1, $2, 'pending', $3, $4)
    RETURNING order_id
  `;

  const orderResult = await client.query<{ order_id: number }>(orderSql, [
    data.supplier_id,
    data.warehouse_id,
    data.total_amount,
    data.notes || null,
  ]);

  const orderId = orderResult.rows[0].order_id;

  // Insert order items
  for (const item of items) {
    const itemSql = `
      INSERT INTO order_items (order_id, product_id, ordered_quantity, received_quantity, unit_cost)
      VALUES ($1, $2, $3, 0, $4)
    `;
    await client.query(itemSql, [orderId, item.product_id, item.ordered_quantity, item.unit_cost]);
  }

  return orderId;
}

/**
 * Get order items for a specific purchase order (used during receiving).
 * Uses the provided client to participate in the same transaction.
 */
export async function getOrderItems(
  client: PoolClient,
  orderId: number
): Promise<OrderItemRow[]> {
  const sql = `
    SELECT 
      oi.order_item_id,
      oi.order_id,
      oi.product_id,
      p.name as product_name,
      oi.ordered_quantity,
      oi.received_quantity,
      oi.unit_cost
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    WHERE oi.order_id = $1
    ORDER BY oi.order_item_id ASC
  `;

  const result = await client.query<OrderItemRow>(sql, [orderId]);
  return result.rows;
}

/**
 * Update received_quantity for an order item within a transaction.
 */
export async function updateReceivedQuantity(
  client: PoolClient,
  orderItemId: number,
  additionalQuantity: number
): Promise<void> {
  const sql = `
    UPDATE order_items
    SET received_quantity = received_quantity + $1
    WHERE order_item_id = $2
  `;
  await client.query(sql, [additionalQuantity, orderItemId]);
}

/**
 * Insert a stock movement for inbound receiving within a transaction.
 */
export async function insertInboundMovement(
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
    VALUES ($1, $2, $3, 'inbound', $4)
  `;
  await client.query(sql, [
    data.product_id,
    data.warehouse_id,
    data.change_amount,
    data.reference_type,
  ]);
}

/**
 * Update purchase order status within a transaction.
 */
export async function updateStatus(
  client: PoolClient,
  orderId: number,
  status: string
): Promise<void> {
  const sql = `
    UPDATE purchase_orders
    SET status = $1
    WHERE order_id = $2
  `;
  await client.query(sql, [status, orderId]);
}

/**
 * Get the warehouse_id for a purchase order (used during receiving).
 */
export async function getOrderWarehouseId(
  client: PoolClient,
  orderId: number
): Promise<number | null> {
  const sql = `SELECT warehouse_id FROM purchase_orders WHERE order_id = $1`;
  const result = await client.query<{ warehouse_id: number }>(sql, [orderId]);
  return result.rows.length > 0 ? result.rows[0].warehouse_id : null;
}
