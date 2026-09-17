import { useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { announcementApi, type AnnouncementAction } from '../../api/announcements';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { ExchangeModal } from '../exchange/ExchangeDialog';
import Button from '../common/Button';
import AnnouncementBody from './AnnouncementBody';
import Pagination from './Pagination';
export default function AnnouncementDetail({ id, close, changed }: { id: string; close: () => void; changed: () => void }) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [channel, setChannel] = useState('All');
  const [purpose, setPurpose] = useState('BROADCAST');
  const [view, setView] = useState<'preview' | 'deliveries'>('preview');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const lock = useRef(false);
  const request = useRef({ signature: '', id: crypto.randomUUID() });
  const detail = usePolledApiData(() => announcementApi.detail(id), [id], 15000);
  const deliveries = usePolledApiData(() => announcementApi.deliveries(id, { page, limit, channel, purpose }), [id, page, limit, channel, purpose], 15000);
  const row = detail.data;
  const act = async (kind: AnnouncementAction) => {
    if (!row || lock.current) return;
    lock.current = true; setBusy(true); setError(''); setResult('');
    const signature = `${kind}:${row.revision}`;
    if (request.current.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    try { await announcementApi.act(row, kind, request.current.id, confirmed); request.current.signature = ''; setResult(kind === 'sign-off' ? 'Sign-off recorded for this revision.' : 'Retry queued.'); detail.refresh(); deliveries.refresh(); changed(); }
    catch (e) { setError(normalizeError(e).message); } finally { lock.current = false; setBusy(false); }
  };
  return <ExchangeModal title={row?.subject || 'Announcement details'} close={close} busy={busy} wide>
    {detail.initialLoading && <p role="status">Loading announcement...</p>}
    {(detail.error || error) && <div role="alert" className="mb-4 text-sm text-danger-600">{detail.error || error}<Button variant="outline" onClick={detail.refresh}>Reload</Button></div>}
    {result && <p role="status" className="mb-3 text-sm text-success-600">{result}</p>}
    {row && <>
      <p className="mb-4 text-xs text-ink-muted">{row.status} · Revision {row.revision} · {row.audience} · {row.channel}</p>
      <div className="mb-4 flex gap-2 border-b border-paper-border" role="tablist" aria-label="Announcement details">
        {(['preview', 'deliveries'] as const).map(v => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`px-3 py-2 text-sm capitalize ${view === v ? 'border-b-2 border-forum-700 text-forum-900' : 'text-ink-muted'}`}>{v}</button>)}
      </div>
      {view === 'preview' ? <>
        <AnnouncementBody body={row.body} />
        <p className="mt-5 text-sm font-medium">{row.senderAsCRO ? 'CRO Office' : 'Communications team'}</p>
        {row.appendUnsubscribe && row.channel !== 'In-App Only' && <p className="mt-2 text-xs text-ink-subtle">Announcement-email unsubscribe footer included.</p>}
        {(row.sendSABPreview || row.previewDelivery.length > 0) && <div className="mt-5 border-t border-paper-border pt-4 text-sm">
          <p className="font-semibold">SAB review: {row.signedOff ? 'Signed off' : row.previewReady ? 'Preview delivered; sign-off pending' : 'Preview delivery pending'}</p>
          <p className="mt-1 text-xs text-ink-muted">{row.previewDelivery.map(d => `${d.count} ${d.status.toLowerCase()}`).join(', ') || 'No preview requested.'}</p>
          {!row.signedOff && row.previewReady && !row.dispatchStartedAt && <>
            <label className="my-3 flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I confirm SAB approval for revision {row.revision} has been obtained.</label>
            <Button disabled={!confirmed || busy} onClick={() => void act('sign-off')}><ShieldCheck className="h-4 w-4" />Confirm sign-off</Button>
          </>}
        </div>}
      </> : <>
        <p className="mb-4 text-xs text-ink-muted">Email success means SMTP acceptance. Email opens and clicks are unavailable. Legacy delivery history is unverified.</p>
        <div className="mb-4 flex flex-wrap gap-2">
          <select aria-label="Delivery channel" value={channel} onChange={e => { setChannel(e.target.value); setPage(1); }} className="rounded-md border border-paper-border bg-paper p-2 text-sm">{['All', 'EMAIL', 'IN_APP', 'LEGACY'].map(c => <option key={c}>{c}</option>)}</select>
          <select aria-label="Delivery purpose" value={purpose} onChange={e => { setPurpose(e.target.value); setPage(1); }} className="rounded-md border border-paper-border bg-paper p-2 text-sm">{['BROADCAST', 'PREVIEW', 'All'].map(p => <option key={p}>{p}</option>)}</select>
          {[...row.delivery, ...row.previewDelivery].some(d => ['FAILED', 'UNCONFIGURED'].includes(d.status)) && <Button variant="outline" disabled={busy} onClick={() => void act('retry')}><RefreshCw className="h-4 w-4" />Retry failed deliveries</Button>}
        </div>
        {deliveries.error && <p role="alert" className="text-sm text-danger-600">{deliveries.error}<Button variant="outline" onClick={deliveries.refresh}>Retry</Button></p>}
        {deliveries.initialLoading ? <p role="status">Loading deliveries...</p> : <div className="space-y-3">
          {deliveries.data?.items.map(d => <div key={d.id} className="border-b border-paper-border pb-3 text-xs">
            <div className="flex flex-wrap justify-between gap-2"><span className="break-all font-medium">{d.recipientEmail || d.recipientUserId || 'Legacy recipient'}</span><span>{d.channel} · {d.status} · revision {d.revision ?? '-'}</span></div>
            <p className="mt-1 text-ink-muted">{d.attempts} attempts{d.deliveredAt && ` · Delivered ${new Date(d.deliveredAt).toLocaleString()}`}{d.openedAt && d.channel === 'IN_APP' && ` · Read ${new Date(d.openedAt).toLocaleString()}`}</p>
            {d.error && <p className="mt-1 text-danger-600">{d.error}</p>}
          </div>)}
          {deliveries.data?.items.length === 0 && <p className="py-5 text-sm text-ink-muted">No delivery records for these filters.</p>}
          {deliveries.data && <Pagination meta={deliveries.data.pagination} page={page} limit={limit} setPage={setPage} setLimit={n => { setLimit(n); setPage(1); }} />}
        </div>}
      </>}
    </>}
  </ExchangeModal>;
}
