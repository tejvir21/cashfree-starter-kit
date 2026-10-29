import { verifyAccessToken } from '../utils/tokens';
import { User } from '../models';
import { env } from '../config/env';
import { COOKIE_NAMES } from '../utils/tokens';
const BEARER = /^Bearer\s+(.+)$/i;
export function getTokenFromRequest(req) {
    // Prefer HttpOnly access cookie; fall back to Authorization header.
    const cookie = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN] ?? null;
    if (cookie)
        return cookie;
    const auth = req.headers.authorization;
    const match = auth && BEARER.exec(auth);
    if (match)
        return match[1];
    return null;
}
export function authenticate(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        return;
    }
    try {
        const payload = verifyAccessToken(token);
        req.user = { ...payload, _id: payload.userId };
        next();
    }
    catch {
        res.status(401).json({ error: 'Unauthorized', message: 'Session expired or invalid' });
    }
}
export function optionalAuthenticate(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token)
        return next();
    try {
        const payload = verifyAccessToken(token);
        req.user = { ...payload, _id: payload.userId };
    }
    catch {
        // ignore - remains unauthenticated
    }
    next();
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Forbidden', message: 'Insufficient role' });
            return;
        }
        next();
    };
}
export function setAuthCookies(res, accessToken, refreshToken, csrfToken) {
    const isSecure = Boolean(env.COOKIE_SECURE);
    const sameSite = env.COOKIE_SAME_SITE;
    const domain = env.COOKIE_DOMAIN || undefined;
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        domain,
        path: '/',
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        domain,
        path: '/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    res.cookie(COOKIE_NAMES.CSRF, csrfToken, {
        httpOnly: false,
        secure: isSecure,
        sameSite,
        domain,
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
export function clearAuthCookies(res) {
    const isSecure = Boolean(env.COOKIE_SECURE);
    const sameSite = env.COOKIE_SAME_SITE;
    const domain = env.COOKIE_DOMAIN || undefined;
    res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/', domain, secure: isSecure, sameSite });
    res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/auth/refresh', domain, secure: isSecure, sameSite });
    res.clearCookie(COOKIE_NAMES.CSRF, { path: '/', domain, secure: isSecure, sameSite });
}
export async function attachUser(req, res, next) {
    if (!req.user)
        return next();
    try {
        const user = await User.findById(req.user._id).select('-passwordHash -refreshTokens -emailVerificationToken');
        if (user) {
            req.user = {
                userId: user._id.toString(),
                email: user.email,
                role: user.role,
                _id: user._id.toString(),
            };
        }
        next();
    }
    catch {
        next();
    }
}
