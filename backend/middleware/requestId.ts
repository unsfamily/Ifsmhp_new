import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Assigns a correlation ID to every request. Returned to the client on
 * failures so a user can quote it in a support message without the server
 * having to expose any internal detail.
 */
export function requestId(_req: Request, res: Response, next: NextFunction): void {
  const id = randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
