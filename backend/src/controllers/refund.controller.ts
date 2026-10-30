// @ts-nocheck
import { initiateRefund, reconcileRefund, } from '../services/payment.service.js';
import { Refund, Order, PaymentAttempt } from '../models.js';
import { createAuditLog } from '../utils/audit-log.js';
export async function createRefund(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { orderId } = req.params;
    const { amountMinor, reason } = req.body;
    try {
        const order = await Order.findOne({ orderNumber: orderId });
        if (!order) {
            res.status(404).json({ error: 'Not found', message: 'Order not found' });
            return;
        }
        const attempt = await PaymentAttempt.findOne({ orderId: order._id })
            .sort({ createdAt: -1 });
        if (!attempt) {
            res.status(404).json({ error: 'Not found', message: 'No payment attempt found' });
            return;
        }
        const result = await initiateRefund({
            paymentAttemptId: attempt._id.toString(),
            amountMinor,
            reason,
            requestedBy: req.user._id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        await createAuditLog({
            actorId: req.user._id,
            actorRole: req.user.role,
            action: 'refund.created',
            targetType: 'refund',
            targetId: result.internalRefundId,
            metadata: { orderId: order.orderNumber, amountMinor },
        });
        res.status(201).json({ data: result });
    }
    catch (err) {
        const statusCode = err.statusCode || 400;
        res.status(statusCode).json({
            error: statusCode >= 400 && statusCode < 500 ? (err.code || 'Bad request') : 'Bad request',
            message: statusCode >= 400 && statusCode < 500 ? err.message : 'Bad request',
        });
    }
}
export async function listRefundsForOrder(req, res) {
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
    const refunds = await Refund.find({ orderId: order._id }).sort({ createdAt: -1 }).lean();
    res.json({ data: refunds });
}
export async function listRefunds(req, res) {
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
export async function getRefundDetail(req, res) {
    const { refundId } = req.params;
    const refund = await Refund.findOne({ internalRefundId: refundId }).lean();
    if (!refund) {
        res.status(404).json({ error: 'Not found', message: 'Refund not found' });
        return;
    }
    if (req.user?.role !== 'ADMIN') {
        const order = await Order.findById(refund.orderId).lean();
        if (!order || !req.user?._id || order.customerId?.toString() !== req.user._id) {
            res.status(403).json({ error: 'Forbidden', message: 'Not authorized' });
            return;
        }
    }
    res.json({ data: refund });
}
export async function reconcileRefundController(req, res) {
    if (req.user?.role !== 'ADMIN') {
        res.status(403).json({ error: 'Forbidden', message: 'Admin only' });
        return;
    }
    const { refundId } = req.params;
    const result = await reconcileRefund(refundId, req.user._id);
    await createAuditLog({
        actorId: req.user._id,
        actorRole: req.user.role,
        action: 'refund.reconciled',
        targetType: 'refund',
        targetId: refundId,
        metadata: result,
    });
    res.json({ data: result });
}

