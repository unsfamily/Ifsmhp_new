import {
  Calendar,
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
  BookOpenCheck,
  Star,
  CalendarDays,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

interface Event {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: 'Symposium' | 'Webinar' | 'Workshop' | 'Conference';
  category: string;
  description: string;
  speakers: string[];
  seats?: number;
  past?: boolean;
  takeaways?: string[];
  feedback?: number;
}

const upcomingEvents: Event[] = [
  {
    id: 'u1',
    title: 'Symposium on Digital Mental Health Tools: Evidence & Ethics',
    date: '2026-09-12',
    time: '14:00 - 18:00 UTC',
    location: 'Virtual + Hybrid (London Hub)',
    type: 'Symposium',
    category: 'New products in mental health',
    description:
      'A rigorous examination of emerging digital mental health platforms, apps, and AI-driven tools, with presentations from developers, clinicians, and ethicists. Panel discussions will address validation standards, data privacy, and clinical integration pathways.',
    speakers: ['Dr. Sarah Chen', 'Prof. Naomi Hargrove', 'Dr. Amara Patel', 'CRO Keynote'],
    seats: 450,
  },
  {
    id: 'u2',
    title: 'Service Innovations in Crisis Mental Health Support',
    date: '2026-10-03',
    time: '09:00 - 16:00 UTC',
    location: 'Berlin, Germany (Hybrid)',
    type: 'Workshop',
    category: 'Service innovations',
    description:
      'Hands-on workshop exploring emerging models for crisis intervention, including text-based counseling, community first-responder programs, and stepped-care models. Attendees will participate in case-study exercises and protocol design sessions.',
    speakers: ['Dr. James Okafor', 'Dr. Liam Sutherland', 'Berlin Psychiatric Association'],
    seats: 120,
  },
  {
    id: 'u3',
    title: 'Annual Research Findings Showcase',
    date: '2026-10-27',
    time: '10:00 - 19:00 UTC',
    location: 'Virtual Conference Platform',
    type: 'Conference',
    category: 'Research findings',
    description:
      'The flagship annual event where IFSMHP members present recently completed research. Includes lightning talks, poster sessions, and keynote presentation from the CRO. Best presentation awards to be announced.',
    speakers: ['All IFSMHP Members', 'CRO Office', 'Guest Keynote'],
    seats: 1000,
  },
  {
    id: 'u4',
    title: 'Webinar: International Mental Health Policy 2027 Outlook',
    date: '2026-11-15',
    time: '15:00 - 17:00 UTC',
    location: 'Online Webinar',
    type: 'Webinar',
    category: 'International policy discussions',
    description:
      'A panel of policy advisors and WHO representatives discuss upcoming mental health policy shifts across major regions, including EU mental health framework, US parity updates, and ASEAN mental health strategy.',
    speakers: ['Policy Advisory Panel', 'WHO Liaison', 'Regional Representatives'],
  },
];

const pastEvents: Event[] = [
  {
    id: 'p1',
    title: 'Symposium: Psychedelic-Assisted Therapy — Current Evidence Landscape',
    date: '2026-06-20',
    time: '13:00 - 17:30 UTC',
    location: 'Amsterdam, Netherlands',
    type: 'Symposium',
    category: 'Therapeutic services',
    description:
      'Multi-disciplinary symposium on psilocybin, MDMA, and DMT-assisted psychotherapy protocols, with sessions on clinical trial design, therapist training standards, and regulatory pathways.',
    speakers: ['Prof. Marcus Whitfield', 'Amsterdam UMC', 'Clinical Trial Consortium'],
    past: true,
    takeaways: [
      'Phase III trial outcome benchmarks released',
      'Therapist accreditation framework drafted',
      'Regulator roadmap published for 2027',
    ],
    feedback: 4.8,
  },
  {
    id: 'p2',
    title: 'Workshop: Publishing High-Impact Mental Health Research',
    date: '2026-05-08',
    time: '10:00 - 15:00 UTC',
    location: 'Online',
    type: 'Workshop',
    category: 'Research methodologies',
    description:
      'Interactive workshop covering methodology rigor, statistical transparency, open science practices, and navigating peer review — delivered by senior journal editors.',
    speakers: ['Journal Editors Panel', 'Senior Research Methodologists'],
    past: true,
    takeaways: [
      'Checklist for statistical transparency distributed',
      'Peer review response templates available',
      'Open science endorsement program announced',
    ],
    feedback: 4.6,
  },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.toLocaleDateString('en-US', { day: '2-digit' }),
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    year: d.toLocaleDateString('en-US', { year: 'numeric' }),
    full: d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  };
}

const typeBadge: Record<Event['type'], 'default' | 'success' | 'warning' | 'info'> = {
  Symposium: 'default',
  Webinar: 'info',
  Workshop: 'success',
  Conference: 'warning',
};

const days = Array.from({ length: 30 }, (_, i) => i + 1);

export default function EventsPage() {
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
            <div className="mt-6 space-y-6">
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
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={typeBadge[e.type]}>{e.type}</Badge>
                        <Badge variant="brass">{e.category}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-forum-900 leading-snug group-hover:text-forum-700">
                        {e.title}
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
                        {e.seats && (
                          <span className="inline-flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {e.seats.toLocaleString()} seats
                          </span>
                        )}
                      </div>
                      <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-xs text-ink-subtle">
                          Featuring:{' '}
                          <span className="text-ink-muted font-medium">{e.speakers.join(', ')}</span>
                        </div>
                        <Button size="sm">
                          <Calendar className="h-4 w-4" />
                          Register
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className="lg:col-span-1 order-1 lg:order-2">
            <div className="rounded-xl border border-paper-border bg-paper-raised p-5 shadow-sm sticky top-20">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-forum-900">
                  September 2026
                </h3>
                <div className="flex gap-1">
                  <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-forum-50 text-ink-muted">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-forum-50 text-ink-muted">
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
                {Array.from({ length: 1 }, () => (
                  <div key="empty1" />
                ))}
                {days.map((d) => (
                  <button
                    key={d}
                    className={`h-8 w-full rounded-md text-sm transition-colors ${
                      d === 12
                        ? 'bg-forum-600 text-white font-medium'
                        : [3, 27].includes(d)
                        ? 'bg-brass-100 text-brass-700 font-medium hover:bg-brass-500 hover:text-white'
                        : 'hover:bg-forum-50 text-ink-muted'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
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
                  <div className="flex-1 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={typeBadge[e.type]}>{e.type}</Badge>
                      <Badge variant="brass">{e.category}</Badge>
                    </div>
                    <h3 className="mt-2 font-semibold text-forum-900 leading-snug">
                      {e.title}
                    </h3>
                    <p className="mt-1 text-xs text-ink-subtle">{d.full} · {e.location}</p>
                  </div>
                </div>
                <div className="p-5">
                  {typeof e.feedback === 'number' && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-4 w-4 ${
                              i < Math.floor(e.feedback as number)
                                ? 'fill-brass-500 text-brass-500'
                                : 'text-paper-border'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-medium text-ink-muted">{e.feedback} participant rating</span>
                    </div>
                  )}
                  {e.takeaways && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                        Key Takeaways
                      </h4>
                      <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                        {e.takeaways.map((t) => (
                          <li key={t} className="flex gap-2">
                            <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-slateteal-500" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline">
                      <PlayCircle className="h-4 w-4" />
                      Recordings
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileText className="h-4 w-4" />
                      Proceedings
                    </Button>
                    <Button size="sm" variant="outline">
                      <MessageSquare className="h-4 w-4" />
                      Feedback
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
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
    </>
  );
}
