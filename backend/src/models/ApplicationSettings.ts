// @ts-nocheck
import mongoose, { Schema, model } from 'mongoose';
const applicationSettingsSchema = new Schema({
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String, trim: true },
    isPublic: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });
export const ApplicationSettings = mongoose.models.ApplicationSettings ||
    model('ApplicationSettings', applicationSettingsSchema);

