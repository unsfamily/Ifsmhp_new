import type { Request, Response } from 'express';
import { getHealthReport } from '../services/health.service';
import { sendSuccess } from '../utils/apiResponse';

/**
 * Controllers handle HTTP only: read the request, call a service, format the
 * response. No business logic, no Prisma access (spec §1 layering).
 */
export function health(_req: Request, res: Response): void {
  sendSuccess(res, getHealthReport(), 'Service is healthy');
}
