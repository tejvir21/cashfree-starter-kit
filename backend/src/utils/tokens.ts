// @ts-nocheck
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
const accessSignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'cashfree-commerce',
    audience: 'cashfree-commerce',
    subject: undefined,
};
const refreshSignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'cashfree-commerce',
    audience: 'cashfree-commerce',
    subject: undefined,
};
export function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        ...accessSignOptions,
        subject: payload.userId,
    });
}
export function signRefreshToken(payload) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        ...refreshSignOptions,
        subject: payload.userId,
    });
}
export function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
        issuer: 'cashfree-commerce',
        audience: 'cashfree-commerce',
    });
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
        issuer: 'cashfree-commerce',
        audience: 'cashfree-commerce',
    });
}
export const COOKIE_NAMES = {
    ACCESS_TOKEN: 'cf_access_token',
    REFRESH_TOKEN: 'cf_refresh_token',
    CSRF: 'cf_csrf_token',
};
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
        maxAge: 15 * 60 * 1000,
    });
    res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
        httpOnly: true,
        secure: isSecure,
        sameSite,
        domain,
        path: '/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000,
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

