// @ts-nocheck
import { z } from 'zod';
import { CURRENCIES, PRODUCT_TYPES } from '../models/constants.js';
const CURRENCY_ENUM = CURRENCIES;
const TYPE_ENUM = PRODUCT_TYPES;
export const productQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().optional(),
    category: z.string().optional(),
    type: z.enum(TYPE_ENUM).optional(),
    isActive: z.coerce.boolean().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
});
export const productCreateSchema = z.object({
    name: z.string().trim().min(2).max(200),
    description: z.string().trim().min(1).max(3000),
    type: z.enum(TYPE_ENUM),
    priceMinor: z.number().int().nonnegative('Price must be a non-negative integer'),
    currency: z.enum(CURRENCY_ENUM).default('INR'),
    variants: z
        .array(z.object({
        name: z.string().trim().min(1),
        priceMinor: z.number().int().nonnegative(),
        currency: z.enum(CURRENCY_ENUM),
        sku: z.string().trim().optional(),
    }))
        .optional(),
    isActive: z.boolean().default(true),
    imageUrl: z.string().trim().url().optional().or(z.literal('')),
    stock: z.number().int().nonnegative().optional(),
    sku: z.string().trim().optional(),
    category: z.string().trim().optional(),
    minOrderQuantity: z.number().int().positive().optional(),
    maxOrderQuantity: z.number().int().positive().optional(),
});
export const productUpdateSchema = productCreateSchema.partial();
export const productParamsSchema = z.object({
    id: z.string().min(1, 'Product id is required'),
});

