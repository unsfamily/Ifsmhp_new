import { useState } from 'react';
import {
  MapPin,
  Clock,
  Users,
  Video,
  FileText,
  PlayCircle,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Building2,
  CalendarDays,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

import { publicApi } from '../../api/public';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { EventListState, EventPagination, EventRegistration, formatEventDate as formatDate, resourceKinds } from '../../components/events/PublicEventControls';
import PublicEventDetails from '../../components/events/PublicEventDetails';

const typeBadge: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
  Symposium: 'default', Webinar: 'info', Workshop: 'success', Conference: 'warning',
};

export default function EventsPage() {
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState<string>();
  const [selected, setSelected] = useState<{ id: string; section?: 'recordings' | 'proceedings' } | null>(null);
  const [monthDate, setMonthDate] = useState(() => { const today = new Date(); return new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)); });
  const month = monthDate.toISOString().slice(0, 7);
  const upcoming = usePolledApiData(() => publicApi.events({ tab: 'upcoming', date: selectedDate, page: upcomingPage, limit: 4 }), [selectedDate, upcomingPage], 30000);
  const past = usePolledApiData(() => publicApi.events({ tab: 'past', date: selectedDate, page: pastPage, limit: 2 }), [selectedDate, pastPage], 30000);
  const calendar = usePolledApiData(() => publicApi.eventCalendar(month), [month], 30000);
  const upcomingEvents = upcoming.error ? [] : upcoming.data?.items ?? [];
  const pastEvents = past.error ? [] : past.data?.items ?? [];
  const markers = new Map(calendar.data?.month === month && !calendar.error ? calendar.data.days.map(day => [day.date, day]) : []);
  const days = Array.from({ length: new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate() }, (_, i) => i + 1);
  const filterDate = (date?: string) => { setSelectedDate(date); setUpcomingPage(1); setPastPage(1); };
  const moveMonth = (offset: number) => { const date = new Date(monthDate); date.setUTCMonth(date.getUTCMonth() + offset); setMonthDate(date); filterDate(); };

  return (
    <>
      <section className="bg-gradient-to-br from-forum-600 via-slateteal-700 to-forum-700">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <CalendarDays className="h-3.5 w-3.5" />
              Symposia & Events
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Learn, share, and connect
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
              Join IFSMHP members worldwide for symposia, workshops, webinars, and
              conferences on products, services, research findings, and policies
              shaping mental health and science.
            </p>
          </div>
        </div>
      </section>

      <Section bg="paper">
        <div className="grid gap-10 lg:grid-cols-3 lg:gap-12">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <h2 className="font-display text-2xl font-semibold text-forum-900">
              Upcoming Events
            </h2>
            {selectedDate && <Button variant="ghost" size="sm" className="mt-2" onClick={() => filterDate()}>{formatDate(selectedDate).full} · Clear date filter</Button>}
            <div className="mt-6 space-y-6">
              <EventListState loading={upcoming.initialLoading} error={upcoming.error} empty={!upcomingEvents.length} retry={upcoming.refresh} label="upcoming events" />
              {upcomingEvents.map((e) => {
                const d = formatDate(e.date);
                return (
                  <article
                    key={e.id}
                    className="group rounded-xl border border-paper-border bg-paper-raised shadow-sm hover:shadow-md transition-all overflow-hidden sm:flex"
                  >
                    <div className="sm:w-28 shrink-0 bg-gradient-to-br from-forum-600 to-forum-900 p-5 text-white text-center flex sm:flex-col justify-center sm:justify-start items-center sm:items-stretch gap-3">
                      <div>
                        <span className="font-display text-3xl font-semibold block leading-none">{d.day}</span>
                        <span className="text-xs uppercase tracking-wider mt-1 block text-forum-100/70">{d.month}</span>
                      </div>
                      <span className="text-[11px] text-forum-100/50">{d.year}</span>
                    </div>
                    <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={typeBadge[e.type] ?? 'default'}>{e.type}</Badge>
                        <Badge variant="brass">{e.category}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-forum-900 leading-snug group-hover:text-forum-700">
                        <button onClick={() => setSelected({ id: e.id })} className="text-left hover:underline focus-visible:underline">{e.title}</button>
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-ink-muted line-clamp-3">
                        {e.description}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-subtle">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {e.time}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" />
                          {e.location}
                        </span>
                        {(
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {e.seats === null ? 'Unlimited capacity' : `${e.seats.toLocaleString()} seats`}
                          </span>
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                        {e.speakers.length > 0 && <div className="text-xs text-ink-subtle">
                          Featuring:{' '}
                          <span className="text-ink-muted font-medium">{e.speakers.join(', ')}</span>
                        </div>}
                        <EventRegistration event={e} />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!upcoming.error && upcoming.data && <EventPagination pagination={upcoming.data.pagination} label="upcoming events" setPage={setUpcomingPage} />}
          </div>

          <aside className="lg:col-span-1 order-1 lg:order-2 lg:sticky lg:top-20 self-start">
            <div className="rounded-xl border border-paper-border bg-paper-raised p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-forum-900">
                  {monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
                </h3>
                <div className="flex gap-1">
                  <button title="Previous month" aria-label="Previous month" onClick={() => moveMonth(-1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-forum-50 text-ink-muted">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button title="Next month" aria-label="Next month" onClick={() => moveMonth(1)} className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-forum-50 text-ink-muted">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <div key={i} className="py-1 font-semibold text-ink-subtle">
                    {day}
                  </div>
                ))}
                {Array.from({ length: monthDate.getUTCDay() }, (_, index) => <div key={`empty-${index}`} />)}
                {days.map((d) => {
                  const date = `${month}-${String(d).padStart(2, '0')}`;
                  const marker = markers.get(date);
                  return <button
                    key={d}
                    aria-label={`${formatDate(date).full}, ${marker?.count ?? 0} events`}
                    aria-pressed={selectedDate === date}
                    title={`${marker?.count ?? 0} events`}
                    onClick={() => filterDate(selectedDate === date ? undefined : date)}
                    className={`h-8 w-full rounded-md text-sm transition-colors ${
                      marker?.major
                        ? 'bg-forum-600 text-white font-medium'
                        : marker
                        ? 'bg-brass-100 text-brass-700 font-medium hover:bg-brass-500 hover:text-white'
                        : 'hover:bg-forum-50 text-ink-muted'
                    } ${selectedDate === date ? 'ring-2 ring-forum-700 ring-offset-1' : ''}`}
                  >
                    {d}
                  </button>;
                })}
              </div>
              <EventListState loading={calendar.initialLoading} error={calendar.error} empty={false} retry={calendar.refresh} label="calendar" />
              <div className="mt-5 space-y-2 pt-5 border-t border-paper-border">
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="h-3 w-3 rounded bg-forum-600" />
                  <span className="text-ink-muted">Symposium / Major Event</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs">
                  <span className="h-3 w-3 rounded bg-brass-500" />
                  <span className="text-ink-muted">Other IFSMHP Events</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-brass-500/30 bg-brass-100/40 p-5">
              <h4 className="font-semibold text-forum-900 flex items-center gap-2">
                <MessageSquare className="h-4.5 w-4.5 text-brass-700" />
                Suggest an Event
              </h4>
              <p className="mt-2 text-sm text-ink-muted">
                Members can propose symposia, workshops, or webinars. Submit your
                event idea through the dashboard for CRO review.
              </p>
              <Button as="link" to="/dashboard" size="sm" variant="outline" className="mt-4 w-full justify-center">
                Submit Proposal
              </Button>
            </div>
          </aside>
        </div>
      </Section>

      <Section bg="forum">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            Archive
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Past Symposia & Events
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Access recordings, proceedings, and key takeaways from our previous
            gatherings.
          </p>
        </div>

        {selectedDate && <div className="mt-4 text-center"><Button variant="ghost" size="sm" onClick={() => filterDate()}>{formatDate(selectedDate).full} · Clear date filter</Button></div>}
        <div className="mt-6"><EventListState loading={past.initialLoading} error={past.error} empty={!pastEvents.length} retry={past.refresh} label="past events" /></div>
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {pastEvents.map((e) => {
            const d = formatDate(e.date);
            return (
              <article
                key={e.id}
                className="rounded-xl border border-paper-border bg-paper-raised shadow-sm overflow-hidden"
              >
                <div className="flex border-b border-paper-border">
                  <div className="w-24 shrink-0 bg-forum-50 p-4 text-center">
                    <span className="font-display text-2xl font-semibold block text-forum-900 leading-none">
                      {d.day}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider mt-1 block text-forum-700">
                      {d.month}
                    </span>
                    <span className="text-[10px] text-forum-400">{d.year}</span>
                  </div>
                  <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeBadge[e.type] ?? 'default'}>{e.type}</Badge>
                      <Badge variant="brass">{e.category}</Badge>
                    </div>
                    <h3 className="mt-2 font-semibold text-forum-900 leading-snug">
                      <button onClick={() => setSelected({ id: e.id })} className="text-left hover:underline focus-visible:underline">{e.title}</button>
                    </h3>
                    <p className="mt-1 text-xs text-ink-subtle">{d.full} · {e.location}</p>
                  </div>
                </div>
                <div className="p-5">
                  <p className="text-sm leading-relaxed text-ink-muted break-words [overflow-wrap:anywhere]">{e.description}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={!e.resources.some(r => r.url && resourceKinds.recordings.includes(r.kind))} title={e.resources.some(r => r.url && resourceKinds.recordings.includes(r.kind)) ? 'View recordings' : 'No public recordings available'} onClick={() => setSelected({ id: e.id, section: 'recordings' })}>
                      <PlayCircle className="h-4 w-4" />
                      Recordings
                    </Button>
                    <Button size="sm" variant="outline" disabled={!e.resources.some(r => r.url && resourceKinds.proceedings.includes(r.kind))} title={e.resources.some(r => r.url && resourceKinds.proceedings.includes(r.kind)) ? 'View proceedings' : 'No public proceedings available'} onClick={() => setSelected({ id: e.id, section: 'proceedings' })}>
                      <FileText className="h-4 w-4" />
                      Proceedings
                    </Button>
                    <Button size="sm" variant="outline" disabled title="Event feedback is not available">
                      <MessageSquare className="h-4 w-4" />
                      Feedback
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!past.error && past.data && <EventPagination pagination={past.data.pagination} label="past events" setPage={setPastPage} />}
      </Section>

      <Section bg="paper">
        <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 to-paper-raised p-8 sm:p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forum-600 text-white">
            <Video className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Platform for your voice
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-ink-muted">
            IFSMHP events are where members present research, share scientific
            opinions, and discuss products, services, and policies that matter to
            our global community.
          </p>
          <div className="mt-8 flex justify-center flex-wrap gap-3">
            <Button as="link" to="/register" size="lg">
              Join as Member
            </Button>
            <Button as="link" to="/contact" size="lg" variant="outline">
              <Building2 className="h-4.5 w-4.5" />
              Partner With Us
            </Button>
          </div>
        </div>
      </Section>
      {selected && <PublicEventDetails key={selected.id} id={selected.id} section={selected.section} close={() => setSelected(null)} />}
    </>
  );
}
