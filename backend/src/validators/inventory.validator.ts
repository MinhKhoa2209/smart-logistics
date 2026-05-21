import { z } from 'zod';

export const inventoryFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  warehouse_id: z.string().regex(/^\d+$/, 'warehouse_id must be a number').optional(),
  low_stock: z.enum(['true', 'false']).optional(),
  status: z.enum(['low_stock', 'in_stock', 'overstock']).optional(),
});

export type InventoryFilterInput = z.infer<typeof inventoryFilterSchema>;
