import mongoose, { Schema, model } from 'mongoose';
import { UserRole } from './constants';
const userSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    passwordHash: { type: String, required: true },
    role: {
        type: String,
        enum: Object.values(UserRole),
        default: UserRole.CUSTOMER,
        required: true,
    },
    phone: { type: String, trim: true },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    refreshTokens: { type: [String], default: [], select: false },
    lastLoginAt: { type: Date },
}, { timestamps: true });
userSchema.index({ email: 1 }, { unique: true });
export const User = mongoose.models.User || model('User', userSchema);
