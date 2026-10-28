import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Info,
  MapPin,
  Presentation,
  QrCode,
  UserRound,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../../components/common/Button';
import CeremonyRegistrationDialog from '../../components/awards/CeremonyRegistrationDialog';
import CeremonyRegistrationQr from '../../components/awards/CeremonyRegistrationQr';
import PreviousAwardPhotos from '../../components/awards/PreviousAwardPhotos';
import { CEREMONY_ADDRESS, CEREMONY_EVENT_DATE, CEREMONY_VENUE, ceremonyProgramme } from '../../domain/ceremonyProgramme';
import { CEREMONY_INFORMATION_PATH, CEREMONY_INTEREST_NOTICE, CEREMONY_NOMINATE_PATH } from '../../domain/ceremonyRegistration';

const SECTION_INNER = 'mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24';
const CONTENT_GAP = 'mt-10 lg:mt-12';
const MAIN_CTA_ID = 'ceremony-register-cta';

type Participation = {
  icon: typeof Users;
  title: string;
  text: string;
  action: { kind: 'register'; id: string } | { kind: 'link'; to: string; label: string };
};

const participation: Participation[] = [
  {
    icon: Users,
    title: 'Delegate',
    text: 'Tell us you would like to attend as a delegate. This records interest only and does not reserve a place.',
    action: { kind: 'register', id: 'ceremony-register-delegate' },
  },
  {
    icon: Presentation,
    title: 'Student poster',
    text: 'Tell us you are interested in presenting a student poster. Submission requirements will be communicated separately.',
    action: { kind: 'register', id: 'ceremony-register-poster' },
  },
  {
    icon: Award,
    title: 'Award nomination',
    text: 'Use the official nomination form to nominate someone. Registering interest on this page does not submit a nomination.',
    action: { kind: 'link', to: CEREMONY_NOMINATE_PATH, label: 'Open the nomination form' },
  },
];

const awardCount = ceremonyProgramme.groups.reduce((total, group) => total + group.awards.length, 0);
const divisionCount = ceremonyProgramme.divisions.length;

const stats = [
  { value: awardCount, label: 'Commemorative award categories' },
  { value: divisionCount, label: 'Recognition divisions' },
  { value: awardCount * divisionCount, label: 'Recipient places across divisions' },
  { value: ceremonyProgramme.groups.length, label: 'Discipline groups' },
];

const [eventDay, ...eventMonthYear] = CEREMONY_EVENT_DATE.split(' ');
const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CEREMONY_ADDRESS)}`;

function SectionHeader({
  id,
  eyebrow,
  title,
  children,
  align = 'left',
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
  align?: 'left' | 'center';
}) {
  const centered = align === 'center';
  return (
    <div className={centered ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <p className={`flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ${centered ? 'justify-center' : ''}`}>
        <span aria-hidden="true" className="h-[2px] w-8 rounded-full bg-brass-500" />
        {eyebrow}
      </p>
      <h2 id={id} className="mt-4 font-display text-3xl font-semibold tracking-tight text-forum-900 sm:text-[2.25rem] sm:leading-tight">
        {title}
      </h2>
      {children && <div className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg sm:leading-relaxed">{children}</div>}
    </div>
  );
}

export default function SecondInternationalAwardsPage() {
  const bannerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [returnFocusId, setReturnFocusId] = useState(MAIN_CTA_ID);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Second International IFSMHP Awards 2026 · IFSMHP';
    return () => { document.title = previous; };
  }, []);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          el.classList.add('in-view');
          observer?.disconnect();
        }
      }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
      observer.observe(el);
    } catch {
      el.classList.add('in-view');
    }
    return () => observer?.disconnect();
  }, []);

  const openRegistration = (triggerId: string) => {
    setReturnFocusId(triggerId);
    setOpen(true);
  };

  return (
    <>
      <section ref={bannerRef} className="about-banner bg-paper" aria-labelledby="ceremony-heading">
        <div aria-hidden="true" className="about-shape about-shape-blob-blue" style={{ top: '-90px', right: '-110px' }} />
        <div aria-hidden="true" className="about-shape about-shape-blob-gold hidden sm:block" style={{ bottom: '-80px', left: '-60px' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring hidden md:block" style={{ top: '48px', right: '30%' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring-gold hidden lg:block" style={{ bottom: '40px', right: '4%' }} />
        <div aria-hidden="true" className="about-shape about-shape-dot" style={{ top: '22%', left: '4%' }} />
        <div className={`relative z-10 ${SECTION_INNER}`}>
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-14">
            <div>
              <div className="flex items-center gap-3">
                <span className="about-label inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  Awards ceremony
                </span>
                <span aria-hidden="true" className="about-line inline-block h-[2px] w-16 rounded-full bg-brass-500/90 sm:w-24" />
              </div>
              <h1 id="ceremony-heading" className="mt-7 font-display text-[1.875rem] font-semibold leading-[0.98] tracking-tight text-forum-900 sm:text-[2.7rem] lg:text-[3.05rem]">
                <span className="block">
                  <span className="mr-[0.16em] inline-flex items-start align-baseline text-[1.32em] leading-none text-brass-600" aria-hidden="true">
                    <span>2</span>
                    <span className="ml-[0.2em] mt-[0.6em] text-[0.40em] font-semibold leading-none">nd</span>
                  </span>
                  <span className="sr-only">Second</span>
                  {' '}International
                </span>
                <span className="mt-[0.08em] block">IFSMHP Awards 2026</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-forum-900/80 sm:text-lg sm:leading-[1.75]">
                The second international IFSMHP awards ceremony is on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}, Pune. Nomination is separate from membership and does not guarantee selection.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button id="ceremony-register-hero" type="button" size="lg" onClick={() => openRegistration('ceremony-register-hero')}>
                  Register your interest
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button as="link" to={CEREMONY_INFORMATION_PATH} variant="outline" size="lg">
                  Award information
                </Button>
              </div>
            </div>

            <aside className="overflow-hidden rounded-2xl border border-paper-border bg-paper-raised shadow-xl shadow-forum-900/5" aria-labelledby="ceremony-date-heading">
              <div className="relative overflow-hidden bg-forum-900 px-6 py-7 text-white sm:px-8">
                <div aria-hidden="true" className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-brass-400/25" />
                <div aria-hidden="true" className="absolute -right-2 top-10 h-20 w-20 rounded-full border border-brass-400/20" />
                <h2 id="ceremony-date-heading" className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-400">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  Date and venue
                </h2>
                <p className="relative mt-4 flex items-end gap-4">
                  <span className="font-display text-6xl font-semibold leading-none text-brass-400">{eventDay}</span>
                  <span className="pb-1 text-lg font-medium leading-tight">
                    {eventMonthYear[0]}
                    <span className="block text-forum-100">{eventMonthYear.slice(1).join(' ')}</span>
                  </span>
                </p>
              </div>
              <dl className="divide-y divide-paper-border px-6 sm:px-8">
                <div className="flex gap-4 py-5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brass-600" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Venue</dt>
                    <dd className="mt-1 font-medium text-forum-900">{CEREMONY_VENUE}</dd>
                    <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{CEREMONY_ADDRESS}</dd>
                  </div>
                </div>
                <div className="flex gap-4 py-5">
                  <Award className="mt-0.5 h-5 w-5 shrink-0 text-brass-600" aria-hidden="true" />
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Nomination</dt>
                    <dd className="mt-1 font-medium text-forum-900">Separate from membership</dd>
                  </div>
                </div>
              </dl>
              <div className="px-6 pb-6 sm:px-8">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 focus-visible:ring-offset-2"
                >
                  Get directions
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="bg-forum-950 text-white" aria-label="Ceremony at a glance">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:py-12">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={`flex flex-col-reverse items-center justify-end border-white/10 px-3 text-center ${index % 2 === 1 ? 'border-l' : ''} ${index === 2 ? 'lg:border-l' : ''}`}
            >
              <dt className="mt-2 text-sm leading-snug text-forum-100">{stat.label}</dt>
              <dd className="font-display text-4xl font-semibold text-brass-400 sm:text-5xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-paper" aria-labelledby="participation-heading">
        <div className={SECTION_INNER}>
          <SectionHeader id="participation-heading" eyebrow="Participation" title="Ways to take part">
            <p>Choose one participation type when you register. Each option records your interest. It does not confirm a place, a poster, or an award.</p>
          </SectionHeader>
          <div className={`${CONTENT_GAP} grid gap-6 md:grid-cols-3`}>
            {participation.map((item, index) => (
              <article
                key={item.title}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-paper-border bg-paper-raised p-6 shadow-sm transition duration-300 hover:border-forum-200 hover:shadow-lg motion-safe:hover:-translate-y-1 sm:p-7"
              >
                <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brass-500 to-brass-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-700 transition-colors duration-300 group-hover:bg-forum-900 group-hover:text-brass-400">
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span aria-hidden="true" className="font-display text-3xl font-semibold text-forum-100">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold text-forum-900">{item.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{item.text}</p>
                <div className="mt-6 border-t border-paper-border pt-4">
                  {item.action.kind === 'register' ? (
                    <button
                      id={item.action.id}
                      type="button"
                      onClick={() => item.action.kind === 'register' && openRegistration(item.action.id)}
                      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-forum-700 hover:text-forum-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 focus-visible:ring-offset-2"
                    >
                      Register interest
                      <span className="sr-only"> as a {item.title.toLowerCase()}</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  ) : (
                    <Link
                      to={item.action.to}
                      className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-forum-700 hover:text-forum-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 focus-visible:ring-offset-2"
                    >
                      {item.action.label}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-forum-50" aria-labelledby="previous-edition-heading">
        <div className={SECTION_INNER}>
          <SectionHeader id="previous-edition-heading" eyebrow="Previous edition" title="Moments from the 2025 ceremony">
            <p>Laureates were honoured on stage at the International Laureates Recognition Conclave. Select a photograph to view it at full size.</p>
          </SectionHeader>
          <div className={CONTENT_GAP}>
            <PreviousAwardPhotos />
          </div>
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="registration-meaning-heading">
        <div className={`${SECTION_INNER} grid items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16`}>
          <div>
            <SectionHeader id="registration-meaning-heading" eyebrow="Before you register" title="What registration means">
              <p>{CEREMONY_INTEREST_NOTICE}</p>
            </SectionHeader>
            <div className="mt-8 flex gap-4 rounded-xl border border-paper-border bg-forum-50/60 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-900 text-brass-400">
                <UserRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm leading-relaxed text-ink-muted">
                Ceremony registration is separate from IFSMHP membership.{' '}
                <a href="/register" className="font-medium text-forum-700 underline underline-offset-2 hover:text-forum-900">Membership registration</a>
                {' '}remains on its own page.
              </p>
            </div>
          </div>
          <article className="rounded-2xl border border-paper-border bg-paper-raised p-6 shadow-lg shadow-forum-900/5 sm:p-8">
            <h3 className="font-display text-2xl font-semibold text-forum-900">Included in your registration</h3>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed text-ink">
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                <span>Your interest in attending is recorded.</span>
              </li>
              <li className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                <span>You can be contacted about this ceremony after you give consent.</span>
              </li>
              <li className="flex gap-3 rounded-lg bg-brass-50 p-3 ring-1 ring-inset ring-brass-500/20">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" />
                <span>An award, a poster, and admission are not confirmed by this form.</span>
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="bg-forum-50" aria-labelledby="nomination-qr-heading">
        <div className={SECTION_INNER}>
          <div className="grid items-center gap-10 overflow-hidden rounded-3xl border border-paper-border bg-paper-raised p-6 shadow-sm sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:p-12">
            <div>
              <SectionHeader id="nomination-qr-heading" eyebrow="Nominations" title="Open the nomination form with a QR code">
                <p>The code opens the award nomination form. It is separate from IFSMHP membership registration. Interest registration on this page does not submit a nomination.</p>
              </SectionHeader>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button as="link" to={CEREMONY_NOMINATE_PATH}>
                  Go to the nomination form
                </Button>
                <Button as="link" to={CEREMONY_INFORMATION_PATH} variant="outline">
                  Award information
                </Button>
              </div>
            </div>
            <div className="relative rounded-2xl bg-forum-50 px-6 pb-6 pt-8 ring-1 ring-inset ring-paper-border sm:px-8">
              <span className="absolute left-1/2 top-0 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-forum-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brass-400">
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                Scan me
              </span>
              <CeremonyRegistrationQr />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-paper" aria-labelledby="ceremony-cta-heading" id="ceremony-cta">
        <div className={SECTION_INNER}>
          <div className="relative overflow-hidden rounded-3xl bg-forum-900 px-6 py-14 text-center text-white shadow-xl sm:px-12 lg:py-16">
            <div aria-hidden="true" className="absolute -left-16 -top-16 h-56 w-56 rounded-full border border-brass-400/20" />
            <div aria-hidden="true" className="absolute -bottom-20 -right-12 h-64 w-64 rounded-full border border-brass-400/15" />
            <div aria-hidden="true" className="absolute -bottom-10 right-24 h-24 w-24 rounded-full bg-brass-500/10 blur-2xl" />
            <div className="relative">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brass-500/15 text-brass-400 ring-1 ring-inset ring-brass-400/30">
                <Award className="h-7 w-7" aria-hidden="true" />
              </div>
              <h2 id="ceremony-cta-heading" className="mt-6 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">Register your interest</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-forum-100 sm:text-lg">
                Tell us you would like to attend on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}. This records interest and does not reserve admission.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
                <Button id={MAIN_CTA_ID} type="button" size="lg" variant="secondary" onClick={() => openRegistration(MAIN_CTA_ID)}>
                  Register for the Ceremony
                </Button>
                <Link
                  to={CEREMONY_NOMINATE_PATH}
                  className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-brass-200 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass-400 focus-visible:ring-offset-2 focus-visible:ring-offset-forum-900"
                >
                  Nominate someone instead
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CeremonyRegistrationDialog
        open={open}
        onClose={() => setOpen(false)}
        returnFocusId={returnFocusId}
      />
    </>
  );
}
