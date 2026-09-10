import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  Search,
  Eye,
  Clock,
  Edit2,
  Trash2,
  Plus,
  MapPin,
  Users,
  Globe2,
  FileText,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextInput } from '../../components/common/Input';

import { useLocation, useSearchParams } from 'react-router-dom';
import { eventApi, type EventTab, type EventRecord } from '../../api/events';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';

type Tab = EventTab;
const labels = { PUBLISHED: 'Published', DRAFT: 'Draft', PAST: 'Past', CANCELLED: 'Cancelled' } as const;
type Event = Omit<EventRecord, 'status'> & { status: typeof labels[keyof typeof labels]; time: string };

const statusBadge: Record<Event['status'], 'success' | 'default' | 'warning' | 'info' | 'danger'> = {
  Published: 'success',
  Draft: 'warning',
  Past: 'default',
  Cancelled: 'danger',
};

const formatBadge: Record<Event['format'], 'info' | 'brass' | 'default'> = {
  Virtual: 'info',
  Hybrid: 'brass',
  'In-Person': 'default',
};

export default function AdminEventsPage() {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: Tab = rawTab === 'past' || rawTab === 'drafts' ? rawTab : 'upcoming';
  const setTab = (value: Tab) => { setPage(1); setParams({ tab: value }); };
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState('');
  const actionLock = useRef(false);
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState(location.state?.message ?? '');
  const [deleting, setDeleting] = useState<Event | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const { data, loading, error } = useApiData(() => eventApi.list({ tab, q: query, page, limit }), [tab, query, page, limit, reload]);
  const filtered: Event[] = (data?.items ?? []).map(e => ({ ...e, status: labels[e.displayStatus], time: [e.timeStart && `${e.timeStart} - ${e.timeEnd}`, e.timezone].filter(Boolean).join(' ') }));
  const counts = data?.counts;
  const pages = data?.pagination.pages ?? 1;
  const currentPage = data?.pagination.page ?? 1;
  const action = async (e: Event, kind: 'publish' | 'delete') => {
    if (actionLock.current) return;
    actionLock.current = true; setBusyId(e.id); setActionError(''); setMessage('');
    try {
      if (kind === 'publish') await eventApi.publish(e.id); else await eventApi.remove(e.id);
      setMessage(kind === 'publish' ? 'Event published.' : 'Event deleted.'); setDeleting(null); setPage(currentPage); setReload(v => v + 1);
    } catch (failure) {
      const detail = normalizeError(failure);
      setActionError([detail.message, ...Object.values(detail.fieldErrors)].join(' '));
    } finally { actionLock.current = false; setBusyId(''); }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Upcoming Events', value: counts?.upcoming, icon: Calendar, color: 'forum', note: data?.next?.date ? `Next: ${new Date(data.next.date).toLocaleDateString(undefined, { timeZone: 'UTC' })}` : 'No upcoming events' },
          { label: 'Total RSVPs', value: counts?.rsvps, icon: Users, color: 'brass', note: 'Registered attendees' },
          { label: 'Drafts', value: counts?.drafts, icon: FileText, color: 'slateteal', note: 'Includes scheduled events' },
          { label: 'Past & Cancelled', value: counts?.past, icon: CalendarClock, color: 'forum', note: `${counts?.resources ?? 0} archived resources` },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{loading ? '...' : error ? '-' : k.value ?? 0}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {message && <p role="status" className="rounded-lg border border-success-600/20 bg-success-50 p-3 text-sm text-success-800">{message}</p>}
      {actionError && <p role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 p-3 text-sm text-danger-800">{actionError}</p>}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-forum-50 p-1 overflow-x-auto">
              {(['upcoming', 'past', 'drafts'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors whitespace-nowrap ${tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'}`}>
                  {t === 'past' ? 'Past & Cancelled' : t} ({counts?.[t] ?? 0})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <Button variant="primary" as="link" to="/admin/events/new">
                <Plus className="h-4 w-4" />
                Create Event
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-border text-left">
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Event</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Date &amp; Time</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Format / Audience</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Attendees</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!loading && !error && filtered.map((e) => (
                  <tr key={e.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 align-top">
                    <td className="py-4 px-2">
                      <div className="flex items-start gap-3">
                        <div className="h-12 w-12 shrink-0 rounded-lg bg-gradient-to-br from-forum-600 via-slateteal-500 to-brass-500 text-white flex items-center justify-center">
                          <CalendarClock className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-forum-900 leading-snug">{e.title}</p>
                          <p className="text-xs text-ink-subtle mt-1 line-clamp-1">By {e.organizer}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {e.tags.map((t) => (
                              <span key={t} className="text-[10px] font-semibold uppercase tracking-wider rounded-full bg-forum-50 text-forum-700 px-2 py-0.5">{t}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden sm:table-cell">
                      <div>
                        <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-forum-600" />
                          {e.date ? new Date(e.date + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not set'}
                        </p>
                        <p className="text-xs text-ink-muted mt-1 inline-flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {e.time}
                        </p>
                        <p className="text-xs text-ink-subtle mt-1 inline-flex items-center gap-1.5 line-clamp-1">
                          <MapPin className="h-3 w-3" />
                          {e.location}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <Badge variant={formatBadge[e.format]} className="w-fit">
                          {e.format === 'Virtual' ? <Globe2 className="h-3 w-3 mr-1" /> : e.format === 'In-Person' ? <MapPin className="h-3 w-3 mr-1" /> : <Globe2 className="h-3 w-3 mr-1" />}
                          {e.format}
                        </Badge>
                        <Badge variant={e.audience === 'Public' ? 'brass' : e.audience === 'CRO Invite' ? 'warning' : 'info'} className="w-fit">{e.audience}</Badge>
                      </div>
                    </td>
                    <td className="py-4 px-2 hidden lg:table-cell">
                      <div>
                        <p className="text-sm font-semibold text-ink">{e.attendees.toString()}{e.capacity !== null && <span className="text-ink-subtle text-xs font-normal"> / {e.capacity}</span>}</p>
                        {e.capacity !== null && (
                          <div className="mt-2 h-1.5 w-full bg-paper-border rounded-full overflow-hidden">
                            <div
                              className={`h-full ${e.attendees / (e.capacity || 1) >= 0.9 ? 'bg-danger-600' : e.attendees / (e.capacity || 1) >= 0.6 ? 'bg-warning-600' : 'bg-forum-600'}`}
                              style={{ width: `${Math.min(100, (e.attendees / (e.capacity || 1)) * 100)}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-2">
                      <Badge variant={statusBadge[e.status]} className="w-fit">{e.status}</Badge>
                    </td>
                    <td className="py-4 px-2 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <Button as="link" to={`/admin/events/${e.id}`} variant="outline" size="sm" className="!px-2.5 !py-1 !text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button as="link" to={`/admin/events/${e.id}/edit`} variant="outline" size="sm" className="!px-2.5 !py-1 !text-xs">
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {e.status === 'Draft' && (
                          <Button disabled={Boolean(busyId)} onClick={() => { void action(e, 'publish'); }} size="sm" variant="primary" className="!px-2.5 !py-1 !text-xs">
                            <Globe2 className="h-3.5 w-3.5" />
                            Publish
                          </Button>
                        )}
                        <button disabled={Boolean(busyId)} onClick={() => setDeleting(e)} className="inline-flex items-center gap-1 rounded-md border border-danger-600/20 px-2.5 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-100 transition-colors" aria-label="Delete event">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {loading && <tr><td colSpan={6} role="status" className="py-12 text-center">Loading events...</td></tr>}
                {!loading && error && <tr><td colSpan={6} className="py-12 text-center"><p role="alert">{error}</p><Button className="mt-3" variant="outline" onClick={() => setReload(v => v + 1)}>Retry</Button></td></tr>}
                {!loading && !error && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-subtle text-sm">
                      No events in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper-border pt-4 text-sm">
            <label className="flex items-center gap-2 text-ink-muted">Rows <select aria-label="Events per page" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="rounded-md border border-paper-border bg-paper-raised px-2 py-1">{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label>
            <span>{data?.pagination.total ?? 0} events · Page {currentPage} of {pages}</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={loading || currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={loading || currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>
      {deleting && <div role="dialog" aria-modal="true" aria-labelledby="delete-event-title" className="fixed inset-0 z-50 flex items-center justify-center bg-forum-900/40 p-4"><div className="w-full max-w-md rounded-lg border border-paper-border bg-paper-raised p-5 space-y-4"><h2 id="delete-event-title" className="font-display text-lg font-semibold">Delete event?</h2><p className="text-sm text-ink-muted">{deleting.title} will be removed from event listings. Pending reminders will stop.</p>{actionError && <p role="alert" className="text-sm text-danger-600">{actionError}</p>}<div className="flex justify-end gap-2"><Button disabled={Boolean(busyId)} variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button disabled={Boolean(busyId)} onClick={() => { void action(deleting, 'delete'); }}><Trash2 className="h-4 w-4" />{busyId ? 'Deleting...' : 'Delete'}</Button></div></div></div>}
    </div>
  );
}
