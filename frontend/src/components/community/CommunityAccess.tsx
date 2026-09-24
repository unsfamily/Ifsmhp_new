import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { communityService } from '../../services/communityService';
import { useCommunityResource } from '../../hooks/useCommunityResource';
import EmptyCommunityState from './EmptyCommunityState';

export function useCommunityCapabilities() {
  const { user } = useAuth();
  return useCommunityResource(user?.role === 'MEMBER' ? 'capabilities' : null, communityService.getCapabilities);
}
export function RequireCommunityManager({ children }: { children: ReactNode }) {
  const { user, loading, error, refreshUser } = useAuth(); const location = useLocation(); const result = useCommunityCapabilities();
  if (loading || (user?.role === 'MEMBER' && result.loading)) return <p className="p-6 text-sm text-ink-muted">Loading session...</p>;
  if (!user && error) return <EmptyCommunityState title="Session verification unavailable" error={error} retry={() => void refreshUser().catch(() => undefined)} />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role === 'ADMIN') return <>{children}</>;
  if (result.error) return <EmptyCommunityState title="Community access unavailable" error={result.error} retry={() => void result.refresh(false)} />;
  if (!result.data?.canModerate) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
