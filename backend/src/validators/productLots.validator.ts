import { z } from 'zod';

/**
 * Zod schemas for Product Lots module request validation.
 */

// Schema for lots list query filters
export const productLotsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type ProductLotsFilterInput = z.infer<typeof productLotsFilterSchema>;

// Schema for expiring lots query (no additional params needed beyond pagination)
export const expiringLotsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type ExpiringLotsFilterInput = z.infer<typeof expiringLotsFilterSchema>;
