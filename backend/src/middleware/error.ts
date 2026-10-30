// @ts-nocheck
import { ZodError } from 'zod';
export function errorHandler(err, _req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
_next) {
    const statusCode = err.statusCode || 500;
    const isClientError = statusCode >= 400 && statusCode < 500;
    // Redact unexpected server errors from the response.
    if (!isClientError) {
        console.error('Unhandled error:', err);
    }
    let message = err.message || 'Internal server error';
    if (!isClientError) {
        message = 'Internal server error';
    }
    const body = {
        error: statusCode >= 500 ? 'Internal server error' : (err.code || 'Bad request'),
        message,
    };
    if (err instanceof ZodError) {
        body.error = 'Validation error';
        body.message = 'Invalid request payload';
        body.details = err.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
        }));
    }
    res.status(statusCode).json(body);
}
export function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

