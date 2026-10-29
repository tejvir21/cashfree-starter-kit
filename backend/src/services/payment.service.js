/**
 * Payment & order orchestration service.
 *
 * This is the business-logic layer. Controllers delegate here. The Cashfree gateway
 * is only accessed through the CashfreeAdapter; controllers contain no raw gateway logic.
 *
 * Monetary amounts are integer minor units. The app (MongoDB) is the source of truth
 * for orders; Cashfree is authoritative for gateway payment status.
 */
import { Order, PaymentAttempt, Refund, Product, } from '../models';
import { OrderStatus, OrderPaymentStatus, FulfillmentStatus, PaymentVerificationStatus, RefundStatus, canTransitionOrder, } from '../models/constants';
import { cashfreeAdapter, buildIntentResult, } from '../services/cashfree';
import { env } from '../config/env';
import { createAuditLog } from '../utils/audit-log';
import { generateId } from '../utils/id';
/**
 * Create an order and a payment attempt, then create a Cashfree order.
 * Returns client-safe checkout info (never secrets).
 */
export async function createCheckout(input) {
    const { orderId, customer, items, customerNotes, idempotencyKey } = input;
    // Idempotency: if an order with this number already exists, return its checkout info.
    const existing = await Order.findOne({ orderNumber: orderId }).lean();
    if (existing) {
        return getCheckoutInfo(existing);
    }
    // Validate products and compute total.
    let totalMinor = 0;
    const resolvedItems = [];
    for (const item of items) {
        const product = await Product.findById(item.productId).lean();
        if (!product)
            throw new Error(`Product ${item.productId} not found`);
        if (!product.isActive)
            throw new Error(`Product ${product.name} is not active`);
        const quantity = Math.max(1, Math.floor(item.quantity || 1));
        if (product.minOrderQuantity && quantity < product.minOrderQuantity) {
            throw new Error(`Minimum quantity for ${product.name} is ${product.minOrderQuantity}`);
        }
        if (product.maxOrderQuantity && quantity > product.maxOrderQuantity) {
            throw new Error(`Maximum quantity for ${product.name} is ${product.maxOrderQuantity}`);
        }
        if (product.stock != null && quantity > product.stock) {
            throw new Error(`Insufficient stock for ${product.name}`);
        }
        const currency = (product.currency ?? env.DEFAULT_CURRENCY);
        const unitPriceMinor = Math.floor(product.priceMinor);
        const lineTotalMinor = unitPriceMinor * quantity;
        totalMinor += lineTotalMinor;
        resolvedItems.push({
            productId: item.productId,
            quantity,
            unitPriceMinor,
            currency,
            lineTotalMinor,
            productSnapshot: {
                name: product.name,
                type: product.type,
                sku: product.sku,
                imageUrl: product.imageUrl,
            },
        });
    }
    if (totalMinor <= 0)
        throw new Error('Order total must be greater than zero');
    const currency = resolvedItems[0]?.currency ?? env.DEFAULT_CURRENCY;
    // Generate unpredictable guest access token.
    const guestAccessToken = generateId(32);
    const orderData = {
        orderNumber: orderId,
        customerId: customer.userId ?? undefined,
        guestAccessToken,
        customerName: customer.name,
        customerEmail: customer.email.toLowerCase().trim(),
        customerPhone: customer.phone,
        customerNotes,
        items: resolvedItems.map((i) => ({
            productId: i.productId,
            productSnapshot: i.productSnapshot,
            quantity: i.quantity,
            unitPriceMinor: i.unitPriceMinor,
            currency: i.currency,
            lineTotalMinor: i.lineTotalMinor,
        })),
        discountMinor: 0,
        taxMinor: 0,
        totalPayableMinor: totalMinor,
        currency: currency,
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: OrderPaymentStatus.UNPAID,
        fulfillmentStatus: FulfillmentStatus.NOT_STARTED,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    };
    const order = await Order.create(orderData);
    // Create payment attempt (attempt #1)
    const attemptNumber = 1;
    const internalPaymentId = generateId(16);
    const paymentAttempt = await PaymentAttempt.create({
        internalPaymentId,
        orderId: order._id,
        attemptNumber,
        amountMinor: totalMinor,
        currency,
        gatewayStatus: undefined,
        verificationStatus: 'UNVERIFIED',
        gatewayMetadata: {},
    });
    // Create gateway order reference.
    const gatewayOrderReference = `ord_${internalPaymentId}`;
    let gatewayResp;
    try {
        gatewayResp = await cashfreeAdapter.createOrder({
            orderId: gatewayOrderReference,
            orderAmount: totalMinor,
            orderCurrency: currency,
            customerDetails: {
                customerId: order._id.toString(),
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
            },
            orderMeta: {
                returnUrl: `${env.CLIENT_URL}/payments/return?orderId=${order.orderNumber}`,
                notifyUrl: env.CASHFREE_WEBHOOK_URL ?? `${env.CLIENT_URL}/api/v1/webhooks/cashfree`,
                paymentMethods: undefined,
            },
            orderTags: {
                internal_order_id: order.orderNumber,
                internal_payment_id: internalPaymentId,
            },
        });
        // Persist gateway reference.
        paymentAttempt.cashfreeOrderId = gatewayResp.orderId;
        paymentAttempt.gatewayStatus = gatewayResp.orderStatus;
        paymentAttempt.gatewayMetadata = {
            paymentLink: gatewayResp.paymentLink,
            cfPaymentId: gatewayResp.cfPaymentId,
            paymentSessionId: gatewayResp.paymentSessionId,
        };
        await paymentAttempt.save();
        order.status = OrderStatus.PENDING_PAYMENT;
        order.paymentStatus = OrderPaymentStatus.PENDING;
        await order.save();
        await createAuditLog({
            actorId: customer.userId,
            actorRole: customer.userId ? 'CUSTOMER' : 'GUEST',
            action: 'checkout.created',
            targetType: 'order',
            targetId: order.orderNumber,
            metadata: {
                internalPaymentId,
                gatewayOrderReference: gatewayResp.orderId,
                amountMinor: totalMinor,
                currency,
            },
        });
    }
    catch (err) {
        // If gateway fails, mark attempt failed but keep order so it can be retried.
        paymentAttempt.gatewayStatus = 'GATEWAY_ERROR';
        paymentAttempt.gatewayMetadata = {
            error: err instanceof Error ? err.message : String(err),
        };
        await paymentAttempt.save();
        order.status = OrderStatus.EXPIRED;
        order.paymentStatus = OrderPaymentStatus.FAILED;
        await order.save();
        throw err;
    }
    return getCheckoutInfo(order, paymentAttempt);
}
/**
 * Return client-safe checkout info. Never includes gateway secrets.
 */
function getCheckoutInfo(order, paymentAttempt) {
    const attempt = paymentAttempt || null;
    return {
        orderId: order.orderNumber,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalPayableMinor: order.totalPayableMinor,
        currency: order.currency,
        gatewayOrderId: attempt?.cashfreeOrderId,
        paymentLink: attempt?.gatewayMetadata?.paymentLink,
        paymentSessionId: attempt?.gatewayMetadata
            ?.paymentSessionId,
        expiresAt: order.expiresAt,
        clientSecret: undefined, // never expose a secret
    };
}
/**
 * Server-side verification of a payment. Authoritative result comes from Cashfree.
 * A redirect/SDK callback alone is never sufficient.
 */
export async function verifyPayment(input) {
    const attempt = await PaymentAttempt.findById(input.paymentAttemptId);
    if (!attempt)
        throw new Error('Payment attempt not found');
    const order = await Order.findById(attempt.orderId);
    if (!order)
        throw new Error('Order not found');
    let gatewayResp;
    if (attempt.cashfreeOrderId) {
        gatewayResp = await cashfreeAdapter.getOrder(attempt.cashfreeOrderId);
    }
    else {
        throw new Error('No gateway order reference to verify');
    }
    const result = buildIntentResult(gatewayResp, order.totalPayableMinor, order.currency);
    // Persist the verified outcome.
    attempt.gatewayStatus = result.gatewayStatus ?? attempt.gatewayStatus;
    attempt.cashfreePaymentId = result.cashfreePaymentId ?? attempt.cashfreePaymentId;
    attempt.verificationStatus = result.verified ? PaymentVerificationStatus.VERIFIED : PaymentVerificationStatus.VERIFICATION_FAILED;
    attempt.verifiedAt = new Date();
    attempt.gatewayMetadata = {
        ...attempt.gatewayMetadata,
        verifiedResult: result.metadata,
    };
    await attempt.save();
    // Update order payment status idempotently. Never downgrade PAID -> FAILED/PENDING
    // based on a later stale event; that is handled by webhook rules.
    if (result.paymentStatus === 'PAID') {
        order.paymentStatus = OrderPaymentStatus.PAID;
        if (canTransitionOrder(order.status, OrderStatus.CONFIRMED)) {
            order.status = OrderStatus.CONFIRMED;
        }
    }
    else if (result.paymentStatus === 'FAILED') {
        // Only mark FAILED if order is not already CONFIRMED/PAID (protect confirmed payments).
        if (order.paymentStatus !== OrderPaymentStatus.PAID) {
            order.paymentStatus = OrderPaymentStatus.FAILED;
        }
    }
    else if (result.paymentStatus === 'PENDING') {
        order.paymentStatus = OrderPaymentStatus.PENDING;
    }
    await order.save();
    await createAuditLog({
        actorId: undefined,
        actorRole: 'SYSTEM',
        action: 'payment.verified',
        targetType: 'payment',
        targetId: attempt.internalPaymentId,
        metadata: {
            orderId: order.orderNumber,
            paymentStatus: result.paymentStatus,
            verified: result.verified,
            amountMatches: result.metadata.amountMatches,
        },
    });
    return {
        orderId: order.orderNumber,
        internalPaymentId: attempt.internalPaymentId,
        paymentStatus: result.paymentStatus,
        verified: result.verified,
        gatewayStatus: result.gatewayStatus,
        amountMinor: result.amountMinor,
        currency: result.currency,
        orderStatus: order.status,
    };
}
/**
 * Reconcile an uncertain or pending payment (admin action). Queries Cashfree from backend.
 */
export async function reconcilePayment(paymentAttemptId, actorId) {
    const attempt = await PaymentAttempt.findById(paymentAttemptId);
    if (!attempt)
        throw new Error('Payment attempt not found');
    const order = await Order.findById(attempt.orderId);
    if (!order)
        throw new Error('Order not found');
    if (!attempt.cashfreeOrderId)
        throw new Error('No gateway order reference');
    const gatewayResp = await cashfreeAdapter.getOrder(attempt.cashfreeOrderId);
    const result = buildIntentResult(gatewayResp, order.totalPayableMinor, order.currency);
    const previousStatus = order.paymentStatus;
    const previousVerification = attempt.verificationStatus;
    attempt.gatewayStatus = result.gatewayStatus ?? attempt.gatewayStatus;
    attempt.cashfreePaymentId = result.cashfreePaymentId ?? attempt.cashfreePaymentId;
    attempt.verificationStatus = result.verified ? PaymentVerificationStatus.VERIFIED : PaymentVerificationStatus.VERIFICATION_FAILED;
    attempt.verifiedAt = new Date();
    attempt.gatewayMetadata = {
        ...attempt.gatewayMetadata,
        reconciliation: { at: new Date().toISOString(), by: actorId, result: result.metadata },
    };
    await attempt.save();
    if (result.paymentStatus === 'PAID') {
        order.paymentStatus = OrderPaymentStatus.PAID;
        if (order.status === OrderStatus.PENDING_PAYMENT) {
            order.status = OrderStatus.CONFIRMED;
        }
    }
    else if (result.paymentStatus === 'FAILED' &&
        order.paymentStatus !== OrderPaymentStatus.PAID) {
        order.paymentStatus = OrderPaymentStatus.FAILED;
    }
    else if (result.paymentStatus === 'PENDING') {
        order.paymentStatus = OrderPaymentStatus.PENDING;
    }
    await order.save();
    await createAuditLog({
        actorId,
        actorRole: 'ADMIN',
        action: 'payment.reconciled',
        targetType: 'payment',
        targetId: attempt.internalPaymentId,
        metadata: {
            orderId: order.orderNumber,
            previousPaymentStatus: previousStatus,
            newPaymentStatus: order.paymentStatus,
            previousVerification,
            newVerification: attempt.verificationStatus,
        },
    });
    return {
        orderId: order.orderNumber,
        internalPaymentId: attempt.internalPaymentId,
        paymentStatus: order.paymentStatus,
        verified: result.verified,
        orderStatus: order.status,
    };
}
/**
 * Initiate a refund (admin only). Enforces cumulative limits and idempotency.
 */
export async function initiateRefund(input) {
    const { paymentAttemptId, amountMinor, reason, requestedBy, ipAddress, userAgent } = input;
    const attempt = await PaymentAttempt.findById(paymentAttemptId);
    if (!attempt)
        throw new Error('Payment attempt not found');
    const order = await Order.findById(attempt.orderId);
    if (!order)
        throw new Error('Order not found');
    // Eligibility: only PAID payments can be refunded.
    if (attempt.verificationStatus !== 'VERIFIED' ||
        order.paymentStatus !== OrderPaymentStatus.PAID) {
        throw new Error('Payment is not eligible for refund');
    }
    if (amountMinor <= 0)
        throw new Error('Refund amount must be greater than zero');
    if (amountMinor > attempt.amountMinor) {
        throw new Error('Refund amount exceeds payment amount');
    }
    // Cumulative refund limit.
    const existingRefunds = await Refund.find({ paymentAttemptId });
    const alreadyRefundedMinor = existingRefunds.reduce((sum, r) => sum + (r.status === 'SUCCEEDED' ? r.amountMinor : 0), 0);
    if (alreadyRefundedMinor + amountMinor > attempt.amountMinor) {
        throw new Error('Cumulative refund amount would exceed the original payment');
    }
    // Idempotency: prevent concurrent duplicate refunds. Check for a pending refund.
    const pendingRefund = existingRefunds.find((r) => r.status === 'PENDING');
    if (pendingRefund) {
        throw new Error('A refund for this payment is already pending');
    }
    const internalRefundId = generateId(16);
    const refund = await Refund.create({
        internalRefundId,
        paymentAttemptId: attempt._id,
        orderId: attempt.orderId,
        amountMinor,
        currency: attempt.currency,
        reason,
        status: 'PENDING',
        gatewayMetadata: {},
        requestedBy: requestedBy,
    });
    // Call gateway (idempotency via refund_id). If gateway unavailable, leave PENDING
    // for later reconciliation rather than marking success prematurely.
    try {
        const gatewayResp = await cashfreeAdapter.createRefund({
            refundId: internalRefundId,
            refundAmount: amountMinor,
            refundNote: reason,
        });
        refund.cashfreeRefundId = gatewayResp.refundId;
        refund.gatewayStatus = gatewayResp.refundStatus;
        refund.gatewayMetadata = gatewayResp.raw;
        // A successful gateway request means the refund was accepted, not completed.
        if (gatewayResp.refundStatus.toUpperCase() === 'SUCCEEDED') {
            refund.status = RefundStatus.SUCCEEDED;
            refund.verifiedAt = new Date();
        }
        else if (gatewayResp.refundStatus.toUpperCase() === 'FAILED') {
            refund.status = RefundStatus.FAILED;
            refund.failureReason = 'Gateway reported failure';
        }
        else {
            refund.status = RefundStatus.PENDING;
        }
    }
    catch (err) {
        refund.status = RefundStatus.PENDING;
        refund.failureReason = err instanceof Error ? err.message : String(err);
        refund.gatewayMetadata = {
            ...refund.gatewayMetadata,
            gatewayError: err instanceof Error ? err.message : String(err),
        };
    }
    await refund.save();
    await createAuditLog({
        actorId: requestedBy,
        actorRole: 'ADMIN',
        action: 'refund.initiated',
        targetType: 'refund',
        targetId: refund.internalRefundId,
        metadata: {
            orderId: order.orderNumber,
            amountMinor,
            currency: attempt.currency,
        },
        ipAddress,
        userAgent,
    });
    // Update order payment status to reflect refund flow.
    if (refund.status === 'SUCCEEDED') {
        const totalRefunded = await Refund.aggregate([
            { $match: { paymentAttemptId: attempt._id, status: 'SUCCEEDED' } },
            { $group: { _id: null, total: { $sum: '$amountMinor' } } },
        ]);
        const totalRefundedAmount = totalRefunded[0]?.total ?? 0;
        order.paymentStatus =
            totalRefundedAmount >= attempt.amountMinor
                ? OrderPaymentStatus.REFUNDED
                : OrderPaymentStatus.PARTIALLY_REFUNDED;
        await order.save();
    }
    return {
        internalRefundId: refund.internalRefundId,
        status: refund.status,
        amountMinor: refund.amountMinor,
        cashfreeRefundId: refund.cashfreeRefundId,
        gatewayStatus: refund.gatewayStatus,
    };
}
/**
 * Reconcile a refund with Cashfree (admin action).
 */
export async function reconcileRefund(refundId, actorId) {
    const refund = await Refund.findOne({ internalRefundId: refundId });
    if (!refund)
        throw new Error('Refund not found');
    if (!refund.cashfreeRefundId)
        throw new Error('No gateway refund reference');
    const gatewayResp = await cashfreeAdapter.createRefund({
        refundId: refund.internalRefundId,
        refundAmount: refund.amountMinor,
        refundNote: refund.reason,
    });
    const previousStatus = refund.status;
    refund.gatewayStatus = gatewayResp.refundStatus;
    refund.gatewayMetadata = gatewayResp.raw;
    if (gatewayResp.refundStatus.toUpperCase() === 'SUCCEEDED') {
        refund.status = RefundStatus.SUCCEEDED;
        refund.verifiedAt = new Date();
    }
    else if (gatewayResp.refundStatus.toUpperCase() === 'FAILED') {
        refund.status = RefundStatus.FAILED;
        refund.failureReason = 'Gateway reported failure';
    }
    else {
        refund.status = RefundStatus.PENDING;
    }
    await refund.save();
    await createAuditLog({
        actorId,
        actorRole: 'ADMIN',
        action: 'refund.reconciled',
        targetType: 'refund',
        targetId: refund.internalRefundId,
        metadata: {
            previousStatus,
            newStatus: refund.status,
        },
    });
    return {
        internalRefundId: refund.internalRefundId,
        status: refund.status,
        gatewayStatus: refund.gatewayStatus,
    };
}
