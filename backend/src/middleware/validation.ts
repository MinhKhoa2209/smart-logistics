import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Schema configuration for request validation.
 * Accepts Zod schemas for body, params, and/or query.
 */
interface ValidationSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

/**
 * Format Zod validation errors into field-level error details.
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_root';
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return fieldErrors;
}

/**
 * Zod-based request validation middleware factory.
 * Validates request body, params, and/or query against provided schemas.
 * Returns 400 with field-level validation errors on failure.
 *
 * @param schemas - Object containing Zod schemas for body, params, and/or query
 * @returns Express middleware function
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, Record<string, string[]>> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.body = formatZodErrors(result.error);
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.params = formatZodErrors(result.error);
      } else {
        req.params = result.data;
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.query = formatZodErrors(result.error);
      } else {
        req.query = result.data as any;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}
