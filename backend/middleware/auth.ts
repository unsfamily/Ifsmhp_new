import { Request, RequestHandler } from 'express';
import { ApiError } from '../utils/ApiError';
import { prisma } from '../config/database';
import { verifyAccessToken } from '../utils/security';

/* eslint-disable @typescript-eslint/no-namespace */
export type UserRole = 'MEMBER' | 'ADMIN' | 'APPLICANT';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'SUSPENDED' | 'DEACTIVATED';

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  memberId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

const extractBearerToken = (req: Request): string | null => {
  const header = req.header('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
};

/**
 * requireAuth — Verifies the caller is authenticated and returns a normalized user object on req.user.
 *
 * NOTE: Session / JWT verification is Milestone 3 (with Prisma). For now this is a
 * structural scaffold that still enforces a valid token presence in non-development
 * environments. In DEVELOPMENT mode, an X-Test-Role header is supported for manual
 * testing of the authorization pipeline.
 *
 * Per architecture §B.3 rule R1: authentication is verified on every protected request,
 * not just at login-time.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const runtimeEnv = process.env.NODE_ENV ?? 'development';
  const token = extractBearerToken(req);

  let user: AuthenticatedUser | null = null;

  if (runtimeEnv === 'development' && req.header('X-Test-Role')) {
    const testRole = req.header('X-Test-Role') as UserRole;
    const testStatus = (req.header('X-Test-Status') as UserStatus) ?? 'ACTIVE';
    user = {
      id: req.header('X-Test-User-Id') ?? 'test-user',
      role: ['ADMIN', 'MEMBER', 'APPLICANT'].includes(testRole) ? testRole : 'APPLICANT',
      status: ['ACTIVE', 'PENDING', 'REJECTED', 'SUSPENDED', 'DEACTIVATED'].includes(testStatus) ? testStatus : 'ACTIVE',
      memberId: req.header('X-Test-Member-Id'),
    };
  } else {
    if (!token) {
      return next(new ApiError(401, 'Authentication required', [
        { field: 'Authorization', message: 'Missing or invalid Bearer token' },
      ]));
    }
    try {
      const payload = verifyAccessToken(token);
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId },
        include: { user: { include: { memberProfile: true } } },
      });
      if (!session || session.revokedAt || session.expiresAt <= new Date() || session.userId !== payload.sub) {
        return next(new ApiError(401, 'Invalid or expired credentials'));
      }
      user = {
        id: session.user.id,
        role: session.user.role,
        status: session.user.status,
        memberId: session.user.memberProfile?.memberId ?? undefined,
      };
    } catch {
      return next(new ApiError(401, 'Invalid or expired credentials'));
    }
  }

  if (!user) {
    return next(new ApiError(401, 'Invalid or expired credentials'));
  }

  if (user.status !== 'ACTIVE' && user.role !== 'APPLICANT') {
    return next(new ApiError(401, 'Account is not active'));
  }

  req.user = user;
  next();
};

/**
 * requireRole — Enforces role AND status checks after requireAuth.
 *
 * Used to protect admin routes with role=ADMIN, dashboard with role=MEMBER, etc.
 * ADMIN users are always allowed to pass MEMBER checks (for escalation/view-as-user
 * scenarios) unless explicitly restricted via requireExactRole.
 *
 * Per §B.2, the ADMIN role is seed-only — never assignable through a public API.
 */
export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;

    if (!user) {
      return next(new ApiError(500, 'requireRole must run after requireAuth'));
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      return next(new ApiError(403, 'Account is not in good standing'));
    }

    const adminBypass = user.role === 'ADMIN' && allowedRoles.includes('MEMBER');
    if (!allowedRoles.includes(user.role) && !adminBypass) {
      return next(new ApiError(403, 'Insufficient permissions to access this resource'));
    }

    next();
  };
}

/**
 * requireExactRole — stricter version that does NOT allow ADMIN→MEMBER bypass.
 *
 * Use for e.g. applicant-only endpoints that admins should never be able to call
 * as if they were a regular member.
 */
export function requireExactRole(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(500, 'requireExactRole must run after requireAuth'));
    }
    if (!allowedRoles.includes(user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }
    next();
  };
}

/**
 * requireMembershipStatus — Ensures the authenticated user has membership in the
 * provided status set. Runs after requireAuth.
 *
 * Per architecture §B.3 R1: membership status is verified on every dashboard
 * request, not only at login.
 */
export function requireMembershipStatus(...statuses: UserStatus[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      return next(new ApiError(500, 'requireMembershipStatus must run after requireAuth'));
    }
    if (!statuses.includes(user.status)) {
      return next(new ApiError(403, 'Membership does not allow this action'));
    }
    next();
  };
}

/**
 * ensureOwnershipOrAdmin — Object-level ownership check helper.
 *
 * - ADMIN always passes.
 * - Otherwise compares `ownerId` (from loaded record) with `req.user.id`.
 * - On mismatch returns 404 (per §B.3 rule R5 — does not leak existence of
 *   records the caller is not authorized to see).
 *
 * This helper is NOT Express middleware; call it directly from the service/controller
 * after loading the target record. Example:
 *
 *   ensureOwnershipOrAdmin(req, project.ownerId);  // throws ApiError on fail
 */
export function ensureOwnershipOrAdmin(
  req: Request,
  ownerId: string,
  resourceLabel = 'Resource'
): void {
  const user = req.user;
  if (!user) {
    throw new ApiError(500, 'ensureOwnershipOrAdmin called without authenticated user');
  }
  if (user.role === 'ADMIN') return;
  if (user.id !== ownerId) {
    throw new ApiError(404, `${resourceLabel} not found`);
  }
}
