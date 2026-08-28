/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from 'react';
import { normalizeError } from '../api/client';

export function useApiData<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, deps);

  return { data, loading, error, setData };
}
