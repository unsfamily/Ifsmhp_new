/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { normalizeError } from '../api/client';

export function useApiData<T>(loader: () => Promise<T>, deps: unknown[] = [], refreshOnSettings = false) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!refreshOnSettings) return;
    const refresh = () => { if (!document.hidden) setRevision(v => v + 1); };
    window.addEventListener('settings-changed', refresh); window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('settings-changed', refresh); window.removeEventListener('focus', refresh); };
  }, [refreshOnSettings]);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((next) => {
        if (alive) setData(next);
      })
      .catch((err) => {
        if (alive) setError(normalizeError(err).message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...deps, revision]);

  return { data, loading, error, setData };
}
