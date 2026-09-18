import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { notificationsApi, type NotificationItem } from '../../api/notifications';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import Button from '../../components/common/Button';
import { ExchangeModal } from '../../components/exchange/ExchangeDialog';
import AnnouncementBody from '../../components/announcements/AnnouncementBody';
import Pagination from '../../components/announcements/Pagination';
import MemberAnnouncementDetail from '../../components/announcements/MemberAnnouncementDetail';
import { useAnnouncementUpdates } from '../../hooks/useAnnouncementUpdates';
export default function NotificationsPage() {
  const [params, setParams] = useSearchParams();
  const announcement = params.get('announcement') || undefined;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [status, setStatus] = useState('All');
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<string | null>(null);
  const announcementOpener = useRef<Element | null>(null);
  const revision = useAnnouncementUpdates();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const requestKey = JSON.stringify([page, limit, status, announcement]);
  const inbox = usePolledApiData(async () => ({ ...await notificationsApi.list({ page, limit, status, announcement }), requestKey }), [page, limit, status, announcement, revision], 30000);
  const data = inbox.error || inbox.data?.requestKey !== requestKey ? null : inbox.data;
  useEffect(() => { setPage(1); if (announcement) setSelectedAnnouncement(announcement); }, [announcement]);
  useEffect(() => { if (data && !inbox.loading && page !== data.pagination.page) setPage(data.pagination.page); }, [data, inbox.loading, page]);
  const act = async (id?: string) => {
    if (lock.current) return;
    if (id) announcementOpener.current = document.activeElement;
    lock.current = true; setBusy(true); setError('');
    try { if (id) { const detail = await notificationsApi.detail(id); if (detail.announcementId) setSelectedAnnouncement(detail.announcementId); else { setSelected(detail); await notificationsApi.read(id); } } else if (inbox.data) await notificationsApi.readAll(inbox.data.asOf); inbox.refresh(); }
    catch (e) { setError(normalizeError(e).message); } finally { lock.current = false; setBusy(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-display text-2xl font-semibold text-forum-900">Notifications</h1><Button variant="outline" disabled={busy || !inbox.data?.unread} onClick={() => void act()}><CheckCheck className="h-4 w-4" />Mark all read</Button></div>
    <div className="flex items-center gap-3"><select aria-label="Notification status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-paper-border bg-paper-raised p-2 text-sm"><option value="All">All notifications</option><option value="UNREAD">Unread</option><option value="READ">Read</option></select><span className="text-xs text-ink-muted">{inbox.data?.unread ?? '-'} unread</span>{announcement && <Button variant="ghost" onClick={() => { setParams({}); setPage(1); }}>All notifications</Button>}</div>
    {(error || inbox.error) && <p role="alert" className="text-sm text-danger-600">{error || inbox.error}<Button variant="outline" onClick={() => { setError(''); inbox.refresh(); }}>Retry</Button></p>}
    {!data && inbox.loading && <p role="status">Loading notifications...</p>}
    <div className="divide-y divide-paper-border">
      {data?.items.map(n => <button key={n.id} disabled={busy} onClick={() => void act(n.id)} className={`flex w-full items-start gap-3 py-4 text-left hover:bg-forum-50 ${n.status === 'UNREAD' ? 'font-semibold' : ''}`}>
        <Bell className={`mt-1 h-5 w-5 shrink-0 ${n.status === 'UNREAD' ? 'text-brass-700' : 'text-ink-subtle'}`} /><div className="min-w-0 flex-1"><p className="break-words text-sm text-forum-900">{n.title}</p><p className="mt-1 line-clamp-2 break-words text-sm font-normal text-ink-muted">{n.body}</p><p className="mt-2 text-xs font-normal text-ink-subtle">{new Date(n.createdAt).toLocaleString()} · {n.status === 'UNREAD' ? 'Unread' : 'Read'}</p></div>
      </button>)}
      {data?.items.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">{announcement ? 'This announcement notification is unavailable.' : 'No notifications to display.'}</p>}
    </div>
    {data && <Pagination meta={data.pagination} page={page} limit={limit} setPage={setPage} setLimit={n => { setLimit(n); setPage(1); }} />}
    {selectedAnnouncement && <MemberAnnouncementDetail key={selectedAnnouncement} id={selectedAnnouncement} returnFocus={announcementOpener.current} close={() => setSelectedAnnouncement(null)} />}
    {selected && <ExchangeModal title={selected.title} close={() => setSelected(null)} busy={busy} wide>
      {error && <p role="alert" className="mb-3 text-sm text-danger-600">{error}<Button variant="outline" onClick={() => void act(selected.id)}>Retry</Button></p>}
      {selected.sender ? <><AnnouncementBody body={selected.body} /><p className="mt-5 text-sm font-medium">{selected.sender}</p></> : <p className="whitespace-pre-wrap break-words text-sm">{selected.body}</p>}
      {selected.link?.startsWith('/dashboard/') && !selected.link.startsWith('/dashboard/notifications') && <Link to={selected.link} className="mt-4 inline-block text-sm font-semibold text-forum-700 underline">Open {selected.type.toLowerCase()}</Link>}
    </ExchangeModal>}
  </div>;
}
