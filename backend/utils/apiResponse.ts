import type { Response } from 'express';
import type { FieldError } from './ApiError';

/** Success envelope — spec §40. */
export interface SuccessBody<T> {
  success: true;
  data: T;
  message: string;
}

/** Failure envelope — spec §40. */
export interface FailureBody {
  success: false;
  message: string;
  errors: FieldError[];
  /** Correlates a client-visible failure with a server log entry. */
  requestId?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Operation completed successfully',
  statusCode = 200,
): Response<SuccessBody<T>> {
  return res.status(statusCode).json({ success: true, data, message });
}

export function sendFailure(
  res: Response,
  statusCode: number,
  message: string,
  errors: FieldError[] = [],
): Response<FailureBody> {
  const body: FailureBody = { success: false, message, errors };
  if (res.locals.requestId) body.requestId = res.locals.requestId as string;
  return res.status(statusCode).json(body);
}
