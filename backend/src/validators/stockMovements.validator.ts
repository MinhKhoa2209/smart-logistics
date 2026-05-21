import { z } from 'zod';

const movementTypes = [
  'inbound',
  'outbound',
  'transfer_in',
  'transfer_out',
  'adjustment',
  'return',
  'damaged',
] as const;

export const stockMovementsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, 'start_date must be a valid ISO date')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, 'end_date must be a valid ISO date')
    .optional(),
  movement_type: z.enum(movementTypes).optional(),
});

export const stockMovementIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Movement ID must be a number'),
});

export const createStockMovementSchema = z.object({
  product_id: z.number().int().positive('Product is required'),
  warehouse_id: z.number().int().positive('Warehouse is required'),
  change_amount: z.number().int().refine((value) => value !== 0, 'Change amount cannot be zero'),
  movement_type: z.enum(movementTypes),
  lot_id: z.number().int().positive().nullable().optional(),
  unit_cost: z.number().min(0).nullable().optional(),
  reference_id: z.number().int().positive().nullable().optional(),
  reference_type: z.string().max(30).nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
  created_by: z.number().int().positive().nullable().optional(),
});

export const updateStockMovementSchema = createStockMovementSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required'
);

export type StockMovementsFilterInput = z.infer<typeof stockMovementsFilterSchema>;
export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;
export type UpdateStockMovementInput = z.infer<typeof updateStockMovementSchema>;
