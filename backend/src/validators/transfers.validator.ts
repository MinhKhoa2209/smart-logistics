import { z } from 'zod';

/**
 * Zod schemas for Transfer Orders module request validation.
 */

// Schema for creating a new transfer order
export const createTransferSchema = z.object({
  from_warehouse_id: z.number().int().positive('Source warehouse ID is required'),
  to_warehouse_id: z.number().int().positive('Destination warehouse ID is required'),
  product_id: z.number().int().positive('Product ID is required'),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  lot_id: z.number().int().positive('Lot ID must be a positive integer').nullable().optional(),
});

// Schema for transfer list query filters
export const transferFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  from_warehouse_id: z.string().optional(),
  to_warehouse_id: z.string().optional(),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferFilterInput = z.infer<typeof transferFilterSchema>;
