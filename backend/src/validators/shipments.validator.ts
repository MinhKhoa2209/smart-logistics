import { z } from 'zod';

const shipmentItemSchema = z.object({
  product_id: z.number().int().positive('Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const createShipmentSchema = z.object({
  origin_warehouse_id: z.number().int().positive('Origin warehouse ID is required'),
  destination_address: z.string().min(1, 'Destination address is required').max(1000),
  carrier: z.string().min(1, 'Carrier is required').max(255),
  tracking_number: z.string().max(255).nullable().optional(),
  items: z
    .array(shipmentItemSchema)
    .min(1, 'At least one item is required'),
});

const shipmentStatusEnum = z.enum(['in_transit', 'delivered', 'failed', 'returned']);

export const updateShipmentStatusSchema = z.object({
  status: shipmentStatusEnum,
});

export const shipmentFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  origin_warehouse_id: z.string().optional(),
});

export const shipmentIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Shipment ID must be a number'),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;
export type ShipmentFilterInput = z.infer<typeof shipmentFilterSchema>;
