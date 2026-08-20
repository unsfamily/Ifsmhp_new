import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';

/** Terminal 404 for unmatched routes; hands off to the error handler. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`));
}
