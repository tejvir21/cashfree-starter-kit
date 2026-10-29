import { ZodError } from 'zod';
import { errorHandler } from './error';
export function validateBody(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                errorHandler(err, req, res, next);
            }
            else {
                next(err);
            }
        }
    };
}
export function validateParams(schema) {
    return (req, res, next) => {
        try {
            req.params = schema.parse(req.params);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                errorHandler(err, req, res, next);
            }
            else {
                next(err);
            }
        }
    };
}
export function validateQuery(schema) {
    return (req, res, next) => {
        try {
            req.query = schema.parse(req.query);
            next();
        }
        catch (err) {
            if (err instanceof ZodError) {
                errorHandler(err, req, res, next);
            }
            else {
                next(err);
            }
        }
    };
}
