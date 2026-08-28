import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { currentUser, login as loginRequest, logout as logoutRequest, type Role, type SessionUser } from '../api/auth';
import { getAccessToken, normalizeError } from '../api/client';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (payload: { email: string; password: string; remember?: boolean }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const nextUser = await currentUser();
    setUser(nextUser);
  };

  useEffect(() => {
    // With no stored access token there is nothing to restore: /auth/me would
    // 401, and the response interceptor would follow it with a second 401 from
    // /auth/refresh. Skipping both keeps public pages request-free for visitors
    // who have never signed in. An expired token is still worth probing — the
    // interceptor refreshes it via the httpOnly cookie and retries.
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }

    currentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (payload) => {
        try {
          const nextUser = await loginRequest(payload);
          setUser(nextUser);
          return nextUser;
        } catch (error) {
          throw normalizeError(error);
        }
      },
      logout: async () => {
        await logoutRequest();
        setUser(null);
      },
      refreshUser,
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}

export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-paper flex items-center justify-center text-sm text-ink-muted">Loading session...</div>;
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (role === 'ADMIN' && user.role !== 'ADMIN') return <Navigate to="/dashboard" replace />;
  if (role === 'MEMBER' && !['MEMBER', 'ADMIN'].includes(user.role)) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
