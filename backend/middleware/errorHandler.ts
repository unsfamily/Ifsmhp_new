import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiError, type FieldError } from '../utils/ApiError';
import { sendFailure } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config';

function zodToFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/**
 * Central error handler — the ONLY place that formats an error for the client.
 *
 * Unexpected errors are logged in full server-side and reduced to a generic
 * message for the client: no stack traces, SQL, filesystem paths or secrets
 * ever cross the wire (spec §40, §43).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlation = { requestId: res.locals.requestId, method: req.method, path: req.path };

  if (err instanceof ApiError) {
    if (err.statusCode >= 500) logger.error(err.message, { ...correlation, stack: err.stack });
    else logger.warn(err.message, correlation);
    sendFailure(res, err.statusCode, err.message, err.errors);
    return;
  }

  if (err instanceof ZodError) {
    logger.warn('Request validation failed', correlation);
    sendFailure(res, 422, 'Validation failed', zodToFieldErrors(err));
    return;
  }

  // Anything reaching here is a bug or an infrastructure failure.
  const message = err instanceof Error ? err.message : 'Unknown error';
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error('Unhandled error', { ...correlation, message, stack });

  sendFailure(
    res,
    500,
    env.isProduction ? 'An unexpected error occurred' : `Unexpected error: ${message}`,
  );
}
