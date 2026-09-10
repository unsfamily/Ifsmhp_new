import { useEffect, useState } from 'react';
import { useApiData } from './useApiData';

/**
 * useApiData that refetches on an interval.
 *
 * There is no realtime transport on the API, so the inbox and the open thread
 * stay current by polling. Polling pauses while the tab is hidden — that is what
 * keeps a 10s thread poll comfortably inside the server's 300-req/15min limiter
 * rather than burning requests against a backgrounded tab.
 *
 * The interval is owned by an effect keyed on the state it depends on, never
 * guarded by a ref: under StrictMode the dev-mode mount/unmount/remount runs the
 * cleanup, and a ref-guarded effect then returns early on the remount, leaving
 * the timer dead for the life of the page.
 */
export function usePolledApiData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  intervalMs: number,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const [tick, setTick] = useState(0);
  const [visible, setVisible] = useState(() =>
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  );

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  const polling = enabled && visible && intervalMs > 0;

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [polling, intervalMs]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const result = useApiData<T>(loader, [...deps, tick]);

  return {
    ...result,
    /**
     * True only until the first payload lands. `loading` flips on every poll, so
     * rendering a spinner from it would blank the thread every few seconds.
     */
    initialLoading: result.loading && result.data === null,
    /** A refetch over content that is already on screen. */
    refreshing: result.loading && result.data !== null,
    refresh: () => setTick((t) => t + 1),
    polling,
  };
}
