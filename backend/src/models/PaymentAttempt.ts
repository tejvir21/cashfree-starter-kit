// @ts-nocheck
import mongoose, { Schema, model } from 'mongoose';
import { PaymentVerificationStatus, CURRENCIES, } from './constants';
const paymentAttemptSchema = new Schema({
    internalPaymentId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true,
    },
    cashfreeOrderId: { type: String, index: true },
    cashfreePaymentId: { type: String, index: true },
    attemptNumber: { type: Number, required: true, min: 1 },
    paymentMethod: { type: String, trim: true },
    amountMinor: { type: Number, required: true, min: 0, integer: true },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
    },
    gatewayStatus: { type: String, trim: true },
    verificationStatus: {
        type: String,
        enum: Object.values(PaymentVerificationStatus),
        default: PaymentVerificationStatus.UNVERIFIED,
        index: true,
    },
    gatewayMetadata: { type: Schema.Types.Mixed, default: {} },
    failureReason: { type: String, trim: true },
    verifiedAt: { type: Date },
}, { timestamps: true });
paymentAttemptSchema.index({ orderId: 1, createdAt: -1 });
paymentAttemptSchema.index({ cashfreeOrderId: 1 }, { unique: true, partialFilterExpression: { cashfreeOrderId: { $exists: true } } });
export const PaymentAttempt = mongoose.models.PaymentAttempt ||
    model('PaymentAttempt', paymentAttemptSchema);

