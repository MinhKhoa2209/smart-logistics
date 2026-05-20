import { z } from 'zod';

const customerOrderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

export const updateCustomerOrderStatusSchema = z.object({
  status: customerOrderStatusEnum,
});

const paymentMethodEnum = z.enum([
  'cash',
  'bank_transfer',
  'credit_card',
  'e_wallet',
  'other',
]);

export const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  payment_method: paymentMethodEnum,
});

export const customerOrderFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
});

export const customerOrderIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Customer order ID must be a number'),
});

export type UpdateCustomerOrderStatusInput = z.infer<typeof updateCustomerOrderStatusSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CustomerOrderFilterInput = z.infer<typeof customerOrderFilterSchema>;
