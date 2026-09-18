import { useEffect, useRef, useState } from 'react';
import { Mail, MailOpen } from 'lucide-react';
import { memberAnnouncementsApi } from '../../api/memberAnnouncements';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAnnouncementUpdates } from '../../hooks/useAnnouncementUpdates';
import { ExchangeModal } from '../exchange/ExchangeDialog';
import Button from '../common/Button';
import AnnouncementBody from './AnnouncementBody';

export default function MemberAnnouncementDetail({ id, close, returnFocus }: { id: string; close: () => void; returnFocus?: Element | null }) {
  const opener = useRef(returnFocus ?? document.activeElement);
  useEffect(() => () => { if (opener.current instanceof HTMLElement && opener.current.isConnected) opener.current.focus(); }, []);
  const revision = useAnnouncementUpdates();
  const detail = usePolledApiData(() => memberAnnouncementsApi.detail(id), [id, revision], 30000);
  const row = detail.error ? null : detail.data;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retryRead, setRetryRead] = useState(true);
  const lock = useRef(false);
  const attempted = useRef(false);
  const mark = async (read: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setRetryRead(read);
    try { detail.setData(await memberAnnouncementsApi.setRead(id, read)); }
    catch (e) { setError(normalizeError(e).message); detail.refresh(); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (row && !attempted.current) {
      attempted.current = true;
      if (row.status === 'UNREAD') void mark(true);
    }
    // One automatic read per opening; manual mark-unread must survive polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.id]);
  return <ExchangeModal title={row?.subject || 'Announcement'} close={close} busy={busy} wide>
    {detail.initialLoading && <p role="status">Loading announcement...</p>}
    {detail.error && <p role="alert" className="text-sm text-danger-600">{detail.error}<Button variant="outline" onClick={detail.refresh}>Retry</Button></p>}
    {row && <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <span>{row.sender}{row.sentAt && ` / ${new Date(row.sentAt).toLocaleString()}`}</span>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void mark(row.status !== 'READ')}>
          {row.status === 'READ' ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}{row.status === 'READ' ? 'Mark unread' : 'Mark read'}
        </Button>
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-danger-600">{error}<Button disabled={busy} variant="outline" onClick={() => void mark(retryRead)}>Retry</Button></p>}
      <AnnouncementBody body={row.body} />
      {row.expiresAt && <p className="mt-5 text-xs text-ink-muted">Available until {new Date(row.expiresAt).toLocaleString()}</p>}
    </>}
  </ExchangeModal>;
}
