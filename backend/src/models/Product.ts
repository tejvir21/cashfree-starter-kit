// @ts-nocheck
import mongoose, { Schema, model } from 'mongoose';
import { ProductType, CURRENCIES } from './constants.js';
const variantSchema = new Schema({
    name: { type: String, required: true, trim: true },
    priceMinor: { type: Number, required: true, min: 0, integer: true },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
    },
    sku: { type: String, trim: true },
}, { _id: false });
const productSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 200, index: 'text' },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    type: {
        type: String,
        enum: Object.values(ProductType),
        required: true,
    },
    priceMinor: { type: Number, required: true, min: 0, integer: true },
    currency: {
        type: String,
        enum: CURRENCIES,
        required: true,
        default: 'INR',
    },
    variants: [variantSchema],
    isActive: { type: Boolean, default: true, index: true },
    imageUrl: { type: String, trim: true },
    stock: { type: Number, min: 0 },
    sku: { type: String, trim: true, index: true },
    category: { type: String, trim: true, index: true },
    minOrderQuantity: { type: Number, min: 1, default: 1 },
    maxOrderQuantity: { type: Number, min: 1 },
}, { timestamps: true });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ name: 'text', description: 'text' });
export const Product = mongoose.models.Product || model('Product', productSchema);

