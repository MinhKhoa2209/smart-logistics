import { Request, Response, NextFunction } from 'express';

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

const PG_ERROR_CODE_MAP: Record<string, { statusCode: number; message: string; }> = {
  '23505': { statusCode: 409, message: 'A record with this value already exists' },
  '23514': { statusCode: 400, message: 'Data validation failed' },
  '23503': { statusCode: 400, message: 'Referenced record does not exist' },
  'P0001': { statusCode: 400, message: 'Operation rejected by database' },
  '55P03': { statusCode: 503, message: 'Resource is temporarily locked, please try again' },
};

function isPgError(error: any): error is { code: string; detail?: string; constraint?: string; message: string; } {
  return error && typeof error.code === 'string' && error.code.length === 5;
}

export function parsePgError(error: any): AppError {
  if (!isPgError(error)) {
    return new AppError(500, 'Internal server error');
  }

  const mapping = PG_ERROR_CODE_MAP[error.code];
  if (mapping) {
    const details: any = {};
    if (error.detail) details.detail = error.detail;
    if (error.constraint) details.constraint = error.constraint;

    const message = error.code === 'P0001' ? error.message : mapping.message;

    return new AppError(mapping.statusCode, message, Object.keys(details).length > 0 ? details : undefined);
  }

  return new AppError(500, 'Internal server error');
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details && { details: err.details }),
    });
    return;
  }

  if (isPgError(err)) {
    const appError = parsePgError(err);
    res.status(appError.statusCode).json({
      error: appError.message,
      ...(appError.details && { details: appError.details }),
    });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
  });
}
