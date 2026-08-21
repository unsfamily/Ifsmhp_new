import { useState } from 'react';
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
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextInput } from '../../components/common/Input';

type Tab = 'upcoming' | 'past' | 'drafts';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  format: 'In-Person' | 'Hybrid' | 'Virtual';
  audience: 'All Members' | 'CRO Invite' | 'Public';
  status: 'Published' | 'Draft' | 'Past' | 'Cancelled';
  attendees: number;
  capacity: number | null;
  organizer: string;
  description: string;
  tags: string[];
}

const events: Event[] = [
  { id: 'ev-2026-09', title: 'IFSMHP 2026 Annual Scientific Symposium', date: '2026-09-18', time: '09:00 – 17:30 CET', location: 'Stockholm, Sweden · Karolinska Congress Hall + Virtual', format: 'Hybrid', audience: 'All Members', status: 'Published', attendees: 142, capacity: 250, organizer: 'CRO Office', description: 'Keynotes on biomarkers, digital therapeutics and the global mental health workforce crisis. Plenaries, working groups and poster hall. SAB meeting the day before.', tags: ['Symposium', 'SAB', 'Networking'] },
  { id: 'ev-2026-09-08', title: 'Workshop: Writing Project Proposals for CRO Funding', date: '2026-09-08', time: '14:00 – 16:30 UTC', location: 'Zoom — RSVP', format: 'Virtual', audience: 'All Members', status: 'Published', attendees: 78, capacity: 200, organizer: 'Grants Office', description: 'A 2.5-hour guided workshop covering project scope, budget justification and common reviewer pitfalls. Participants leave with a structured outline and an SAB Q&A.', tags: ['Grants', 'Workshop'] },
  { id: 'ev-2026-10-12', title: 'Moral Support Program: Monthly Members Peer Group', date: '2026-10-12', time: '19:00 – 20:30 UTC', location: 'Private Video Room', format: 'Virtual', audience: 'CRO Invite', status: 'Draft', attendees: 14, capacity: 24, organizer: 'Wellness Committee', description: 'Chatham House Rules, 90-minute facilitated peer discussion. Not recorded. Topics pre-circulated via membership email.', tags: ['Moral Support', 'Wellness'] },
  { id: 'ev-2026-11-04', title: 'Public Lecture — Digital Mental Health: Evidence Base 2026', date: '2026-11-04', time: '18:00 – 19:30 UTC', location: 'YouTube Live', format: 'Virtual', audience: 'Public', status: 'Published', attendees: 512, capacity: null, organizer: 'CRO Office', description: 'Joint keynote by a CRO and an external reviewer. Slides and Q&A transcript published the next day. Open registration.', tags: ['Public', 'Lecture'] },
  { id: 'ev-2026-07-22', title: 'Research Town Hall: Mid-Year Publication Trends', date: '2026-07-22', time: '15:00 UTC', location: 'Zoom', format: 'Virtual', audience: 'All Members', status: 'Past', attendees: 198, capacity: 500, organizer: 'CRO Office', description: '50-minute metrics walkthrough + 40-minute Q&A on publications, review times and the next CRO roadmap.', tags: ['Town Hall', 'Publications'] },
  { id: 'ev-2026-06-10', title: 'Scientists in Residence: Meet & Greet (UK Chapter)', date: '2026-06-10', time: '18:00 – 21:00 BST', location: 'London, UK · The Royal Society Venue Hire', format: 'In-Person', audience: 'CRO Invite', status: 'Past', attendees: 47, capacity: 70, organizer: 'UK Chapter', description: 'Informal reception for UK-based members and invited guests.', tags: ['Chapter', 'Networking'] },
];

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
  const [tab, setTab] = useState<Tab>('upcoming');
  const [search, setSearch] = useState('');

  const now = new Date('2026-08-21T00:00:00Z');
  const tabData = tab === 'upcoming'
    ? events.filter((e) => new Date(e.date + 'T23:59:59Z') >= now && e.status !== 'Cancelled')
    : tab === 'past'
    ? events.filter((e) => new Date(e.date + 'T23:59:59Z') < now || e.status === 'Past')
    : events.filter((e) => e.status === 'Draft');

  const filtered = tabData.filter((e) => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Upcoming Events', value: events.filter((e) => new Date(e.date + 'T23:59:59Z') >= now && e.status !== 'Cancelled').length.toString(), icon: Calendar, color: 'forum', note: 'next: September 08' },
          { label: 'Total RSVPs', value: events.reduce((a, b) => a + (b.attendees), 0).toString(), icon: Users, color: 'brass', note: '+ 512 public viewers' },
          { label: 'Drafts', value: events.filter((e) => e.status === 'Draft').length.toString(), icon: FileText, color: 'slateteal', note: 'Ready to publish' },
          { label: 'Past Events', value: events.filter((e) => e.status === 'Past' || new Date(e.date + 'T23:59:59Z') < now).length.toString(), icon: CalendarClock, color: 'forum', note: '6 recordings archived' },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 rounded-lg bg-forum-50 p-1 overflow-x-auto">
              {(['upcoming', 'past', 'drafts'] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-md px-4 py-2 text-sm font-medium capitalize transition-colors whitespace-nowrap ${tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'}`}>
                  {t} ({tab === 'drafts' ? events.filter((e) => e.status === 'Draft').length : tabData.length})
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
                {filtered.map((e) => (
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
                          {new Date(e.date + 'T00:00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
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
                        <p className="text-sm font-semibold text-ink">{e.attendees.toString()}{e.capacity && <span className="text-ink-subtle text-xs font-normal"> / {e.capacity}</span>}</p>
                        {e.capacity && (
                          <div className="mt-2 h-1.5 w-full bg-paper-border rounded-full overflow-hidden">
                            <div
                              className={`h-full ${e.attendees / e.capacity >= 0.9 ? 'bg-danger-600' : e.attendees / e.capacity >= 0.6 ? 'bg-warning-600' : 'bg-forum-600'}`}
                              style={{ width: `${Math.min(100, (e.attendees / e.capacity) * 100)}%` }}
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
                        <Button as="link" to={`/admin/events/${e.id}/edit`} variant="outline" size="sm" className="!px-2.5 !py-1 !text-xs">
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button as="link" to={`/admin/events/${e.id}/edit`} variant="outline" size="sm" className="!px-2.5 !py-1 !text-xs">
                          <Edit2 className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        {e.status === 'Draft' && (
                          <Button size="sm" variant="primary" className="!px-2.5 !py-1 !text-xs">
                            <Globe2 className="h-3.5 w-3.5" />
                            Publish
                          </Button>
                        )}
                        <button className="inline-flex items-center gap-1 rounded-md border border-danger-600/20 px-2.5 py-1 text-xs font-semibold text-danger-600 hover:bg-danger-100 transition-colors" aria-label="Delete event">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-ink-subtle text-sm">
                      No events in this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
