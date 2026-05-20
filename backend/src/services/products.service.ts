import * as productsRepository from '../repositories/products.repository';
import { CreateProductInput, UpdateProductInput } from '../validators/products.validator';
import { parsePaginationParams, formatPaginatedResponse, PaginatedResponse } from '../utils/pagination';
import { AppError, parsePgError } from '../middleware';
import { ProductRow, ProductDetailRow } from '../repositories/products.repository';

interface ListProductsOptions {
  page?: string;
  pageSize?: string;
  search?: string;
  category?: string;
  supplier_id?: string;
}

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

export async function getProduct(productId: number): Promise<ProductDetailRow> {
  const product = await productsRepository.findById(productId);
  if (!product) {
    throw new AppError(404, 'Product not found');
  }
  return product;
}

export async function createProduct(data: CreateProductInput): Promise<ProductRow> {
  try {
    return await productsRepository.create(data);
  } catch (error: any) {
    if (error.code === '23505' && error.constraint?.includes('sku')) {
      throw new AppError(409, 'A product with this SKU already exists', {
        field: 'sku',
        value: data.sku,
      });
    }

    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}

export async function updateProduct(productId: number, data: UpdateProductInput): Promise<ProductRow> {
  try {
    const product = await productsRepository.update(productId, data);
    if (!product) {
      throw new AppError(404, 'Product not found');
    }
    return product;
  } catch (error: any) {
    if (error instanceof AppError) throw error;

    if (error.code === '23505' && error.constraint?.includes('sku')) {
      throw new AppError(409, 'A product with this SKU already exists', {
        field: 'sku',
        value: data.sku,
      });
    }

    if (error.code && error.code.length === 5) {
      throw parsePgError(error);
    }
    throw error;
  }
}
