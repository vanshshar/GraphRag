import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

export const errorHandler: ErrorRequestHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const requestId = req.id || 'unknown';

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    logger.warn({ requestId, err: err.errors }, `Validation error on ${req.method} ${req.originalUrl}`);
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
    logger.warn({ requestId, err: err.message, code: err.code }, `AppError on ${req.method} ${req.originalUrl}`);
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
  if ('code' in err && (err as { code: string }).code === 'LIMIT_FILE_SIZE') {
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
  logger.error({ requestId, err: err.stack || err.message }, `Unhandled error on ${req.method} ${req.originalUrl}`);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal error occurred. Please refer to requestId for investigation.',
      requestId,
    },
  });
};

