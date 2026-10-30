// @ts-nocheck
import { Order, PaymentAttempt, Refund, ApplicationSettings, AuditLog, WebhookEvent, } from '../models.js';
import { OrderStatus, OrderPaymentStatus } from '../models/constants.js';
import { createAuditLog } from '../utils/audit-log.js';
import { reconcilePayment } from '../services/payment.service.js';
function num(v) {
    if (v === undefined)
        return undefined;
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
}
export async function getDashboard(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { from, to } = req.query;
    const dateFilter = {};
    if (from || to) {
        dateFilter.createdAt = {};
        if (from)
            dateFilter.createdAt.$gte = new Date(from);
        if (to)
            dateFilter.createdAt.$lte = new Date(to);
    }
    const [totalOrders, paidOrders, pendingOrders, failedAttempts, grossAmount, refundTotal, recentOrders,] = await Promise.all([
        Order.countDocuments(dateFilter),
        Order.countDocuments({ ...dateFilter, paymentStatus: OrderPaymentStatus.PAID }),
        Order.countDocuments({ ...dateFilter, paymentStatus: OrderPaymentStatus.PENDING }),
        PaymentAttempt.countDocuments({
            ...dateFilter,
            gatewayStatus: { $in: ['FAILED', 'CANCELLED', 'EXPIRED', 'GATEWAY_ERROR'] },
        }),
        Order.aggregate([
            { $match: { ...dateFilter, paymentStatus: OrderPaymentStatus.PAID } },
            { $group: { _id: null, total: { $sum: '$totalPayableMinor' } } },
        ]),
        Refund.aggregate([
            { $match: { ...dateFilter, status: 'SUCCEEDED' } },
            { $group: { _id: null, total: { $sum: '$amountMinor' } } },
        ]),
        Order.find(dateFilter).sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    res.json({
        data: {
            totalOrders,
            paidOrders,
            pendingPayments: pendingOrders,
            failedPaymentAttempts: failedAttempts,
            grossSuccessfulAmountMinor: grossAmount[0]?.total ?? 0,
            refundsSucceededMinor: refundTotal[0]?.total ?? 0,
            recentOrders,
        },
    });
}
export async function listAdminOrders(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { page = 1, limit = 20, search, status, paymentStatus, customerEmail, from, to, minAmount, maxAmount, } = req.query;
    const filter = {};
    if (search) {
        filter.$or = [
            { orderNumber: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerEmail: { $regex: search, $options: 'i' } },
        ];
    }
    if (status)
        filter.status = status;
    if (paymentStatus)
        filter.paymentStatus = paymentStatus;
    if (customerEmail)
        filter.customerEmail = customerEmail;
    if (minAmount !== undefined || maxAmount !== undefined) {
        filter.totalPayableMinor = {};
        const mn = num(minAmount);
        const mx = num(maxAmount);
        if (mn !== undefined)
            filter.totalPayableMinor.$gte = mn;
        if (mx !== undefined)
            filter.totalPayableMinor.$lte = mx;
    }
    if (from || to) {
        filter.createdAt = {};
        if (from)
            filter.createdAt.$gte = new Date(from);
        if (to)
            filter.createdAt.$lte = new Date(to);
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Order.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function listAdminPayments(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { page = 1, limit = 20, search, status, verificationStatus, orderId, from, to, } = req.query;
    const filter = {};
    if (status)
        filter.gatewayStatus = status;
    if (verificationStatus)
        filter.verificationStatus = verificationStatus;
    if (orderId) {
        const order = await Order.findOne({ orderNumber: orderId });
        if (order)
            filter.orderId = order._id;
    }
    if (from || to) {
        filter.createdAt = {};
        if (from)
            filter.createdAt.$gte = new Date(from);
        if (to)
            filter.createdAt.$lte = new Date(to);
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        PaymentAttempt.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        PaymentAttempt.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function listAdminRefunds(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { page = 1, limit = 20, search, status, orderId, } = req.query;
    const filter = {};
    if (status)
        filter.status = status;
    if (orderId) {
        const order = await Order.findOne({ orderNumber: orderId });
        if (order)
            filter.orderId = order._id;
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        Refund.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        Refund.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function reconcileAdminOrder(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { orderId } = req.params;
    const order = await Order.findOne({ orderNumber: orderId });
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    const attempt = await PaymentAttempt.findOne({ orderId: order._id }).sort({ createdAt: -1 });
    if (!attempt) {
        res.status(404).json({ error: 'Not found', message: 'No payment attempt found' });
        return;
    }
    const actorId = req.user._id;
    const result = await reconcilePayment(attempt._id.toString(), actorId);
    await createAuditLog({
        actorId,
        actorRole: req.user.role,
        action: 'order.reconciled',
        targetType: 'order',
        targetId: order.orderNumber,
        metadata: result,
    });
    res.json({ data: result });
}
export async function updateFulfillment(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { orderId } = req.params;
    const { fulfillmentStatus } = req.body;
    const order = await Order.findOne({ orderNumber: orderId });
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    order.fulfillmentStatus = fulfillmentStatus;
    if (fulfillmentStatus === 'COMPLETED' && order.status !== OrderStatus.FULFILLED) {
        order.status = OrderStatus.FULFILLED;
    }
    await order.save();
    await createAuditLog({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'order.fulfillment.updated',
        targetType: 'order',
        targetId: order.orderNumber,
        metadata: { fulfillmentStatus: order.fulfillmentStatus },
    });
    res.json({ data: order });
}
export async function addInternalNotes(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { orderId } = req.params;
    const { internalNotes } = req.body;
    const order = await Order.findOneAndUpdate({ orderNumber: orderId }, { internalNotes }, { new: true });
    if (!order) {
        res.status(404).json({ error: 'Not found', message: 'Order not found' });
        return;
    }
    res.json({ data: order });
}
export async function listWebhookEvents(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { page = 1, limit = 20, processingStatus, } = req.query;
    const filter = {};
    if (processingStatus)
        filter.processingStatus = processingStatus;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        WebhookEvent.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        WebhookEvent.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function listAuditLogs(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { page = 1, limit = 20, action, } = req.query;
    const filter = {};
    if (action)
        filter.action = action;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;
    const [items, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        AuditLog.countDocuments(filter),
    ]);
    res.json({
        data: items,
        pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
}
export async function getSettings(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { publicOnly } = req.query;
    const filter = publicOnly === 'true' ? { isPublic: true } : {};
    const settings = await ApplicationSettings.find(filter).lean();
    res.json({ data: settings });
}
export async function updateSettings(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const updates = req.body;
    const results = [];
    for (const [key, value] of Object.entries(updates)) {
        if (key === '__isPublic')
            continue;
        const setting = await ApplicationSettings.findOneAndUpdate({ key }, { value, updatedBy: req.user._id }, { upsert: true, new: true });
        results.push(setting);
    }
    await createAuditLog({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'settings.updated',
        targetType: 'settings',
        targetId: 'application',
        metadata: { keys: Object.keys(updates) },
    });
    res.json({ data: results });
}

