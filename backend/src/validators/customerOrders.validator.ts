import { z } from 'zod';

/**
 * Zod schemas for Customer Orders module request validation.
 */

// Allowed customer order status values for update
const customerOrderStatusEnum = z.enum([
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

// Schema for updating customer order status
export const updateCustomerOrderStatusSchema = z.object({
  status: customerOrderStatusEnum,
});

// Allowed payment methods
const paymentMethodEnum = z.enum([
  'cash',
  'bank_transfer',
  'credit_card',
  'e_wallet',
  'other',
]);

// Schema for recording a payment
export const createPaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than zero'),
  payment_method: paymentMethodEnum,
});

// Schema for customer order list query filters
export const customerOrderFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  payment_status: z.string().optional(),
});

// Schema for customer order ID param
export const customerOrderIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Customer order ID must be a number'),
});

export type UpdateCustomerOrderStatusInput = z.infer<typeof updateCustomerOrderStatusSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type CustomerOrderFilterInput = z.infer<typeof customerOrderFilterSchema>;
