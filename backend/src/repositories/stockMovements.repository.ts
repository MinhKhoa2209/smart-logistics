import { PoolClient } from 'pg';
import { query } from '../config/database';
import { CreateStockMovementInput, UpdateStockMovementInput } from '../validators/stockMovements.validator';

export interface StockMovementRow {
  movement_id: string;
  product_id: number;
  product_name: string;
  warehouse_id: number;
  warehouse_name: string;
  change_amount: number;
  movement_type: string;
  lot_id: number | null;
  lot_number: string | null;
  unit_cost: number | null;
  reference_id: number | null;
  reference_type: string | null;
  note: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  start_date?: string;
  end_date?: string;
  movement_type?: string;
}

export async function findAll(options: FindAllOptions): Promise<{ rows: StockMovementRow[]; total: number; }> {
  const { page, pageSize, start_date, end_date, movement_type } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (start_date) {
    conditions.push(`sm.created_at >= $${paramIndex}`);
    params.push(start_date);
    paramIndex++;
  }

  if (end_date) {
    conditions.push(`sm.created_at <= $${paramIndex}`);
    params.push(end_date);
    paramIndex++;
  }

  if (movement_type) {
    conditions.push(`sm.movement_type = $${paramIndex}`);
    params.push(movement_type);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM stock_movements sm ${whereClause}`;
  const countResult = await query<{ total: string; }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT
      sm.movement_id,
      sm.product_id,
      p.name as product_name,
      sm.warehouse_id,
      w.name as warehouse_name,
      sm.change_amount,
      sm.movement_type,
      sm.lot_id,
      pl.lot_number,
      sm.unit_cost,
      sm.reference_id,
      sm.reference_type,
      sm.note,
      sm.created_by,
      u.full_name as created_by_name,
      sm.created_at
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.product_id
    JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
    LEFT JOIN product_lots pl ON sm.lot_id = pl.lot_id
    LEFT JOIN users u ON sm.created_by = u.user_id
    ${whereClause}
    ORDER BY sm.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<StockMovementRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

const movementSelectSql = `
  SELECT
    sm.movement_id,
    sm.product_id,
    p.name as product_name,
    sm.warehouse_id,
    w.name as warehouse_name,
    sm.change_amount,
    sm.movement_type,
    sm.lot_id,
    pl.lot_number,
    sm.unit_cost,
    sm.reference_id,
    sm.reference_type,
    sm.note,
    sm.created_by,
    u.full_name as created_by_name,
    sm.created_at
  FROM stock_movements sm
  JOIN products p ON sm.product_id = p.product_id
  JOIN warehouses w ON sm.warehouse_id = w.warehouse_id
  LEFT JOIN product_lots pl ON sm.lot_id = pl.lot_id
  LEFT JOIN users u ON sm.created_by = u.user_id
`;

export async function findById(movementId: number): Promise<StockMovementRow | null> {
  const result = await query<StockMovementRow>(
    `${movementSelectSql} WHERE sm.movement_id = $1 LIMIT 1`,
    [movementId]
  );

  return result.rows[0] ?? null;
}

export async function findByIdForUpdate(client: PoolClient, movementId: number): Promise<StockMovementRow | null> {
  const result = await client.query<StockMovementRow>(
    `${movementSelectSql} WHERE sm.movement_id = $1 LIMIT 1 FOR UPDATE OF sm`,
    [movementId]
  );

  return result.rows[0] ?? null;
}

export async function findByIdWithClient(client: PoolClient, movementId: number): Promise<StockMovementRow | null> {
  const result = await client.query<StockMovementRow>(
    `${movementSelectSql} WHERE sm.movement_id = $1 LIMIT 1`,
    [movementId]
  );

  return result.rows[0] ?? null;
}

export async function create(client: PoolClient, data: CreateStockMovementInput): Promise<StockMovementRow> {
  const result = await client.query<{ movement_id: string }>(
    `
      INSERT INTO stock_movements (
        product_id,
        warehouse_id,
        change_amount,
        movement_type,
        unit_cost,
        lot_id,
        reference_id,
        reference_type,
        note,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING movement_id
    `,
    [
      data.product_id,
      data.warehouse_id,
      data.change_amount,
      data.movement_type,
      data.unit_cost ?? null,
      data.lot_id ?? null,
      data.reference_id ?? null,
      data.reference_type ?? null,
      data.note ?? null,
      data.created_by ?? 1,
    ]
  );

  const movement = await findByIdWithClient(client, Number(result.rows[0].movement_id));
  return movement!;
}

export async function update(
  client: PoolClient,
  movementId: number,
  data: UpdateStockMovementInput
): Promise<StockMovementRow | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.product_id !== undefined) {
    fields.push(`product_id = $${paramIndex++}`);
    params.push(data.product_id);
  }
  if (data.warehouse_id !== undefined) {
    fields.push(`warehouse_id = $${paramIndex++}`);
    params.push(data.warehouse_id);
  }
  if (data.change_amount !== undefined) {
    fields.push(`change_amount = $${paramIndex++}`);
    params.push(data.change_amount);
  }
  if (data.movement_type !== undefined) {
    fields.push(`movement_type = $${paramIndex++}`);
    params.push(data.movement_type);
  }
  if (data.unit_cost !== undefined) {
    fields.push(`unit_cost = $${paramIndex++}`);
    params.push(data.unit_cost);
  }
  if (data.lot_id !== undefined) {
    fields.push(`lot_id = $${paramIndex++}`);
    params.push(data.lot_id);
  }
  if (data.reference_id !== undefined) {
    fields.push(`reference_id = $${paramIndex++}`);
    params.push(data.reference_id);
  }
  if (data.reference_type !== undefined) {
    fields.push(`reference_type = $${paramIndex++}`);
    params.push(data.reference_type);
  }
  if (data.note !== undefined) {
    fields.push(`note = $${paramIndex++}`);
    params.push(data.note);
  }
  if (data.created_by !== undefined) {
    fields.push(`created_by = $${paramIndex++}`);
    params.push(data.created_by);
  }

  if (fields.length > 0) {
    params.push(movementId);
    await client.query(
      `UPDATE stock_movements SET ${fields.join(', ')} WHERE movement_id = $${paramIndex}`,
      params
    );
  }

  return findByIdWithClient(client, movementId);
}
