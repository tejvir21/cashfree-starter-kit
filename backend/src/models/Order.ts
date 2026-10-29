import mongoose, { Schema, model } from 'mongoose';
import { OrderStatus, OrderPaymentStatus, FulfillmentStatus, CURRENCIES, } from './constants';
const orderItemSchema = new Schema({
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    productSnapshot: {
        name: { type: String, required: true },
        type: { type: String, required: true },
        sku: { type: String },
        imageUrl: { type: String },
    },
    quantity: { type: Number, required: true, min: 1, integer: true },
    unitPriceMinor: { type: Number, required: true, min: 0, integer: true },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
    },
    lineTotalMinor: { type: Number, required: true, min: 0, integer: true },
}, { _id: false });
const orderSchema = new Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    guestAccessToken: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    customerName: { type: String, required: true, trim: true },
    customerEmail: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    customerPhone: { type: String, trim: true },
    customerNotes: { type: String, trim: true },
    internalNotes: { type: String, trim: true },
    items: [orderItemSchema],
    discountMinor: { type: Number, default: 0, min: 0, integer: true },
    taxMinor: { type: Number, default: 0, min: 0, integer: true },
    totalPayableMinor: {
        type: Number,
        required: true,
        min: 0,
        integer: true,
    },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
        default: 'INR',
    },
    status: {
        type: String,
        enum: Object.values(OrderStatus),
        default: OrderStatus.DRAFT,
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: Object.values(OrderPaymentStatus),
        default: OrderPaymentStatus.UNPAID,
        index: true,
    },
    fulfillmentStatus: {
        type: String,
        enum: Object.values(FulfillmentStatus),
        default: FulfillmentStatus.NOT_STARTED,
    },
    expiresAt: { type: Date },
}, { timestamps: true });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ status: 1, paymentStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ totalPayableMinor: 1 });
export const Order = mongoose.models.Order || model('Order', orderSchema);
