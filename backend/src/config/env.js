import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(4000),
    CLIENT_URL: z.string().url().default('http://localhost:5173'),
    ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
    CASHFREE_APP_ID: z.string().min(1, 'CASHFREE_APP_ID is required'),
    CASHFREE_SECRET_KEY: z.string().min(1, 'CASHFREE_SECRET_KEY is required'),
    CASHFREE_API_VERSION: z.string().default('2025-08-01'),
    CASHFREE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
    CASHFREE_WEBHOOK_SECRET: z.string().optional(),
    MIN_PAYMENT_AMOUNT: z.coerce.number().default(1),
    MAX_PAYMENT_AMOUNT: z.coerce.number().default(100000),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
}
export const env = parsed.data;
export const isSandbox = env.CASHFREE_ENVIRONMENT === 'sandbox';
export const isProduction = env.NODE_ENV === 'production';
export const cashfreeConfigured = Boolean(env.CASHFREE_APP_ID && env.CASHFREE_SECRET_KEY);
export const MIN_PAYMENT_AMOUNT = env.MIN_PAYMENT_AMOUNT;
export const MAX_PAYMENT_AMOUNT = env.MAX_PAYMENT_AMOUNT;
