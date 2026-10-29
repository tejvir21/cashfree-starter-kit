/**
 * Cashfree Payments adapter.
 */
import { env, cashfreeConfigured } from '../../config/env';
const BASE_URLS = {
    sandbox: 'https://sandbox.cashfree.com/pg',
    production: 'https://api.cashfree.com/pg',
};
const API_VERSION = env.CASHFREE_API_VERSION;
function baseUrl() {
    return BASE_URLS[env.CASHFREE_ENVIRONMENT];
}
function headers() {
    return {
        'x-client-id': env.CASHFREE_APP_ID ?? '',
        'x-client-secret': env.CASHFREE_SECRET_KEY ?? '',
        'x-api-version': API_VERSION,
        'Content-Type': 'application/json',
    };
}
class CashfreeGatewayError extends Error {
    status;
    body;
    constructor(message, status, body) {
        super(message);
        this.name = 'CashfreeGatewayError';
        this.status = status;
        this.body = body;
    }
}
async function gatewayRequest(path, { method = 'GET', body } = {}) {
    if (!cashfreeConfigured) {
        throw new CashfreeGatewayError('Cashfree credentials are not configured', 503, { code: 'GATEWAY_NOT_CONFIGURED' });
    }
    const url = `${baseUrl()}${path}`;
    const res = await fetch(url, {
        method,
        headers: headers(),
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let responseBody = null;
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        try {
            responseBody = await res.json();
        }
        catch {
            responseBody = await res.text();
        }
    }
    else {
        responseBody = await res.text();
    }
    if (!res.ok) {
        throw new CashfreeGatewayError(`Cashfree API error (${res.status}) for ${method} ${path}`, res.status, responseBody);
    }
    return responseBody;
}
export class CashfreeGatewayAdapter {
    environment = env.CASHFREE_ENVIRONMENT;
    async createOrder(request) {
        const payload = {
            order_id: request.orderId,
            order_amount: request.orderAmount,
            order_currency: request.orderCurrency,
            customer_details: {
                customer_id: request.customerDetails.customerId,
                customer_name: request.customerDetails.customerName,
                customer_email: request.customerDetails.customerEmail,
                customer_phone: request.customerDetails.customerPhone,
            },
            order_meta: {
                return_url: request.orderMeta?.returnUrl,
                notify_url: request.orderMeta?.notifyUrl,
                payment_methods: request.orderMeta?.paymentMethods,
                udf1: request.orderMeta?.udf1,
                udf2: request.orderMeta?.udf2,
                udf3: request.orderMeta?.udf3,
                udf4: request.orderMeta?.udf4,
                udf5: request.orderMeta?.udf5,
            },
            order_tags: request.orderTags,
        };
        const data = await gatewayRequest('/orders', {
            method: 'POST',
            body: payload,
        });
        return {
            orderId: String(data.order_id ?? request.orderId),
            orderAmount: Number(data.order_amount ?? request.orderAmount),
            orderCurrency: String(data.order_currency ?? request.orderCurrency),
            orderStatus: String(data.order_status ?? 'CREATED'),
            paymentLink: data.payment_link ? String(data.payment_link) : undefined,
            cfPaymentId: data.cf_payment_id ? String(data.cf_payment_id) : undefined,
            paymentSessionId: data.payment_session_id
                ? String(data.payment_session_id)
                : undefined,
            raw: data,
        };
    }
    async getOrder(orderId) {
        const data = await gatewayRequest(`/orders/${encodeURIComponent(orderId)}`);
        return this.mapOrderResponse(data);
    }
    async getPayment(orderId, paymentId) {
        const data = await gatewayRequest(`/orders/${encodeURIComponent(orderId)}/payments/${encodeURIComponent(paymentId)}`);
        return this.mapOrderResponse(data);
    }
    async createRefund(request) {
        const payload = {
            refund_id: request.refundId,
            refund_amount: request.refundAmount,
            refund_note: request.refundNote,
        };
        const data = await gatewayRequest('/refunds', {
            method: 'POST',
            body: payload,
        });
        return {
            refundId: String(data.refund_id ?? request.refundId),
            refundAmount: Number(data.refund_amount ?? request.refundAmount),
            refundStatus: String(data.refund_status ?? 'PENDING'),
            referenceId: data.reference_id ? String(data.reference_id) : undefined,
            raw: data,
        };
    }
    async verifyWebhookSignature(rawBody, signature) {
        if (!env.CASHFREE_WEBHOOK_SECRET) {
            if (env.NODE_ENV === 'production')
                return false;
            return false;
        }
        try {
            const parsed = parseWebhookSignature(signature);
            if (!parsed)
                return false;
            const { timestamp, v1 } = parsed;
            const now = Math.floor(Date.now() / 1000);
            if (Math.abs(now - Number(timestamp)) > 600)
                return false;
            const message = `${timestamp}.${rawBody}`;
            const expected = await hmacSha256(env.CASHFREE_WEBHOOK_SECRET, message);
            return timingSafeEqual(expected, v1);
        }
        catch {
            return false;
        }
    }
    mapOrderResponse(data) {
        const payments = Array.isArray(data.payments) ? data.payments : [];
        return {
            orderId: String(data.order_id ?? ''),
            orderAmount: Number(data.order_amount ?? 0),
            orderCurrency: String(data.order_currency ?? ''),
            orderStatus: String(data.order_status ?? ''),
            paymentStatus: data.payment_status ? String(data.payment_status) : undefined,
            payments: payments.map((p) => ({
                paymentId: String(p.payment_id ?? ''),
                paymentAmount: Number(p.payment_amount ?? 0),
                paymentCurrency: String(p.payment_currency ?? ''),
                paymentStatus: String(p.payment_status ?? ''),
                paymentTime: p.payment_time ? String(p.payment_time) : undefined,
                paymentMethod: p.payment_method ? String(p.payment_method) : undefined,
                utr: p.utr ? String(p.utr) : undefined,
                gateway: p.gateway ? String(p.gateway) : undefined,
                raw: typeof p === 'object' && p !== null ? p : {},
            })),
            raw: data,
        };
    }
}
export const cashfreeAdapter = new CashfreeGatewayAdapter();
export function isGatewayPaymentSuccess(gatewayStatus) {
    if (!gatewayStatus)
        return false;
    const s = gatewayStatus.toUpperCase();
    return s === 'SUCCESS' || s === 'PAID' || s === 'SUCCESSFUL';
}
export function isGatewayPaymentFinalFailure(gatewayStatus) {
    if (!gatewayStatus)
        return false;
    const s = gatewayStatus.toUpperCase();
    return s === 'FAILED' || s === 'CANCELLED' || s === 'EXPIRED';
}
export function isGatewayPaymentPending(gatewayStatus) {
    if (!gatewayStatus)
        return false;
    const s = gatewayStatus.toUpperCase();
    return s === 'PENDING' || s === 'PROCESSING' || s === 'INITIATED';
}
export function mapGatewayStatusToInternal(gatewayStatus) {
    if (isGatewayPaymentSuccess(gatewayStatus))
        return { status: 'PAID' };
    if (isGatewayPaymentFinalFailure(gatewayStatus))
        return { status: 'FAILED' };
    if (isGatewayPaymentPending(gatewayStatus))
        return { status: 'PENDING' };
    return { status: 'UNKNOWN' };
}
export function buildIntentResult(orderResp, expectedAmountMinor, expectedCurrency) {
    const amountMatches = Math.round(Number(orderResp.orderAmount) * 100) === expectedAmountMinor &&
        String(orderResp.orderCurrency).toUpperCase() === expectedCurrency.toUpperCase();
    let paymentStatus = 'UNKNOWN';
    let gatewayStatus;
    const latestPayment = orderResp.payments?.[orderResp.payments.length - 1];
    if (latestPayment) {
        gatewayStatus = latestPayment.paymentStatus;
        const mapped = mapGatewayStatusToInternal(latestPayment.paymentStatus);
        paymentStatus = mapped.status;
    }
    else {
        const mapped = mapGatewayStatusToInternal(orderResp.paymentStatus ?? orderResp.orderStatus);
        paymentStatus = mapped.status;
        gatewayStatus = orderResp.paymentStatus ?? orderResp.orderStatus;
    }
    if (paymentStatus === 'PAID' && !amountMatches) {
        paymentStatus = 'FAILED';
    }
    return {
        verified: paymentStatus === 'PAID',
        paymentStatus,
        gatewayStatus,
        cashfreePaymentId: latestPayment?.paymentId,
        amountMinor: Math.round(Number(orderResp.orderAmount) * 100),
        currency: String(orderResp.orderCurrency),
        metadata: {
            orderId: orderResp.orderId,
            orderStatus: orderResp.orderStatus,
            amountMatches,
            paymentsCount: orderResp.payments?.length ?? 0,
            raw: orderResp.raw,
        },
    };
}
function parseWebhookSignature(signature) {
    const parts = signature.split(',').map((p) => p.trim());
    let timestamp;
    let v1;
    for (const part of parts) {
        const [key, ...valueParts] = part.split('=');
        const value = valueParts.join('=');
        if (key === 't')
            timestamp = value;
        else if (key === 'v1')
            v1 = value;
    }
    if (!timestamp || !v1)
        return null;
    return { timestamp, v1 };
}
async function hmacSha256(secret, message) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
    const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    return hex;
}
function timingSafeEqual(a, b) {
    if (a.length !== b.length)
        return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}
export { CashfreeGatewayError };
