import { z } from 'zod';

const orderItemSchema = z.object({
  product_id: z.number().int().positive('Product ID is required'),
  ordered_quantity: z.number().int().positive('Ordered quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

export const createPurchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive('Supplier ID is required'),
  warehouse_id: z.number().int().positive('Warehouse ID is required'),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
});

const receiveItemSchema = z.object({
  order_item_id: z.number().int().positive('Order item ID is required'),
  received_quantity: z.number().int().positive('Received quantity must be at least 1'),
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(receiveItemSchema)
    .min(1, 'At least one item is required'),
});

export const purchaseOrderFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  supplier_id: z.string().optional(),
});

export const purchaseOrderIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Purchase order ID must be a number'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type PurchaseOrderFilterInput = z.infer<typeof purchaseOrderFilterSchema>;
