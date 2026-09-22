import { securityAudit } from '../services/audit.service';
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
export async function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): Promise<void> {
  const correlation = { requestId: res.locals.requestId, method: req.method, path: req.path };

  if (err instanceof ApiError) {
    const authentication = /\/auth\/(login|otp\/verify|reset-password)$/.test(req.path);
    if ([401, 403, 429].includes(err.statusCode) || authentication && [401, 404, 410, 422].includes(err.statusCode)) {
      await securityAudit({ actorId: authentication ? null : req.user?.id, actorRole: authentication || !req.user ? 'UNAUTHENTICATED' : req.user.role,
        action: err.statusCode === 429 ? 'AuthenticationThrottled' : authentication ? req.path.endsWith('reset-password') ? 'PasswordResetFailed' : 'LoginFailed' : 'AccessDenied',
        entity: 'Authentication', outcome: 'DENIED', metadata: { reasonCode: String(err.statusCode) } });
    }
    if (err.statusCode >= 500) logger.error(err.message, { ...correlation, stack: err.stack });
    else logger.warn(err.message, correlation);
    sendFailure(res, err.statusCode, err.message, err.errors, err.meta);
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
