import mongoose, { Schema, model } from 'mongoose';
import { WebhookProcessingStatus } from './constants';
const webhookEventSchema = new Schema({
    externalId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    signatureValid: { type: Boolean, default: false, index: true },
    processingStatus: {
        type: String,
        enum: Object.values(WebhookProcessingStatus),
        default: WebhookProcessingStatus.RECEIVED,
        index: true,
    },
    processedAt: { type: Date },
    failureReason: { type: String, trim: true },
    retryCount: { type: Number, default: 0 },
}, { timestamps: true });
webhookEventSchema.index({ createdAt: -1 });
export const WebhookEvent = mongoose.models.WebhookEvent ||
    model('WebhookEvent', webhookEventSchema);
