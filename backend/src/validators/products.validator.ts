import { z } from 'zod';

/**
 * Zod schemas for Products module request validation.
 */

// Schema for creating a new product
export const createProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50),
  name: z.string().min(1, 'Name is required').max(255),
  category: z.string().max(100).nullable().optional(),
  unit: z.string().min(1, 'Unit is required').max(50),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
  unit_price: z.number().min(0, 'Unit price must be non-negative'),
  min_stock_level: z.number().int().min(0).optional().default(0),
  supplier_id: z.number().int().positive('Supplier is required'),
  is_active: z.boolean().optional().default(true),
});

// Schema for updating an existing product
export const updateProductSchema = z.object({
  sku: z.string().min(1, 'SKU is required').max(50).optional(),
  name: z.string().min(1, 'Name is required').max(255).optional(),
  category: z.string().max(100).nullable().optional(),
  unit: z.string().min(1).max(50).optional(),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative').optional(),
  unit_price: z.number().min(0, 'Unit price must be non-negative').optional(),
  min_stock_level: z.number().int().min(0).optional(),
  supplier_id: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

// Schema for product list query filters
export const productFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  supplier_id: z.string().optional(),
});

// Schema for product ID param
export const productIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Product ID must be a number'),
});

// Schema for semantic search request body
export const semanticSearchSchema = z.object({
  query: z
    .string()
    .min(2, 'Search query must be at least 2 characters')
    .max(200, 'Search query must not exceed 200 characters'),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductFilterInput = z.infer<typeof productFilterSchema>;
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
