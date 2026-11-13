import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { membershipService, type MembershipDetail } from '../../services/membershipService';
import { openRazorpayCheckout, RazorpayCheckoutError } from '../../services/razorpayCheckout';
import { apiClient, normalizeError } from '../../api/client';
import { uploadRegistrationDocument } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader } from '../common/Card';
import Button from '../common/Button';
import { TextArea } from '../common/Input';

type Action = { path: string; label: string; needsText: boolean; payload: Record<string, unknown>; textKey: 'reference' | 'reason'; seed?: string };
const isReferencePath = (path: string) => path.endsWith('/payments') || path.endsWith('/payment-claims');
export default function MembershipPanel({ id, onChange }: { id?: string; onChange?: (data: MembershipDetail) => void }) {
  const { user } = useAuth(), identity = `${user?.id}:${user?.role}:${user?.status}:${id}`;
  const [searchParams] = useSearchParams();
  const paymentResult = searchParams.get('payment');
  const owner = useRef(identity); owner.current = identity;
  const callback = useRef(onChange); callback.current = onChange;
  const [data, setData] = useState<MembershipDetail | null>(null), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const [action, setAction] = useState<Action | null>(null), [text, setText] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [proof, setProof] = useState<{ id: string; claimToken: string; name: string } | null>(null);
  const mounted = useRef(false), lock = useRef(false);
  useEffect(() => {
    mounted.current = true; const controller = new AbortController(); setData(null); setError(''); setAction(null); setBusy(false); lock.current = false;
    if (!id && user?.role === 'ADMIN') return () => { mounted.current = false; controller.abort(); };
    membershipService.detail(id, controller.signal).then(next => { if (!controller.signal.aborted) { setData(next); callback.current?.(next); } }).catch(e => { if (!controller.signal.aborted) setError(normalizeError(e).message); });
    setProof(null);
    return () => { mounted.current = false; controller.abort(); };
  }, [id, identity, reload, user?.role]);
  const choose = (path: string, label: string, payload: Record<string, unknown> = {}, needsText = true, seed = '') => {
    setText(seed); setError(''); setSuccess(''); setProof(null);
    setAction({ path, label, needsText, payload: { ...payload, ...(isReferencePath(path) || path.endsWith('/waivers') ? { requestId: crypto.randomUUID() } : {}) }, textKey: isReferencePath(path) ? 'reference' : 'reason', seed });
  };
  const onProof = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const uploaded = await uploadRegistrationDocument(file);
      if (!mounted.current || owner.current !== identity) return;
      setProof({ id: uploaded.id, claimToken: uploaded.claimToken, name: uploaded.name });
    } catch (e) { if (mounted.current && owner.current === identity) setError(normalizeError(e).message); }
    finally { if (mounted.current && owner.current === identity) setBusy(false); }
  };
  const run = async () => {
    if (!action || lock.current) return;
    if (action.path.endsWith('/payment-claims') && !proof) { setError('Upload a JPEG or PNG screenshot of the payment.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const next = await membershipService.action(id, action.path, { ...action.payload, ...(action.needsText ? { [action.textKey]: text.trim() } : {}), ...(action.path.endsWith('/payment-claims') && proof ? { fileId: proof.id, claimToken: proof.claimToken } : {}) });
      if (!mounted.current || owner.current !== identity) return;
      setData(next); callback.current?.(next); setAction(null); setSuccess('Membership details updated.');
    } catch (e) { if (mounted.current && owner.current === identity) { const error = normalizeError(e); setError([error.message, ...Object.values(error.fieldErrors)].join(' ')); if ([401, 403].includes(error.status ?? 0)) setData(null); } }
    finally { if (mounted.current && owner.current === identity) { lock.current = false; setBusy(false); } }
  };
  const payWithRazorpay = async (chargeId: string) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const checkout = await membershipService.razorpay(chargeId);
      if (!mounted.current || owner.current !== identity) return;
      const response = await openRazorpayCheckout(checkout);
      const next = await membershipService.razorpayConfirm(chargeId, { orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature });
      if (!mounted.current || owner.current !== identity) return;
      setData(next); callback.current?.(next); setSuccess('Payment received. An administrator still approves membership separately.');
    } catch (e) {
      if (mounted.current && owner.current === identity) setError(e instanceof RazorpayCheckoutError ? e.message : normalizeError(e).message);
    } finally {
      if (mounted.current && owner.current === identity) { lock.current = false; setBusy(false); }
    }
  };
  const download = async (fileId: string, name: string) => {
    try { const response = await apiClient.get(`/files/${fileId}/download`, { responseType: 'blob' }); if (!mounted.current || owner.current !== identity) return; const url = URL.createObjectURL(response.data); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    catch (e) { if (mounted.current && owner.current === identity) setError(normalizeError(e).message); }
  };
  if (!id && user?.role === 'ADMIN') return null;
  const pending = data && ['PENDING', 'UNDER_REVIEW'].includes(data.status);
  const applicationCharge = data?.charges.find(c => c.kind === 'APPLICATION');
  const feeSettled = !applicationCharge || applicationCharge.status !== 'UNPAID' || !!data?.applicationFeeExempt;
  const evidenceDone = !!data?.evidenceReviewedAt || !(data?.policy.requireProfile || data?.policy.requireCredential || (data?.policy.referralCount ?? 0) || (data?.policy.referenceLetterCount ?? 0));
  return <Card><CardHeader><h2 className="font-display text-xl font-semibold">Membership requirements & payments</h2></CardHeader><CardContent className="space-y-4">
    {error && <p role="alert" className="text-danger-700">{error}</p>}{success && <p role="status" className="text-success-700">{success}</p>}
    {paymentResult === 'success' && <p role="status" className="rounded-lg bg-success-100 px-3 py-2 text-sm text-success-700">Payment received. An administrator still approves membership separately.</p>}
    {paymentResult === 'failed' && <p role="alert" className="rounded-lg bg-danger-100 px-3 py-2 text-sm text-danger-700">Payment was not completed. You can try Razorpay again.</p>}
    {!data ? <>{!error && <p role="status">Loading membership details…</p>}{error && <Button onClick={() => setReload(n => n + 1)}>Retry membership details</Button>}</> : <>
      <p>{data.applicationCode ? `Application ${data.applicationCode}` : 'Membership account'} · {data.status}{data.memberId ? ` · ${data.memberId}` : ''}{data.archivedAt ? ' · Archived' : ''}</p>
      {pending && !id && <ol className="list-decimal space-y-1 rounded-lg border border-paper-border bg-paper/60 p-3 pl-8 text-sm">
        <li>{data.applicationFeeExempt || !applicationCharge ? 'No application fee — student membership can be approved without payment.' : feeSettled ? 'Your application fee is recorded or waived.' : data.razorpayEnabled ? 'Pay the application fee with Razorpay. Membership is granted only after that payment succeeds and an administrator approves it.' : 'Pay the fee using the instructions below, then submit your UTR / UPI reference and a payment screenshot. The screenshot is required.'}</li>
        <li>{data.razorpayEnabled && !feeSettled ? 'After Razorpay confirms the fee, an administrator reviews the application and approves membership. You are not a member until that approval.' : 'An administrator matches your UTR to the bank statement, records payment, reviews documents, then approves membership. You are not a member until that approval.'}</li>
      </ol>}
      {pending && id && <ol className="list-decimal space-y-1 rounded-lg border border-paper-border bg-paper/60 p-3 pl-8 text-sm">
        <li>{data.applicationFeeExempt || !applicationCharge ? 'No application fee for this applicant (Student).' : feeSettled ? 'Application fee recorded or waived — approval may proceed once evidence is confirmed.' : data.razorpayEnabled ? 'The applicant pays this fee in Razorpay. Approval stays blocked until Razorpay confirms the payment or a waiver is approved.' : 'Verify the UTR in the bank statement, then record payment. Approval stays blocked until the fee is PAID or WAIVED.'}</li>
        <li>{evidenceDone ? 'Required documents and references reviewed.' : 'Confirm documents and references have been reviewed.'}</li>
        <li>Approve membership separately to issue the member ID — only after payment (unless Student / waived).</li>
      </ol>}
      {id && <>
        <p>Member ID issuance: {data.policy.idIssuance}. {data.policy.idIssuance === 'AUTOMATIC' && `Format: ${data.policy.idPrefix}-${'N'.repeat(data.policy.idPadding ?? 6)}`}</p>
        {!!data.approvalProblems?.length && pending && <ul className="list-disc pl-5 text-sm">{data.approvalProblems.map(problem => <li key={problem}>{problem}</li>)}</ul>}
        {!!data.referrals?.length && <div><h3 className="font-semibold">Referrals</h3>{data.referrals.map(r => <p key={r.id} className="break-words">{r.name} · {r.email} · {r.organization}</p>)}</div>}
        {!!data.letters?.length && <div><h3 className="font-semibold">Reference letters</h3>{data.letters.map(l => <Button key={l.id} variant="outline" onClick={() => void download(l.fileId, l.name)}>{l.name}</Button>)}</div>}
        {pending && <Button disabled={busy || !!data.evidenceReviewedAt} onClick={() => choose('evidence-review', 'Confirm evidence review', {}, false)}>{data.evidenceReviewedAt ? 'Evidence reviewed' : 'Confirm documents and references reviewed'}</Button>}
        {data.archivedAt && <Button disabled={busy} onClick={() => choose('restore', 'Restore archived application', {}, false)}>Restore from archive</Button>}
        {data.archiveSuppressed && <Button disabled={busy} onClick={() => choose('restore', 'Re-enable automatic archival', { enableAutoArchive: true }, false)}>Re-enable automatic archival</Button>}
      </>}
      {data.policy.paymentInstructions && <p className="whitespace-pre-wrap rounded-lg bg-paper p-3">{data.policy.paymentInstructions}</p>}
      {data.applicationFeeExempt && !data.charges.some(c => c.kind === 'APPLICATION') && <p role="status">No application fee — student registrations are free.</p>}
      {!data.charges.length && !data.applicationFeeExempt && <p className="text-ink-muted">No membership charges.</p>}
      {data.charges.map(c => <div key={c.id} className="rounded-lg border border-paper-border p-4 space-y-3">
        <h3 className="font-semibold">{c.kind === 'APPLICATION' ? 'Application fee' : `Annual dues ${c.periodYear}`} · {c.currency} {c.amount}</h3>
        <p>{c.status} {c.overdue ? '· Overdue' : ''} · Due {new Date(c.dueAt).toLocaleDateString()}</p>
        {c.kind === 'ANNUAL' && <p className="text-sm text-ink-muted">Overdue annual dues do not suspend membership access.</p>}
        {c.claimedReference && <p className="text-sm">Submitted payment reference: {c.claimedReference}{c.claimedAt ? ` · ${new Date(c.claimedAt).toLocaleString()}` : ''}{c.status === 'UNPAID' ? ' · awaiting admin verification' : ''}</p>}
        {c.claimedScreenshot && <p className="text-sm">Payment screenshot: <button type="button" className="font-medium text-forum-700 underline" onClick={() => void download(c.claimedScreenshot!.fileId, c.claimedScreenshot!.name)}>{c.claimedScreenshot.name}</button></p>}
        <div className="flex flex-wrap gap-2">
          {!id && c.status === 'UNPAID' && data.status !== 'REJECTED' && data.razorpayEnabled && c.currency === 'INR' && <Button disabled={busy} onClick={() => void payWithRazorpay(c.id)}>Pay with Razorpay</Button>}
          {!id && c.status === 'UNPAID' && data.status !== 'REJECTED' && !(data.razorpayEnabled && c.currency === 'INR') && <Button disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/payment-claims`, c.claimedReference ? 'Update payment reference' : 'Submit payment reference', {}, true, c.claimedReference ?? '')}>{c.claimedReference ? 'Update payment reference' : 'Submit payment reference'}</Button>}
          {id && c.status === 'UNPAID' && !(data.razorpayEnabled && c.currency === 'INR') && <Button disabled={busy} onClick={() => choose(`charges/${c.id}/payments`, 'Record full payment', {}, true, c.claimedReference ?? '')}>Record full payment</Button>}
          {data.policy.waiversEnabled && c.status === 'UNPAID' && data.status !== 'REJECTED' && !c.waivers.some(w => w.status === 'PENDING') && <Button disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/waivers`, 'Request full waiver')}>Request waiver</Button>}
        </div>
        {id && c.status === 'UNPAID' && c.claimedReference && !(data.razorpayEnabled && c.currency === 'INR') && <p className="text-xs text-ink-muted">Recording payment must use the same UTR the applicant submitted (or update their claim first).</p>}
        {c.payments.map(p => <div key={p.id} className="text-sm"><p>Verified payment reference: {p.reference} {p.reversedAt ? '· Corrected / reversed' : ''}</p>{p.correctionReason && <p className="whitespace-pre-wrap">{p.correctionReason}</p>}{id && !p.reversedAt && <Button disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/corrections`, 'Correct payment record', { recordId: p.id })}>Correct payment</Button>}</div>)}
        {c.waivers.map(w => <div key={w.id} className="text-sm space-y-2"><p>Waiver: {w.status}</p><p className="whitespace-pre-wrap">{w.reason}</p>{w.decisionReason && <p className="whitespace-pre-wrap">Decision: {w.decisionReason}</p>}{id && <div className="flex flex-wrap gap-2">{(w.status === 'PENDING' ? ['APPROVED', 'REJECTED'] : w.status === 'APPROVED' ? ['REVOKED'] : []).map(status => <Button key={status} disabled={busy} variant="outline" onClick={() => choose(`charges/${c.id}/waiver-decision`, `${status === 'APPROVED' ? 'Approve' : status === 'REJECTED' ? 'Reject' : 'Revoke'} waiver`, { recordId: w.id, status })}>{status === 'APPROVED' ? 'Approve waiver' : status === 'REJECTED' ? 'Reject waiver' : 'Revoke waiver'}</Button>)}</div>}</div>)}
      </div>)}
      {action && <div className="rounded-lg border border-forum-200 p-4 space-y-3"><h3 className="font-semibold">{action.label}</h3>{action.needsText ? <TextArea label={action.textKey === 'reference' ? 'Payment reference (UTR / UPI)' : 'Reason (at least 10 characters)'} value={text} maxLength={action.textKey === 'reference' ? 191 : 2000} onChange={e => setText(e.target.value)} disabled={busy} /> : <p>Confirm this action for the displayed application.</p>}{action.path.endsWith('/payment-claims') && <label className="block text-sm font-medium text-ink">Payment screenshot *<input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="mt-1.5 block w-full text-sm" disabled={busy} onChange={event => { void onProof(event.target.files?.[0] ?? null); }} />{proof ? <span className="mt-1 block text-xs text-success-700">{proof.name}</span> : <span className="mt-1 block text-xs text-ink-muted">JPEG or PNG, required before you submit.</span>}</label>}<div className="flex gap-2"><Button onClick={() => void run()} disabled={busy || (action.path.endsWith('/payment-claims') && !proof)}>{busy ? 'Saving…' : action.label}</Button><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancel</Button></div></div>}
    </>}
  </CardContent></Card>;
}
