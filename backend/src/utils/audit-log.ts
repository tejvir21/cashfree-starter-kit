// @ts-nocheck
import { AuditLog } from '../models';
/**
 * Create an audit log entry. Sensitive fields are redacted before storage.
 */
export async function createAuditLog(input) {
    const metadata = redact(input.metadata ?? {});
    return AuditLog.create({
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
    });
}
function redact(obj) {
    const sensitive = /^(password|secret|token|key|authorization|cookie|refreshToken)$/i;
    const out = {};
    for (const [key, value] of Object.entries(obj)) {
        if (sensitive.test(key)) {
            out[key] = '[REDACTED]';
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            out[key] = redact(value);
        }
        else {
            out[key] = value;
        }
    }
    return out;
}

