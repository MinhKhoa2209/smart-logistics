import { z } from 'zod';

const auditActions = ['INSERT', 'UPDATE', 'DELETE'] as const;

export const auditLogsFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  table_name: z.string().optional(),
  user_id: z.string().regex(/^\d+$/, 'user_id must be a positive integer').optional(),
  action: z.enum(auditActions).optional(),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, 'start_date must be a valid ISO date')
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?Z?)?$/, 'end_date must be a valid ISO date')
    .optional(),
});

export type AuditLogsFilterInput = z.infer<typeof auditLogsFilterSchema>;
