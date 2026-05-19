import { z } from 'zod';

/**
 * Zod schemas for Inventory module request validation.
 */

// Schema for inventory list query filters
export const inventoryFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  warehouse_id: z.string().regex(/^\d+$/, 'warehouse_id must be a number').optional(),
  low_stock: z.enum(['true', 'false']).optional(),
});

export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>;
