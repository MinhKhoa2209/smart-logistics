import { PoolClient } from 'pg';
import { query } from '../config/database';

/**
 * Shipments repository — handles all database queries for the shipments domain.
 */

export interface ShipmentRow {
  shipment_id: number;
  origin_warehouse_id: number;
  origin_warehouse_name: string;
  destination_address: string;
  status: string;
  carrier: string;
  tracking_number: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentItemRow {
  shipment_item_id: number;
  shipment_id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: number;
}

export interface ShipmentDetailRow extends ShipmentRow {
  items: ShipmentItemRow[];
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  status?: string;
  origin_warehouse_id?: number;
}

/**
 * Find all shipments with pagination and optional filters.
 */
export async function findAll(options: FindAllOptions): Promise<{ rows: ShipmentRow[]; total: number }> {
  const { page, pageSize, status, origin_warehouse_id } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`s.status = $${paramIndex}`);
    params.push(status);
    paramIndex++;
  }

  if (origin_warehouse_id) {
    conditions.push(`s.origin_warehouse_id = $${paramIndex}`);
    params.push(origin_warehouse_id);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count query
  const countSql = `SELECT COUNT(*) as total FROM shipments s ${whereClause}`;
  const countResult = await query<{ total: string }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT 
      s.shipment_id,
      s.origin_warehouse_id,
      w.name as origin_warehouse_name,
      s.destination_address,
      s.status,
      s.carrier,
      s.tracking_number,
      s.delivered_at,
      s.created_at,
      s.updated_at
    FROM shipments s
    JOIN warehouses w ON s.origin_warehouse_id = w.warehouse_id
    ${whereClause}
    ORDER BY s.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<ShipmentRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

/**
 * Find a shipment by ID with its items.
 */
export async function findById(shipmentId: number): Promise<ShipmentDetailRow | null> {
  const shipmentSql = `
    SELECT 
      s.shipment_id,
      s.origin_warehouse_id,
      w.name as origin_warehouse_name,
      s.destination_address,
      s.status,
      s.carrier,
      s.tracking_number,
      s.delivered_at,
      s.created_at,
      s.updated_at
    FROM shipments s
    JOIN warehouses w ON s.origin_warehouse_id = w.warehouse_id
    WHERE s.shipment_id = $1
  `;

  const shipmentResult = await query<ShipmentRow>(shipmentSql, [shipmentId]);
  if (shipmentResult.rows.length === 0) {
    return null;
  }

  // Get shipment items
  const itemsSql = `
    SELECT 
      si.shipment_item_id,
      si.shipment_id,
      si.product_id,
      p.name as product_name,
      si.quantity,
      si.unit_price
    FROM shipment_items si
    JOIN products p ON si.product_id = p.product_id
    WHERE si.shipment_id = $1
    ORDER BY si.shipment_item_id ASC
  `;

  const itemsResult = await query<ShipmentItemRow>(itemsSql, [shipmentId]);

  return {
    ...shipmentResult.rows[0],
    items: itemsResult.rows,
  };
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
 * Create a shipment record within a transaction.
 */
export async function createShipment(
  client: PoolClient,
  data: {
    origin_warehouse_id: number;
    destination_address: string;
    carrier: string;
    tracking_number?: string | null;
  }
): Promise<number> {
  const sql = `
    INSERT INTO shipments (origin_warehouse_id, destination_address, status, carrier, tracking_number)
    VALUES ($1, $2, 'pending', $3, $4)
    RETURNING shipment_id
  `;

  const result = await client.query<{ shipment_id: number }>(sql, [
    data.origin_warehouse_id,
    data.destination_address,
    data.carrier,
    data.tracking_number || null,
  ]);

  return result.rows[0].shipment_id;
}

/**
 * Insert a shipment item within a transaction.
 */
export async function createShipmentItem(
  client: PoolClient,
  data: {
    shipment_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
  }
): Promise<void> {
  const sql = `
    INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price)
    VALUES ($1, $2, $3, $4)
  `;
  await client.query(sql, [data.shipment_id, data.product_id, data.quantity, data.unit_price]);
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
 * Get the current status of a shipment within a transaction.
 */
export async function getShipmentStatus(
  client: PoolClient,
  shipmentId: number
): Promise<string | null> {
  const sql = `SELECT status FROM shipments WHERE shipment_id = $1`;
  const result = await client.query<{ status: string }>(sql, [shipmentId]);
  return result.rows.length > 0 ? result.rows[0].status : null;
}

/**
 * Update shipment status within a transaction.
 * Sets delivered_at when transitioning to 'delivered'.
 */
export async function updateStatus(
  client: PoolClient,
  shipmentId: number,
  newStatus: string,
  setDeliveredAt: boolean = false
): Promise<void> {
  let sql: string;
  let params: any[];

  if (setDeliveredAt) {
    sql = `
      UPDATE shipments
      SET status = $1, delivered_at = NOW()
      WHERE shipment_id = $2
    `;
    params = [newStatus, shipmentId];
  } else {
    sql = `
      UPDATE shipments
      SET status = $1
      WHERE shipment_id = $2
    `;
    params = [newStatus, shipmentId];
  }

  await client.query(sql, params);
}

/**
 * Get the unit_price for a product (used when creating shipment items).
 */
export async function getProductUnitPrice(
  client: PoolClient,
  productId: number
): Promise<number> {
  const sql = `SELECT COALESCE(unit_price, 0) as unit_price FROM products WHERE product_id = $1`;
  const result = await client.query<{ unit_price: string }>(sql, [productId]);
  return result.rows.length > 0 ? parseFloat(result.rows[0].unit_price) : 0;
}
