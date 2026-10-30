// @ts-nocheck
import mongoose, { Schema, model } from 'mongoose';
import { RefundStatus, CURRENCIES } from './constants';
const refundSchema = new Schema({
    internalRefundId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    paymentAttemptId: {
        type: Schema.Types.ObjectId,
        ref: 'PaymentAttempt',
        required: true,
        index: true,
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    },
    cashfreeRefundId: { type: String, index: true },
    amountMinor: { type: Number, required: true, min: 0, integer: true },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    status: {
        type: String,
        enum: Object.values(RefundStatus),
        default: RefundStatus.PENDING,
        index: true,
    },
    gatewayStatus: { type: String, trim: true },
    gatewayMetadata: { type: Schema.Types.Mixed, default: {} },
    failureReason: { type: String, trim: true },
    verifiedAt: { type: Date },
    requestedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });
refundSchema.index({ orderId: 1, createdAt: -1 });
refundSchema.index({ paymentAttemptId: 1, status: 1 });
export const Refund = mongoose.models.Refund || model('Refund', refundSchema);

