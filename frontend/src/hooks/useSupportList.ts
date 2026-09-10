import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supportApi } from '../api/support';
import { usePolledApiData } from './usePolledApiData';

export function useSupportList(admin: boolean) {
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  const result = usePolledApiData(async () => ({ ...(await supportApi.list(admin, Object.fromEntries(new URLSearchParams(debounced)))), query: debounced }), [admin, debounced], 30000);
  const data = !result.error && result.data?.query === query ? result.data : null;
  const filter = (name: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === 'All') next.delete(name); else next.set(name, value);
      if (name !== 'page') next.delete('page');
      return next;
    }, { replace: true });
  };
  return { ...result, data, loading: !data && (!result.error || query !== debounced), params, filter, reset: () => setParams({}) };
}
