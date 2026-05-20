import { query } from '../config/database';

export interface ProductLotRow {
  lot_id: number;
  product_id: number;
  product_name: string;
  lot_number: string;
  manufacture_date: string;
  expiry_date: string;
  supplier_id: number | null;
  supplier_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LotInventoryRow {
  warehouse_id: number;
  warehouse_name: string;
  quantity: number;
}

export interface ProductLotWithInventory extends ProductLotRow {
  inventory: LotInventoryRow[];
}

export interface ExpiringLotRow extends ProductLotRow {
  days_until_expiry: number;
  expiry_classification: 'critical' | 'warning';
}

interface FindAllOptions {
  page: number;
  pageSize: number;
}

export async function findAll(options: FindAllOptions): Promise<{ rows: ProductLotWithInventory[]; total: number; }> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;

  const countResult = await query<{ total: string; }>(`SELECT COUNT(*) as total FROM product_lots`);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT
      pl.lot_id,
      pl.product_id,
      p.name as product_name,
      pl.lot_number,
      pl.manufacture_date,
      pl.expiry_date,
      pl.supplier_id,
      s.name as supplier_name,
      pl.is_active,
      pl.created_at,
      pl.created_at as updated_at,
      COALESCE(
        json_agg(
          json_build_object(
            'warehouse_id', i.warehouse_id,
            'warehouse_name', w.name,
            'quantity', i.quantity
          ) ORDER BY w.name
        ) FILTER (WHERE i.inventory_id IS NOT NULL),
        '[]'
      ) as inventory
    FROM product_lots pl
    JOIN products p ON pl.product_id = p.product_id
    LEFT JOIN suppliers s ON pl.supplier_id = s.supplier_id
    LEFT JOIN inventory i ON i.lot_id = pl.lot_id
    LEFT JOIN warehouses w ON w.warehouse_id = i.warehouse_id
    GROUP BY pl.lot_id, p.name, s.name
    ORDER BY pl.expiry_date ASC
    LIMIT $1 OFFSET $2
  `;

  const dataResult = await query<ProductLotRow & { inventory: LotInventoryRow[]; }>(dataSql, [pageSize, offset]);

  return { rows: dataResult.rows, total };
}

export async function findExpiring(options: FindAllOptions): Promise<{ rows: ExpiringLotRow[]; total: number; }> {
  const { page, pageSize } = options;
  const offset = (page - 1) * pageSize;

  const countSql = `
    SELECT COUNT(*) as total
    FROM product_lots
    WHERE is_active = true
      AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      AND expiry_date >= CURRENT_DATE
  `;
  const countResult = await query<{ total: string; }>(countSql);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT
      pl.lot_id,
      pl.product_id,
      p.name as product_name,
      pl.lot_number,
      pl.manufacture_date,
      pl.expiry_date,
      pl.supplier_id,
      s.name as supplier_name,
      pl.is_active,
      pl.created_at,

      (pl.expiry_date - CURRENT_DATE) as days_until_expiry
    FROM product_lots pl
    JOIN products p ON pl.product_id = p.product_id
    LEFT JOIN suppliers s ON pl.supplier_id = s.supplier_id
    WHERE pl.is_active = true
      AND pl.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      AND pl.expiry_date >= CURRENT_DATE
    ORDER BY pl.expiry_date ASC
    LIMIT $1 OFFSET $2
  `;

  const dataResult = await query<ExpiringLotRow>(dataSql, [pageSize, offset]);

  return { rows: dataResult.rows, total };
}
