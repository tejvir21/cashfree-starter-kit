// @ts-nocheck
import { Order } from '../models';
import { OrderStatus, OrderPaymentStatus } from '../models/constants';
import { createCheckout } from '../services/payment.service';
import { createAuditLog } from '../utils/audit-log';
import { generateOrderNumber } from '../utils/id';
export async function createOrder(req, res) {
    const { customerName, customerEmail, customerPhone, customerNotes, items, idempotencyKey, } = req.body;
    // Build a deterministic idempotency key from order content if none provided.
    const orderId = idempotencyKey || generateOrderNumber();
    try {
        const checkout = await createCheckout({
            orderId,
            customer: {
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                userId: req.user?._id,
            },
            items,
            customerNotes,
            idempotencyKey,
        });
        await createAuditLog({
            actorId: req.user?._id,
            actorRole: req.user?.role,
            action: 'order.created',
            targetType: 'order',
            targetId: checkout.orderId,
            metadata: { totalPayableMinor: checkout.totalPayableMinor, currency: checkout.currency },
        });
        res.status(201).json({ data: checkout });
    }
    catch (err) {
        const statusCode = err.statusCode || 400;
        res.status(statusCode).json({
            error: statusCode >= 500 ? 'Internal server error' : 'Bad request',
            message: err.message || 'Failed to create order',
        });
    }
}
export async function listOrders(req, res) {
    const { page = 1, limit = 20, search, status, paymentStatus, customerEmail, from, to, } = req.query;
    const filter = {};
    // Customers can only see their own orders unless admin.
    if (req.user?.role !== 'ADMIN' && req.user?._id) {
        filter.customerId = req.user._id;
    }
    if (customerEmail)
        filter.customerEmail = customerEmail;
    if (status)
        filter.status = status;
    if (paymentStatus)
        filter.paymentStatus = paymentStatus;
    if (from || to) {
        const dateFilter = {};
        if (from)
            dateFilter.$gte = new Date(from);
        if (to)
            dateFilter.$lte = new Date(to);
        filter.createdAt = dateFilter;
    }
    if (search) {
        filter.$or = [
            { orderNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
        ];
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const query = Order.find(filter).sort({ createdAt: -1 });
    const [items, total] = await Promise.all([
        query.skip(skip).limit(limitNum).lean(),
        Order.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function getOrder(req, res) {
    const { orderId } = req.params;
    // Allow guest access token via query for public order view.
    const { guestAccessToken } = req.query;
    const order = await Order.findOne({ orderNumber: orderId }).lean();
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    // Authorization: owner, admin, or valid guest token.
    const isOwner = req.user?.role === 'ADMIN' ||
        (req.user?._id && order.customerId?.toString() === req.user._id) ||
        (guestAccessToken && guestAccessToken === order.guestAccessToken);
    if (!isOwner) {
        res.status(403).json({ error: 'Forbidden', message: 'Not authorized to view this order' });
        return;
    }
    res.json({ data: order });
}
export async function cancelOrder(req, res) {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderNumber: orderId });
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    const isOwner = req.user?.role === 'ADMIN' ||
        (req.user?._id && order.customerId?.toString() === req.user._id);
    if (!isOwner) {
        res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });
        return;
    }
    // Only cancel eligible orders: not already fulfilled, cancelled or expired.
    const nonCancelable = [
        OrderStatus.FULFILLED,
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
    ];
    if (nonCancelable.includes(order.status)) {
        res.status(400).json({
            error: 'Bad request',
            message: `Order cannot be cancelled in state ${order.status}`,
        });
        return;
    }
    // If paid, refund must be initiated separately; cancelling order does not auto-refund.
    order.status = OrderStatus.CANCELLED;
    if (order.paymentStatus === OrderPaymentStatus.PAID) {
        order.paymentStatus = OrderPaymentStatus.REFUND_PENDING;
    }
    await order.save();
    await createAuditLog({
        actorId: req.user?._id,
        actorRole: req.user?.role,
        action: 'order.cancelled',
        targetType: 'order',
        targetId: order.orderNumber,
        metadata: { paymentStatus: order.paymentStatus },
    });
    res.json({ data: order });
}
export async function getOrderTimeline(req, res) {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderNumber: orderId }).lean();
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    const isOwner = req.user?.role === 'ADMIN' ||
        (req.user?._id && order.customerId?.toString() === req.user._id);
    if (!isOwner) {
        res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });
        return;
    }
    // Build timeline from timestamps available on the order.
    const timeline = [
        { status: order.status, at: order.createdAt, note: 'Order created' },
        ...(order.paymentStatus !== 'UNPAID'
            ? [{ status: order.paymentStatus, at: order.updatedAt, note: 'Payment updated' }]
            : []),
        ...(order.fulfillmentStatus !== 'NOT_STARTED'
            ? [{ status: order.fulfillmentStatus, at: order.updatedAt, note: 'Fulfillment updated' }]
            : []),
    ];
    res.json({ data: timeline });
}

