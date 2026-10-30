// @ts-nocheck
import mongoose from 'mongoose';
import { env } from './env.js';
let _connection = null;
export async function connectDb() {
    if (_connection)
        return _connection;
    const conn = await mongoose.connect(env.MONGODB_URI, {
        autoIndex: env.NODE_ENV !== 'production',
        serverSelectionTimeoutMS: 10000,
    });
    _connection = conn;
    conn.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err.message);
    });
    conn.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
    });
    return conn;
}
export async function disconnectDb() {
    if (_connection) {
        await _connection.connection.close();
        _connection = null;
    }
}
export { mongoose };

