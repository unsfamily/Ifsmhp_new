import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';

import { env } from './config';
import { errorHandler, globalLimiter, notFound, requestId } from './middleware';
import { communityLimiter } from './middleware/rateLimit';
import apiRoutes from './routes';

/**
 * Builds the Express application.
 *
 * Exported separately from the HTTP listener so tests can mount the app with
 * supertest without binding a port.
 *
 * Middleware order matters:
 *   requestId → security headers → CORS → rate limit → body parsers → routes
 *   → 404 → error handler (must be last, and must have four parameters).
 */
export function createApp(): Express {
  const app = express();

  // Behind a reverse proxy in production; required for correct client IPs in
  // rate limiting. Trust exactly one hop rather than blanket-trusting headers.
  if (env.isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');

  app.use(requestId);

  app.use(
    helmet({
      // The API serves JSON and file streams only, never HTML, so a strict
      // CSP here costs nothing. The SPA's CSP is configured at the edge.
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.use(
    cors({
      origin: env.allowedOrigins,
      credentials: true, // required for the refresh-token cookie
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );

  app.use(globalLimiter);
  app.use(communityLimiter);

  // Request size limits (spec §43). File uploads use multipart handling with
  // their own, larger limit from Milestone 9 — this cap applies to JSON only.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api/v1', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
