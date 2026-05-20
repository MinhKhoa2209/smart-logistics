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

export type StockMovementsFilterInput = z.infer<typeof stockMovementsFilterSchema>;
