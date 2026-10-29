import { z } from 'zod';
export const checkoutSchema = z.object({
    orderId: z.string().min(1, 'Order id is required'),
});
export const verifySchema = z.object({
    paymentAttemptId: z.string().min(1, 'Payment attempt id is required'),
});
export const paymentQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    verificationStatus: z.string().optional(),
    orderId: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});
export const refundCreateSchema = z.object({
    amountMinor: z.number().int().positive('Refund amount must be positive'),
    reason: z.string().trim().min(1).max(1000),
});
export const paymentParamsSchema = z.object({
    paymentId: z.string().min(1, 'Payment id is required'),
});
export const refundParamsSchema = z.object({
    refundId: z.string().min(1, 'Refund id is required'),
});
