import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { memberAnnouncementsApi } from '../../api/memberAnnouncements';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAnnouncementUpdates } from '../../hooks/useAnnouncementUpdates';
import Button from '../common/Button';
import Badge from '../common/Badge';
import Pagination from './Pagination';
import MemberAnnouncementDetail from './MemberAnnouncementDetail';

export default function MemberAnnouncementList() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const revision = useAnnouncementUpdates();
  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const requestKey = JSON.stringify([q, status, page, limit]);
  const list = usePolledApiData(async () => ({ ...await memberAnnouncementsApi.list({ q, status, page, limit }), requestKey }), [q, status, page, limit, revision], 30000);
  const data = list.error || list.data?.requestKey !== requestKey ? null : list.data;
  useEffect(() => { if (data && !list.loading && page !== data.pagination.page) setPage(data.pagination.page); }, [data, list.loading, page]);
  return <>
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <label className="flex min-w-0 flex-1 basis-full items-center gap-2 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm sm:basis-0"><Search className="h-4 w-4 shrink-0 text-ink-muted" /><input aria-label="Search announcements" placeholder="Search announcements" value={search} maxLength={220} onChange={e => setSearch(e.target.value)} className="min-w-0 w-full bg-transparent outline-none" /></label>
      <select aria-label="Announcement status" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="rounded-md border border-paper-border bg-paper p-2 text-sm"><option value="All">All announcements</option><option value="UNREAD">Unread</option><option value="READ">Read</option></select>
      <span className="text-xs text-ink-muted">{data?.unread ?? '-'} unread</span>
    </div>
    {!data && list.loading && <p role="status" className="py-8 text-center text-sm">Loading announcements...</p>}
    {list.error && <p role="alert" className="py-4 text-sm text-danger-600">{list.error}<Button variant="outline" onClick={list.refresh}>Retry</Button></p>}
    <div className="divide-y divide-paper-border" aria-busy={list.loading}>
      {data?.items.map(row => <button key={row.id} onClick={() => setSelected(row.id)} className="block w-full px-3 py-4 text-left hover:bg-forum-50/30">
        <div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-semibold text-forum-900">{row.subject}</h3><Badge>{row.status === 'UNREAD' ? 'Unread' : 'Read'}</Badge></div>
        <p className="my-2 text-xs text-ink-muted">{row.sender}{row.sentAt && ` / ${new Date(row.sentAt).toLocaleString()}`}</p>
        <p className="line-clamp-2 break-words text-sm text-ink">{row.body}</p>
      </button>)}
    </div>
    {!list.loading && data?.items.length === 0 && <p className="py-8 text-center text-sm text-ink-muted">No announcements to display.</p>}
    {data && <Pagination meta={data.pagination} page={page} limit={limit} setPage={setPage} setLimit={value => { setLimit(value); setPage(1); }} />}
    {selected && <MemberAnnouncementDetail key={selected} id={selected} close={() => setSelected(null)} />}
  </>;
}
