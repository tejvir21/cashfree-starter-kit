// @ts-nocheck
import { z } from 'zod';
import { CURRENCIES } from '../models/constants.js';
const CURRENCY_ENUM = CURRENCIES;
export const settingsPatchSchema = z.object({
    defaultCurrency: z.enum(CURRENCY_ENUM).optional(),
    minOrderAmountMinor: z.number().int().nonnegative().optional(),
    maxOrderAmountMinor: z.number().int().positive().optional(),
    enableGuestCheckout: z.boolean().optional(),
    enableRefunds: z.boolean().optional(),
});
export const settingsQuerySchema = z.object({
    publicOnly: z.coerce.boolean().default(false),
});
export const adminOrderQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    paymentStatus: z.string().optional(),
    customerEmail: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    minAmount: z.coerce.number().nonnegative().optional(),
    maxAmount: z.coerce.number().nonnegative().optional(),
});
export const adminTransactionQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    verificationStatus: z.string().optional(),
    orderId: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});
export const adminRefundQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    status: z.string().optional(),
    orderId: z.string().optional(),
});
export const reconcileOrderParamsSchema = z.object({
    orderId: z.string().min(1),
});
export const orderFulfillmentSchema = z.object({
    fulfillmentStatus: z.enum([
        'NOT_STARTED',
        'PROCESSING',
        'SHIPPED',
        'DELIVERED',
        'COMPLETED',
    ]),
});
export const orderNotesSchema = z.object({
    internalNotes: z.string().trim().max(2000),
});

