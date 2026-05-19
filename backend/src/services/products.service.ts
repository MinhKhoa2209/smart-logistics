import * as productsRepository from '../repositories/products.repository';
import { CreateProductInput, UpdateProductInput } from '../validators/products.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { AppError, parsePgError } from '../middleware';
import { ProductRow, ProductDetailRow } from '../repositories/products.repository';

/**
 * Products service — business logic coordination for products.
 */

interface ListProductsOptions {
  page?: string;
  pageSize?: string;
  search?: string;
  category?: string;
  supplier_id?: string;
}

/**
 * Get paginated list of products with optional filters.
 */
export async function listProducts(options: ListProductsOptions): Promise<PaginatedResponse<ProductRow>> {
  const { page, pageSize } = parsePaginationParams(
    { page: options.page, pageSize: options.pageSize },
    20
  );

  const { rows, total } = await productsRepository.findAll({
    page,
    pageSize,
    search: options.search,
    category: options.category,
    supplier_id: options.supplier_id ? parseInt(options.supplier_id, 10) : undefined,
  });

  return formatPaginatedResponse(rows, total, page, pageSize);
}

/**
 * Get a single product by ID with inventory details.
 */
export async function getProduct(productId: number): Promise<ProductDetailRow> {
  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  return product;
}

/**
 * Create a new product.
 * Handles duplicate SKU (PostgreSQL error code 23505).
 */
export async function createProduct(data: CreateProductInput): Promise<ProductRow> {
  try {
    return await productsRepository.create(data);
  } catch (error: any) {
    // Handle duplicate SKU
    if (error.code === '23505' && error.constraint?.includes('sku')) {
      throw new AppError(409, 'A product with this SKU already exists', {
        field: 'sku',
        value: data.sku,
      });
    }
    // Handle other PG errors
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

/**
 * Update an existing product.
 * Handles duplicate SKU on update.
 */
export async function updateProduct(productId: number, data: UpdateProductInput): Promise<ProductRow> {
  try {
    const product = await productsRepository.update(productId, data);
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    return product;
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    // Handle duplicate SKU
    if (error.code === '23505' && error.constraint?.includes('sku')) {
      throw new AppError(409, 'A product with this SKU already exists', {
        field: 'sku',
        value: data.sku,
      });
    }
    // Handle other PG errors
    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}
