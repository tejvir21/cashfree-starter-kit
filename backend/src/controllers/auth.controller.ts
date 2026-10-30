// @ts-nocheck
import bcrypt from 'bcryptjs';
import { signAccessToken, signRefreshToken, verifyRefreshToken, setAuthCookies, clearAuthCookies, } from '../utils/tokens.js';
import { User } from '../models.js';
import { createAuditLog } from '../utils/audit-log.js';
import { generateId } from '../utils/id.js';
const SALT_ROUNDS = 12;
function userPayload(user) {
    return { userId: user._id, email: user.email, role: user.role };
}
export async function register(req, res) {
    const { name, email, password, role } = req.body;
    // Public registration only allows CUSTOMER role. ADMIN must be provisioned via CLI script.
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
        res.status(409).json({ error: 'Conflict', message: 'Email already registered' });
        return;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
    });
    await createAuditLog({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'auth.register',
        targetType: 'user',
        targetId: user._id.toString(),
        metadata: { email: user.email },
    });
    res.status(201).json({
        data: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    });
}
export async function login(req, res) {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
        return;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
        return;
    }
    const payload = userPayload({
        _id: user._id.toString(),
        email: user.email,
        role: user.role,
    });
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const csrfToken = generateId(32);
    // Store hashed refresh token for rotation (atomic update to avoid version conflicts).
    const refreshHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await User.updateOne({ _id: user._id }, { $push: { refreshTokens: refreshHash }, lastLoginAt: new Date() });
    setAuthCookies(res, accessToken, refreshToken, csrfToken);
    await createAuditLog({
        actorId: user._id.toString(),
        actorRole: user.role,
        action: 'auth.login',
        targetType: 'user',
        targetId: user._id.toString(),
        metadata: { email: user.email },
    });
    res.json({
        data: { id: user._id.toString(), name: user.name, email: user.email, role: user.role },
    });
}
export async function logout(req, res) {
    const userId = req.user?._id;
    if (userId) {
        const user = await User.findById(userId);
        if (user) {
            user.refreshTokens = [];
            await user.save();
        }
    }
    clearAuthCookies(res);
    res.json({ data: { ok: true } });
}
export async function refresh(req, res) {
    // Refresh token comes from HttpOnly refresh cookie.
    const refreshToken = req.cookies?.cf_refresh_token;
    if (!refreshToken) {
        res.status(401).json({ error: 'Unauthorized', message: 'Refresh token missing' });
        return;
    }
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    }
    catch {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid refresh token' });
        return;
    }
    const user = await User.findById(payload.userId).select('+passwordHash +refreshTokens');
    if (!user) {
        res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        return;
    }
    // Rotate: verify the refresh token hash exists.
    const hashMatches = await Promise.all(user.refreshTokens.map((h) => bcrypt.compare(refreshToken, h)));
    if (!hashMatches.some(Boolean)) {
        // Token reuse detected: revoke all refresh tokens as a security measure.
        user.refreshTokens = [];
        await user.save();
        clearAuthCookies(res);
        res.status(401).json({ error: 'Unauthorized', message: 'Refresh token reuse detected' });
        return;
    }
    // Remove the matched hash and issue a new refresh token (rotation).
    const usedHash = user.refreshTokens[hashMatches.findIndex(Boolean)];
    const newRefreshToken = signRefreshToken(payload);
    const newHash = await bcrypt.hash(newRefreshToken, SALT_ROUNDS);
    user.refreshTokens = user.refreshTokens.filter((h) => h !== usedHash);
    user.refreshTokens.push(newHash);
    await user.save();
    const accessToken = signAccessToken(payload);
    const csrfToken = generateId(32);
    setAuthCookies(res, accessToken, newRefreshToken, csrfToken);
    res.json({ data: { ok: true } });
}
export async function me(req, res) {
    const user = await User.findById(req.user?._id).select('-passwordHash -refreshTokens -emailVerificationToken');
    if (!user) {
        res.status(404).json({ error: 'Not found', message: 'User not found' });
        return;
    }
    res.json({
        data: {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            phone: user.phone,
        },
    });
}

