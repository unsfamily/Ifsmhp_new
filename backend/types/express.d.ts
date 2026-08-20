/**
 * Express request augmentation.
 *
 * `req.user` is populated by the authentication middleware in Milestone 5.
 * Declared here so the shape is agreed before any route depends on it.
 */
export interface AuthenticatedUser {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED' | 'DEACTIVATED';
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
