import { useEffect, useRef, useState } from 'react';
import { membershipService, type MembershipDetail } from '../../services/membershipService';
import { apiClient, normalizeError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader } from '../common/Card';
import Button from '../common/Button';
import { TextArea } from '../common/Input';

type Action = { path: string; label: string; needsText: boolean; payload: Record<string, unknown> };
export default function MembershipPanel({ id, onChange }: { id?: string; onChange?: (data: MembershipDetail) => void }) {
  const { user } = useAuth(), identity = `${user?.id}:${user?.role}:${user?.status}:${id}`;
  const owner = useRef(identity); owner.current = identity;
  const callback = useRef(onChange); callback.current = onChange;
  const [data, setData] = useState<MembershipDetail | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [action, setAction] = useState<Action | null>(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true; const controller = new AbortController(); setData(null); setError(''); setAction(null); setBusy(false); lock.current = false;
    if (!id && user?.role === 'ADMIN') return () => { mounted.current = false; controller.abort(); };
    membershipService.detail(id, controller.signal).then(next => { if (!controller.signal.aborted) { setData(next); callback.current?.(next); } }).catch(e => { if (!controller.signal.aborted) setError(normalizeError(e).message); });
    return () => { mounted.current = false; controller.abort(); };
  }, [id, identity, reload, user?.role]);
  const choose = (path: string, label: string, payload: Record<string, unknown> = {}, needsText = true) => { setText(''); setError(''); setSuccess(''); setAction({ path, label, needsText, payload: { ...payload, ...(path.endsWith('/payments') || path.endsWith('/waivers') ? { requestId: crypto.randomUUID() } : {}) } }); };
  const run = async () => {
    if (!action || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await membershipService.action(id, action.path, { ...action.payload, ...(action.needsText ? { [action.path.endsWith('/payments') ? 'reference' : 'reason']: text.trim() } : {}) });
      if (!mounted.current || owner.current !== identity) return;
      setData(next); callback.current?.(next); setAction(null); setSuccess('Membership details updated.');
    } catch (e) { if (mounted.current && owner.current === identity) { const error = normalizeError(e); setError([error.message, ...Object.values(error.fieldErrors)].join(' ')); if ([401, 403].includes(error.status ?? 0)) setData(null); } }
    finally { if (mounted.current && owner.current === identity) { lock.current = false; setBusy(false); } }
  };
  const download = async (fileId: string, name: string) => {
    try { const response = await apiClient.get(`/files/${fileId}/download`, { responseType: 'blob' }); if (!mounted.current || owner.current !== identity) return; const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { if (mounted.current && owner.current === identity) setError(normalizeError(e).message); }
  };
  if (!id && user?.role === 'ADMIN') return null;
  return <Card><CardHeader><h2 className="font-display text-xl font-semibold">Membership requirements & payments</h2></CardHeader><CardContent className="space-y-4">
    {error && <p role="alert" className="text-danger-700">{error}</p>}{success && <p role="status" className="text-success-700">{success}</p>}
    {!data ? <>{!error && <p role="status">Loading membership details…</p>}{error && <Button onClick={() => setReload(n => n + 1)}>Retry membership details</Button>}</> : <>
      <p>{data.applicationCode ? `Application ${data.applicationCode}` : 'Membership account'} · {data.status}{data.memberId ? ` · ${data.memberId}` : ''}{data.archivedAt ? ' · Archived' : ''}</p>
      {id && <>
        <p>Member ID issuance: {data.policy.idIssuance}. {data.policy.idIssuance === 'AUTOMATIC' && `Format: ${data.policy.idPrefix}-YYYY-${'N'.repeat(data.policy.idPadding ?? 6)}`}</p>
        {!!data.approvalProblems?.length && ['PENDING', 'UNDER_REVIEW'].includes(data.status) && <ul className="list-disc pl-5 text-sm">{data.approvalProblems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        {!!data.referrals?.length && <div><h3 className="font-semibold">Referrals</h3>{data.referrals.map(r => <p key={r.id} className="break-words">{r.name} · {r.email} · {r.organization}</p>)}</div>}
        {!!data.letters?.length && <div><h3 className="font-semibold">Reference letters</h3>{data.letters.map(l => <Button key={l.id} variant="outline" onClick={() => void download(l.fileId, l.name)}>{l.name}</Button>)}</div>}
        {['PENDING', 'UNDER_REVIEW'].includes(data.status) && <Button disabled={busy || !!data.evidenceReviewedAt} onClick={() => choose('evidence-review', 'Confirm evidence review', {}, false)}>{data.evidenceReviewedAt ? 'Evidence reviewed' : 'Confirm documents and references reviewed'}</Button>}
        {data.archivedAt && <Button disabled={busy} onClick={() => choose('restore', 'Restore archived application', {}, false)}>Restore from archive</Button>}
        {data.archiveSuppressed && <Button disabled={busy} onClick={() => choose('restore', 'Re-enable automatic archival', { enableAutoArchive: true }, false)}>Re-enable automatic archival</Button>}
      </>}
      {data.policy.paymentInstructions && <p className="whitespace-pre-wrap rounded-lg bg-paper p-3">{data.policy.paymentInstructions}</p>}
      {!data.charges.length && <p className="text-ink-muted">No membership charges.</p>}
      {data.charges.map(c => <div key={c.id} className="rounded-lg border border-paper-border p-4 space-y-3">
        <h3 className="font-semibold">{c.kind === 'APPLICATION' ? 'Application fee' : `Annual dues ${c.periodYear}`} · {c.currency} {c.amount}</h3>
        <p>{c.status} {c.overdue ? '· Overdue' : ''} · Due {new Date(c.dueAt).toLocaleDateString()}</p>
        {c.kind === 'ANNUAL' && <p className="text-sm text-ink-muted">Overdue annual dues do not suspend membership access.</p>}
        <div className="flex flex-wrap gap-2">
          {id && c.status === 'UNPAID' && <Button disabled={busy} onClick={() => choose(`charges/${c.id}/payments`, 'Record full payment')}>Record full payment</Button>}
          {data.policy.waiversEnabled && c.status === 'UNPAID' && data.status !== 'REJECTED' && !c.waivers.some(w => w.status === 'PENDING') && <Button disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/waivers`, 'Request full waiver')}>Request waiver</Button>}
        </div>
        {c.payments.map(p => <div key={p.id} className="text-sm"><p>Payment reference: {p.reference} {p.reversedAt ? '· Corrected / reversed' : ''}</p>{p.correctionReason && <p className="whitespace-pre-wrap">{p.correctionReason}</p>}{id && !p.reversedAt && <Button disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/corrections`, 'Correct payment record', { recordId: p.id })}>Correct payment</Button>}</div>)}
        {c.waivers.map(w => <div key={w.id} className="text-sm space-y-2"><p>Waiver: {w.status}</p><p className="whitespace-pre-wrap">{w.reason}</p>{w.decisionReason && <p className="whitespace-pre-wrap">Decision: {w.decisionReason}</p>}{id && <div className="flex flex-wrap gap-2">{(w.status === 'PENDING' ? ['APPROVED', 'REJECTED'] : w.status === 'APPROVED' ? ['REVOKED'] : []).map(status => <Button key={status} disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/waiver-decision`, `${status === 'APPROVED' ? 'Approve' : status === 'REJECTED' ? 'Reject' : 'Revoke'} waiver`, { recordId: w.id, status })}>{status === 'APPROVED' ? 'Approve waiver' : status === 'REJECTED' ? 'Reject waiver' : 'Revoke waiver'}</Button>)}</div>}</div>)}
      </div>)}
      {action && <div className="rounded-lg border border-forum-200 p-4 space-y-3"><h3 className="font-semibold">{action.label}</h3>{action.needsText ? <TextArea label={action.path.endsWith('/payments') ? 'Payment reference' : 'Reason (at least 10 characters)'} value={text} maxLength={action.path.endsWith('/payments') ? 191 : 2000} onChange={e => setText(e.target.value)} disabled={busy} /> : <p>Confirm this action for the displayed application.</p>}<div className="flex gap-2"><Button onClick={() => void run()} disabled={busy}>{busy ? 'Saving…' : action.label}</Button><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancel</Button></div></div>}
    </>}
  </CardContent></Card>;
}
