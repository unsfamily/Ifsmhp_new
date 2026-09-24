import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeError, SESSION_CHANGED, attachmentSessionIdentity, getAccessToken } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { PaginatedCommunityResult } from '../types/community';

export const COMMUNITY_CHANGED = 'ifsmhp:community-updated';
export const communityChanged = () => window.dispatchEvent(new Event(COMMUNITY_CHANGED));
export const accessLost = (error: unknown) => [401, 403, 404].includes(normalizeError(error).status ?? 0);

/** Latest request wins; silent polling never replaces input or flashes skeletons. */
export function useCommunityResource<T>(key: string | null, loader: () => Promise<T>, interval = 15000) {
  const { user, loading: authLoading } = useAuth();
  const enabled = key !== null && !authLoading && !!user && !!getAccessToken();
  const identity = `${attachmentSessionIdentity() ?? ''}:${user?.id ?? ''}:${user?.role ?? ''}:${key}`;
  const current = useRef(identity); current.current = identity;
  const read = useRef(loader); read.current = loader;
  const flight = useRef<{ identity: string; promise: Promise<T | undefined> } | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const [state, setState] = useState<{ identity: string; data: T | null; loading: boolean; error: string | null }>({ identity, data: null, loading: enabled, error: null });
  const refresh = useCallback((silent = true, force = false): Promise<T | undefined> => {
    if (!enabled || !getAccessToken()) return Promise.resolve(undefined);
    if (!force && flight.current?.identity === identity) return flight.current.promise;
    const version = ++generation.current;
    if (!silent) setState(s => ({ ...s, identity, loading: true, error: null }));
    const promise = read.current().then(data => {
      if (!mounted.current || current.current !== identity || generation.current !== version) return undefined;
      setState({ identity, data, loading: false, error: null });
      return data;
    }).catch(error => {
      if (mounted.current && current.current === identity && generation.current === version) setState(s => ({ identity, data: accessLost(error) ? null : s.identity === identity ? s.data : null, loading: false, error: normalizeError(error).message }));
      return undefined;
    }).finally(() => { if (flight.current?.promise === promise) flight.current = null; });
    flight.current = { identity, promise };
    return promise;
  }, [identity, enabled]);
  const replaceData = useCallback((update: (data: T | null) => T | null) => {
    if (!mounted.current || current.current !== identity) return;
    generation.current++; flight.current = null;
    setState(s => ({ identity, data: update(s.identity === identity ? s.data : null), loading: false, error: null }));
  }, [identity]);
  useEffect(() => {
    const clear = () => { generation.current++; flight.current = null; setState({ identity, data: null, loading: false, error: null }); };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => window.removeEventListener(SESSION_CHANGED, clear);
  }, [identity]);
  useEffect(() => { const requestGeneration = generation; mounted.current = true; return () => { mounted.current = false; requestGeneration.current++; flight.current = null; }; }, []);
  useEffect(() => {
    setState({ identity, data: null, loading: enabled, error: null });
    if (!enabled) return;
    void refresh(false);
    const update = () => { if (!document.hidden) void refresh(); };
    const changed = () => { void refresh(true, true); };
    const timer = window.setInterval(update, interval);
    window.addEventListener('focus', update); window.addEventListener('online', update); window.addEventListener(COMMUNITY_CHANGED, changed); document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); window.removeEventListener(COMMUNITY_CHANGED, changed); document.removeEventListener('visibilitychange', update); };
  }, [identity, enabled, interval, refresh]);
  return { ...(state.identity === identity ? state : { data: null, loading: enabled, error: null }), refresh, replaceData };
}

/** Incremental pages in the existing panels; every loaded page is revalidated. */
export function useCommunityFeed<T extends { id: string }>(key: string | null, loader: (page: number) => Promise<PaginatedCommunityResult<T>>, interval = 15000, chronological = false) {
  const scope = useRef(key); const pages = useRef(1);
  if (scope.current !== key) { scope.current = key; pages.current = 1; }
  const resource = useCommunityResource(key, async () => {
    const results = await Promise.all(Array.from({ length: pages.current }, (_, i) => loader(i + 1)));
    const first = results[0]!;
    const ordered = chronological ? [...results].reverse() : results;
    return { items: [...new Map(ordered.flatMap(r => r.items).map(item => [item.id, item])).values()], pages: first.pagination.pages, loaded: results.length };
  }, interval);
  const moreBusy = useRef(false);
  const loadMore = async () => {
    if (moreBusy.current || !resource.data || resource.data.loaded >= resource.data.pages) return;
    moreBusy.current = true;
    pages.current++;
    await resource.refresh(true, true);
    moreBusy.current = false;
  };
  return { ...resource, items: resource.data?.items ?? [], hasMore: !!resource.data && resource.data.loaded < resource.data.pages, loadMore };
}
