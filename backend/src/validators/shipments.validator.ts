import { z } from 'zod';

/**
 * Zod schemas for Shipments module request validation.
 */

// Schema for a single shipment item
const shipmentItemSchema = z.object({
  product_id: z.number().int().positive('Product ID is required'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

// Schema for creating a new shipment
export const createShipmentSchema = z.object({
  origin_warehouse_id: z.number().int().positive('Origin warehouse ID is required'),
  destination_address: z.string().min(1, 'Destination address is required').max(1000),
  carrier: z.string().min(1, 'Carrier is required').max(255),
  tracking_number: z.string().max(255).nullable().optional(),
  items: z
    .array(shipmentItemSchema)
    .min(1, 'At least one item is required'),
});

// Allowed shipment status values for update
const shipmentStatusEnum = z.enum(['in_transit', 'delivered', 'failed', 'returned']);

// Schema for updating shipment status
export const updateShipmentStatusSchema = z.object({
  status: shipmentStatusEnum,
});

// Schema for shipment list query filters
export const shipmentFilterSchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  status: z.string().optional(),
  origin_warehouse_id: z.string().optional(),
});

// Schema for shipment ID param
export const shipmentIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Shipment ID must be a number'),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;
export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;
export type ShipmentFilterInput = z.infer<typeof shipmentFilterSchema>;
