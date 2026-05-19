import { Request, Response, NextFunction } from 'express';

/**
 * Custom application error class with HTTP status code support.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(statusCode: number, message: string, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Map PostgreSQL error codes to HTTP status codes.
 * - 23505: unique_violation → 409 Conflict
 * - 23514: check_violation → 400 Bad Request
 * - 23503: foreign_key_violation → 400 Bad Request
 * - P0001: raise_exception → 400 Bad Request
 * - 55P03: lock_not_available → 503 Service Unavailable
 */
const PG_ERROR_CODE_MAP: Record<string, { statusCode: number; message: string }> = {
  '23505': { statusCode: 409, message: 'A record with this value already exists' },
  '23514': { statusCode: 400, message: 'Data validation failed' },
  '23503': { statusCode: 400, message: 'Referenced record does not exist' },
  'P0001': { statusCode: 400, message: 'Operation rejected by database' },
  '55P03': { statusCode: 503, message: 'Resource is temporarily locked, please try again' },
};

/**
 * Check if an error is a PostgreSQL error with a code property.
 */
function isPgError(error: any): error is { code: string; detail?: string; constraint?: string; message: string } {
  return error && typeof error.code === 'string' && error.code.length === 5;
}

/**
 * Parse a PostgreSQL error and return an appropriate AppError.
 */
export function parsePgError(error: any): AppError {
  if (!isPgError(error)) {
    return new AppError(500, 'Internal server error');
  }

  const mapping = PG_ERROR_CODE_MAP[error.code];
  if (mapping) {
    const details: any = {};
    if (error.detail) details.detail = error.detail;
    if (error.constraint) details.constraint = error.constraint;

    // For raise_exception (P0001), use the database error message directly
    const message = error.code === 'P0001' ? error.message : mapping.message;

    return new AppError(mapping.statusCode, message, Object.keys(details).length > 0 ? details : undefined);
  }

  return new AppError(500, 'Internal server error');
}

/**
 * Global error handling middleware.
 * Returns consistent JSON error responses: { error: string, details?: any }
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  // Handle AppError instances
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  // Handle PostgreSQL errors
  if (isPgError(err)) {
    const appError = parsePgError(err);
    res.status(appError.statusCode).json({
      error: appError.message,
      ...(appError.details && { details: appError.details }),
    });
    return;
  }

  // Handle unexpected errors
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
}
