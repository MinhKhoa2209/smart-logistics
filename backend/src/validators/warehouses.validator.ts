import { z } from 'zod';

export const warehouseIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Warehouse ID must be a positive integer').transform(Number),
});

export const warehouseListQuerySchema = z.object({
  warehouse_type: z
    .enum(['distribution_center', 'cold_storage', 'retail', 'fulfillment', 'returns'])
    .optional(),
  is_active: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
});

export const warehouseInventoryQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  pageSize: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export const createWarehouseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  warehouse_type: z.enum(['distribution_center', 'cold_storage', 'retail', 'fulfillment', 'returns']),
  location: z.string().max(500).nullable().optional(),
  capacity: z.number().int().positive().nullable().optional(),
  manager_id: z.number().int().positive().nullable().optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
