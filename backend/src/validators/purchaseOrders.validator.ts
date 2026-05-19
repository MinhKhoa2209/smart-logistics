import { z } from 'zod';

/**
 * Zod schemas for Purchase Orders module request validation.
 */

// Schema for a single order item in a purchase order creation
const orderItemSchema = z.object({
  product_id: z.number().int().positive('Product ID is required'),
  ordered_quantity: z.number().int().positive('Ordered quantity must be at least 1'),
  unit_cost: z.number().min(0, 'Unit cost must be non-negative'),
});

// Schema for creating a new purchase order
export const createPurchaseOrderSchema = z.object({
  supplier_id: z.number().int().positive('Supplier ID is required'),
  warehouse_id: z.number().int().positive('Warehouse ID is required'),
  notes: z.string().max(1000).nullable().optional(),
  items: z
    .array(orderItemSchema)
    .min(1, 'At least one item is required'),
});

// Schema for a single received item
const receiveItemSchema = z.object({
  order_item_id: z.number().int().positive('Order item ID is required'),
  received_quantity: z.number().int().positive('Received quantity must be at least 1'),
});

// Schema for receiving goods against a purchase order
export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(receiveItemSchema)
    .min(1, 'At least one item is required'),
});

// Schema for purchase order list query filters
export const purchaseOrderFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  supplier_id: z.string().optional(),
});

// Schema for purchase order ID param
export const purchaseOrderIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Purchase order ID must be a number'),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type PurchaseOrderFilterInput = z.infer<typeof purchaseOrderFilterSchema>;
