import { query } from '../config/database';
import { queryWithContext } from '../middleware/appContext';
import { CreateProductInput, UpdateProductInput } from '../validators/products.validator';

export interface ProductRow {
  product_id: number;
  sku: string;
  name: string;
  category: string | null;
  unit: string;
  unit_cost: number | null;
  unit_price: number | null;
  min_stock_level: number;
  supplier_id: number | null;
  supplier_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductDetailRow extends ProductRow {
  inventory?: ProductInventoryRow[];
}

export interface ProductInventoryRow {
  inventory_id: number;
  warehouse_id: number;
  warehouse_name: string;
  lot_id: number | null;
  lot_number: string | null;
  quantity: number;
  reorder_point: number;
  max_stock_level: number | null;
}

interface FindAllOptions {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
  supplier_id?: number;
}

export async function findAll(options: FindAllOptions): Promise<{ rows: ProductRow[]; total: number; }> {
  const { page, pageSize, search, category, supplier_id } = options;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(p.name ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (category) {
    conditions.push(`p.category = $${paramIndex}`);
    params.push(category);
    paramIndex++;
  }

  if (supplier_id) {
    conditions.push(`p.supplier_id = $${paramIndex}`);
    params.push(supplier_id);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
  const countResult = await query<{ total: string; }>(countSql, params);
  const total = parseInt(countResult.rows[0].total, 10);

  const dataSql = `
    SELECT
      p.product_id,
      p.sku,
      p.name,
      p.category,
      p.unit,
      p.unit_cost,
      p.unit_price,
      p.min_stock_level,
      p.supplier_id,
      s.name as supplier_name,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const dataResult = await query<ProductRow>(dataSql, [...params, pageSize, offset]);

  return { rows: dataResult.rows, total };
}

export async function findById(productId: number): Promise<ProductDetailRow | null> {
  const productSql = `
    SELECT
      p.product_id,
      p.sku,
      p.name,
      p.category,
      p.unit,
      p.unit_cost,
      p.unit_price,
      p.min_stock_level,
      p.supplier_id,
      s.name as supplier_name,
      p.is_active,
      p.created_at,
      p.updated_at
    FROM products p
    LEFT JOIN suppliers s ON p.supplier_id = s.supplier_id
    WHERE p.product_id = $1
  `;

  const productResult = await query<ProductRow>(productSql, [productId]);
  if (productResult.rows.length === 0) {
    return null;
  }

  const inventorySql = `
    SELECT
      i.inventory_id,
      i.warehouse_id,
      w.name as warehouse_name,
      i.lot_id,
      pl.lot_number,
      i.quantity,
      i.reorder_point,
      i.max_stock_level
    FROM inventory i
    JOIN warehouses w ON i.warehouse_id = w.warehouse_id
    LEFT JOIN product_lots pl ON i.lot_id = pl.lot_id
    WHERE i.product_id = $1
    ORDER BY w.name ASC
  `;

  const inventoryResult = await queryWithContext<ProductInventoryRow>(inventorySql, [productId]);

  return {
    ...productResult.rows[0],
    inventory: inventoryResult.rows,
  };
}

export async function create(data: CreateProductInput): Promise<ProductRow> {
  const sql = `
    INSERT INTO products (sku, name, category, unit, unit_cost, unit_price, min_stock_level, supplier_id, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING product_id, sku, name, category, unit, unit_cost, unit_price, min_stock_level, supplier_id, is_active, created_at, updated_at
  `;

  const params = [
    data.sku,
    data.name,
    data.category || null,
    data.unit,
    data.unit_cost,
    data.unit_price,
    data.min_stock_level ?? 0,
    data.supplier_id,
    data.is_active ?? true,
  ];

  const result = await query<ProductRow>(sql, params);

  const productWithSupplier = await findById(result.rows[0].product_id);
  return productWithSupplier!;
}

export async function update(productId: number, data: UpdateProductInput): Promise<ProductRow | null> {
  const fields: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (data.sku !== undefined) {
    fields.push(`sku = $${paramIndex++}`);
    params.push(data.sku);
  }
  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    params.push(data.name);
  }
  if (data.category !== undefined) {
    fields.push(`category = $${paramIndex++}`);
    params.push(data.category);
  }
  if (data.unit !== undefined) {
    fields.push(`unit = $${paramIndex++}`);
    params.push(data.unit);
  }
  if (data.unit_cost !== undefined) {
    fields.push(`unit_cost = $${paramIndex++}`);
    params.push(data.unit_cost);
  }
  if (data.unit_price !== undefined) {
    fields.push(`unit_price = $${paramIndex++}`);
    params.push(data.unit_price);
  }
  if (data.min_stock_level !== undefined) {
    fields.push(`min_stock_level = $${paramIndex++}`);
    params.push(data.min_stock_level);
  }
  if (data.supplier_id !== undefined) {
    fields.push(`supplier_id = $${paramIndex++}`);
    params.push(data.supplier_id);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    params.push(data.is_active);
  }

  if (fields.length === 0) {
    return findById(productId) as Promise<ProductRow | null>;
  }

  const sql = `
    UPDATE products
    SET ${fields.join(', ')}
    WHERE product_id = $${paramIndex}
    RETURNING product_id
  `;

  params.push(productId);

  const result = await query<{ product_id: number; }>(sql, params);
  if (result.rows.length === 0) {
    return null;
  }

  return findById(productId) as Promise<ProductRow | null>;
}
