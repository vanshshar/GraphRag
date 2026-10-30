"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.ServiceUnavailableError = exports.ValidationError = exports.NotFoundError = exports.AppError = void 0;
const zod_1 = require("zod");
const logger_js_1 = require("../utils/logger.js");
class AppError extends Error {
    statusCode;
    code;
    details;
    constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}
exports.NotFoundError = NotFoundError;
class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR', details);
    }
}
exports.ValidationError = ValidationError;
class ServiceUnavailableError extends AppError {
    constructor(message = 'Service temporarily unavailable') {
        super(message, 503, 'SERVICE_UNAVAILABLE');
    }
}
exports.ServiceUnavailableError = ServiceUnavailableError;
const errorHandler = (err, req, res, _next) => {
    const requestId = req.id || 'unknown';
    if (err instanceof zod_1.ZodError) {
        const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
        logger_js_1.logger.warn({ requestId, err: err.errors }, `Validation error on ${req.method} ${req.originalUrl}`);
        res.status(400).json({
            error: {
                code: 'VALIDATION_ERROR',
                message: `Validation failed: ${message}`,
                requestId,
            },
        });
        return;
    }
    if (err instanceof AppError) {
        logger_js_1.logger.warn({ requestId, err: err.message, code: err.code }, `AppError on ${req.method} ${req.originalUrl}`);
        res.status(err.statusCode).json({
            error: {
                code: err.code,
                message: err.message,
                requestId,
            },
        });
        return;
    }
    // Handle Multer upload limits
    if ('code' in err && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
            error: {
                code: 'FILE_TOO_LARGE',
                message: 'The uploaded file exceeds the configured size limit.',
                requestId,
            },
        });
        return;
    }
    // Unhandled internal errors - do NOT leak stack traces, internal prompts, or secrets
    logger_js_1.logger.error({ requestId, err: err.stack || err.message }, `Unhandled error on ${req.method} ${req.originalUrl}`);
    res.status(500).json({
        error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected internal error occurred. Please refer to requestId for investigation.',
            requestId,
        },
    });
};
exports.errorHandler = errorHandler;
