import { z } from 'zod';
const orderItemSchema = z.object({
    productId: z.string().min(1, 'Product id is required'),
    quantity: z.number().int().positive('Quantity must be a positive integer'),
});
export const orderCreateSchema = z.object({
    customerName: z.string().trim().min(2).max(100),
    customerEmail: z.string().trim().email('Invalid email').toLowerCase(),
    customerPhone: z.string().trim().optional(),
    customerNotes: z.string().trim().max(1000).optional(),
    items: z.array(orderItemSchema).min(1, 'At least one item is required'),
    idempotencyKey: z.string().optional(),
});
export const orderQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
    customerEmail: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});
export const orderParamsSchema = z.object({
    orderId: z.string().min(1, 'Order id is required'),
});
export const orderCancelSchema = z.object({});
export const orderTimelineQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});
