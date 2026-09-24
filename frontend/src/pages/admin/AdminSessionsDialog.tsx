import { useEffect, useRef, useState } from 'react';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { adminProfileService as api, type AdminSessionPage } from '../../services/adminProfileService';
import { normalizeError } from '../../api/client';
export default function AdminSessionsDialog({ close, updated, denied }: { close: () => void; updated: () => void; denied: (e: unknown) => void }) {
  const { logout } = useAuth(); const dialog = useRef<HTMLDialogElement>(null), controller = useRef<AbortController | null>(null), version = useRef(0), lock = useRef(false);
  const [data, setData] = useState<AdminSessionPage | null>(null), [page, setPage] = useState(1), [error, setError] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    controller.current?.abort(); const request = new AbortController(); controller.current = request; const n = ++version.current; setBusy(true); setError('');
    api.sessions(page, request.signal).then(next => { if (n === version.current && !request.signal.aborted) setData(next); }).catch(e => { if (!request.signal.aborted) { const p = normalizeError(e); setError(p.message); if ([401, 403].includes(p.status ?? 0)) denied(e); } }).finally(() => { if (n === version.current) setBusy(false); });
    return () => request.abort();
  }, [page, reload, denied]);
  const revoke = async () => {
    if (!confirm || lock.current) return; lock.current = true; setBusy(true); setError(''); version.current++;
    try { const result = await api.revoke(confirm === 'others' ? undefined : confirm, controller.current?.signal); if (controller.current?.signal.aborted) return; if (result.signedOut) { await logout(); close(); return; } setConfirm(null); updated(); setReload(v => v + 1); }
    catch (e) { if (!controller.current?.signal.aborted) { const p = normalizeError(e); setError(p.message); if ([401, 403].includes(p.status ?? 0)) denied(e); } }
    finally { lock.current = false; setBusy(false); }
  };
  return <dialog ref={dialog} onCancel={close} className="w-[min(95vw,680px)] rounded-xl bg-paper-raised p-5 text-ink shadow-xl backdrop:bg-forum-900/50" aria-labelledby="sessions-heading">
    <div className="flex justify-between gap-3"><h2 id="sessions-heading" className="font-display text-xl">Active sessions</h2><Button variant="ghost" onClick={close}>Close</Button></div>
    {error && <p role="alert" className="my-3 text-danger-600">{error} <button onClick={() => setReload(v => v + 1)}>Retry</button></p>}
    {busy && <p role="status">Loading…</p>}
    <div className="my-4 space-y-3">{data?.items.map(s => <div key={s.id} className="rounded-lg border border-paper-border p-3 text-sm break-words"><p className="font-semibold">{s.current ? 'This browser' : 'Other session'}</p><p>{s.userAgent || 'Browser details unavailable'}</p><p>{s.ipAddress || 'IP unavailable'}</p><p>Started: {new Date(s.createdAt).toISOString()} · Expires: {new Date(s.expiresAt).toISOString()}</p><Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm(s.id)}>{s.current ? 'Sign out this browser' : 'Revoke session'}</Button></div>)}</div>
    {!busy && data?.items.length === 0 && <p>No active sessions.</p>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>Page {data?.pagination.page ?? page} of {data?.pagination.pages ?? 1}</span><Button variant="outline" disabled={busy || !data || page >= data.pagination.pages} onClick={() => setPage(p => p + 1)}>Next</Button><Button variant="outline" disabled={busy} onClick={() => setConfirm('others')}>Revoke other sessions</Button></div>
    {confirm && <div className="mt-4 border-t border-paper-border pt-4"><p>{confirm === 'others' ? 'Sign out all other sessions?' : 'Sign out this session immediately?'}</p><div className="flex gap-2 mt-2"><Button disabled={busy} onClick={() => void revoke()}>Confirm revocation</Button><Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</Button></div></div>}
  </dialog>;
}
