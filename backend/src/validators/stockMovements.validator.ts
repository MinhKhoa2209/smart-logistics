import { z } from 'zod';

/**
 * Zod schemas for Stock Movements module request validation.
 */

// Valid movement types matching the PostgreSQL enum
const movementTypes = [
  'inbound',
  'outbound',
  'transfer_in',
  'transfer_out',
  'adjustment',
  'return',
  'damaged',
] as const;

// Schema for stock movements list query filters
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
