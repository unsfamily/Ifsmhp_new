import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { currentUser, login as loginRequest, logout as logoutRequest, type Role, type SessionUser } from '../api/auth';
import { getAccessToken, getSessionGeneration, normalizeError, SESSION_CHANGED } from '../api/client';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  login: (payload: { email: string; password: string; remember?: boolean }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(!!getAccessToken());
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const verifiedUser = useRef<SessionUser | null>(null);
  const mounted = useRef(false);

  const refreshUser = useCallback(async () => {
    const version = ++request.current;
    const generation = getSessionGeneration();
    if (!getAccessToken()) { setUser(null); setLoading(false); setError(null); return; }
    if (!verifiedUser.current) setLoading(true);
    try {
      const nextUser = await currentUser();
      if (mounted.current && version === request.current && generation === getSessionGeneration()) {
        verifiedUser.current = nextUser; setUser(nextUser); setError(null);
      }
    } catch (failure) {
      if (mounted.current && version === request.current && generation === getSessionGeneration()) setError(normalizeError(failure).message);
      throw failure;
    } finally {
      if (mounted.current && version === request.current && generation === getSessionGeneration()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const requests = request;
    const changed = () => {
      request.current++;
      verifiedUser.current = null; setUser(null); setError(null); setLoading(!!getAccessToken());
      void refreshUser().catch(() => undefined);
    };
    window.addEventListener(SESSION_CHANGED, changed);
    changed();
    return () => { mounted.current = false; requests.current++; window.removeEventListener(SESSION_CHANGED, changed); };
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user, loading, error,
      login: async (payload) => {
        try {
          // Token installation triggers the same verified-account reload used
          // for OTP sign-in and changes from another browser tab.
          return await loginRequest(payload);
        } catch (failure) {
          throw normalizeError(failure);
        }
      },
      logout: logoutRequest,
      refreshUser,
    }),
    [loading, user, error, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

/**
 * Where a signed-in role belongs when it has nowhere more specific to go.
 * Shared with the login page so the guard and the post-login redirect cannot
 * disagree about which portal owns a role.
 */
export function homePathFor(role: Role) {
  return role === 'ADMIN' ? '/admin' : '/dashboard';
}

export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading, error, refreshUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-muted">Loading session...</div>;
  }

  if (!user && error) return <div role="alert" className="p-6 text-sm text-ink-muted">
    <p>Unable to verify your session: {error}</p>
    <button className="mt-3 underline" onClick={() => void refreshUser().catch(() => undefined)}>Retry</button>
  </div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  // Applicants have no portal of their own until an admin approves them, so
  // they leave here directly rather than bouncing through /dashboard first.
  if (user.role === 'APPLICANT') return <Navigate to="/login" replace />;
  if (role === 'ADMIN' && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  // ADMIN is intentionally admitted to member routes ("Member View" in the
  // admin sidebar); MemberLayout offers a link back.
  if (role === 'MEMBER' && !['MEMBER', 'ADMIN'].includes(user.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
