// @ts-nocheck
import crypto from 'crypto';
/**
 * Generate an unpredictable, URL-safe identifier.
 * Used for guest order access tokens, internal payment/refund ids, etc.
 * Not guessable, so guest orders cannot be accessed by brute force.
 */
export function generateId(length = 24) {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
export function generateOrderNumber(prefix = 'ORD') {
    const stamp = Date.now().toString(36).toUpperCase();
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${stamp}-${rand}`;
}

