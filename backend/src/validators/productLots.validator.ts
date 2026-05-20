import { z } from 'zod';

export const productLotsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type ProductLotsFilterInput = z.infer<typeof productLotsFilterSchema>;

export const expiringLotsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export type ExpiringLotsFilterInput = z.infer<typeof expiringLotsFilterSchema>;
