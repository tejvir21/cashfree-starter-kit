import crypto from 'crypto';
export function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}
export function compareCsrfToken(a, b) {
    if (!a || !b || a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
