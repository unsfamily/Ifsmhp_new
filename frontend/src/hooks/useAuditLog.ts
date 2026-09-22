import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeError } from '../api/client';
import { auditService, type AuditFilters, type AuditOptions, type AuditPage, type AuditSummary } from '../services/auditService';
export function useAuditLog(filters: AuditFilters, page: number) {
  const { user } = useAuth();
  const identity = JSON.stringify([user?.id, user?.role, user?.status, filters, page]);
  const current = useRef(identity); current.current = identity;
  const sequence = useRef(0), controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ identity: string; data: AuditPage | null; summary: AuditSummary | null; options: AuditOptions | null; loading: boolean; error: string | null; denied: boolean }>({ identity, data: null, summary: null, options: null, loading: true, error: null, denied: false });
  const refresh = useCallback(async () => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request;
    const version = ++sequence.current;
    if (user?.role !== 'ADMIN') { setState({ identity, data: null, summary: null, options: null, loading: false, error: 'Administrator access required.', denied: true }); return; }
    setState(s => ({ ...(s.identity === identity ? s : { identity, data: null, summary: null, options: null, denied: false }), loading: true, error: null }));
    try {
      const [data, summary, options] = await Promise.all([auditService.list({ ...filters, page, limit: 20 }, request.signal), auditService.summary(request.signal), auditService.options(request.signal)]);
      if (!request.signal.aborted && current.current === identity && sequence.current === version) setState({ identity, data, summary, options, loading: false, error: null, denied: false });
    } catch (error) {
      if (request.signal.aborted || current.current !== identity || sequence.current !== version) return;
      const problem = normalizeError(error), denied = [401, 403].includes(problem.status ?? 0);
      setState(s => ({ ...s, identity, ...(denied ? { data: null, summary: null, options: null } : {}), loading: false, denied, error: Object.values(problem.fieldErrors).join(" ") || problem.message }));
    }
  }, [identity, user?.role, filters, page]);
  useEffect(() => {
    void refresh(); const update = () => { if (!document.hidden) void refresh(); };
    const timer = window.setInterval(update, 60000);
    window.addEventListener('focus', update); window.addEventListener('online', update); document.addEventListener('visibilitychange', update);
    return () => { controller.current?.abort(); window.clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('online', update); document.removeEventListener('visibilitychange', update); };
  }, [refresh]);
  const revokeAccess = useCallback((message: string) => {
    controller.current?.abort(); sequence.current++;
    setState({ identity, data: null, summary: null, options: null, loading: false, error: message, denied: true });
  }, [identity]);
  return { ...(state.identity === identity ? state : { data: null, summary: null, options: null, loading: true, error: null, denied: false }), refresh, revokeAccess };
}
