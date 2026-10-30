// @ts-nocheck
import { compareCsrfToken } from '../utils/csrf';
import { COOKIE_NAMES } from '../utils/tokens';
import { env } from '../config/env';
/**
 * CSRF protection for state-changing requests.
 * The client reads the `cf_csrf_token` cookie and sends it back via the
 * `x-csrf-token` header. Safe methods (GET, HEAD, OPTIONS) are exempt.
 */
export function csrfProtection(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method))
        return next();
    // Skip CSRF validation in test environment
    if (env.NODE_ENV === 'test')
        return next();
    const cookieToken = req.cookies?.[COOKIE_NAMES.CSRF];
    const headerToken = req.headers['x-csrf-token'];
    if (!cookieToken || !headerToken || typeof headerToken !== 'string') {
        res.status(403).json({ error: 'Forbidden', message: 'CSRF token missing' });
        return;
    }
    if (!compareCsrfToken(cookieToken, headerToken)) {
        res.status(403).json({ error: 'Forbidden', message: 'CSRF token mismatch' });
        return;
    }
    next();
}

