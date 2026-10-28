import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowRight, Award, CalendarDays, CheckCircle2, ExternalLink, Info, MapPin, Presentation, UserRound, Users } from 'lucide-react';
import Button from '../../components/common/Button';
import CeremonyRegistrationDialog from '../../components/awards/CeremonyRegistrationDialog';
import CeremonyRegistrationQr from '../../components/awards/CeremonyRegistrationQr';
import PreviousAwardPhotos from '../../components/awards/PreviousAwardPhotos';
import yaseenShaikhPortrait from '../../assets/images/awards/yaseen-ismail-shaikh.jpg';
import { CEREMONY_ADDRESS, CEREMONY_EVENT_DATE, CEREMONY_VENUE, ceremonyProgramme } from '../../domain/ceremonyProgramme';
import { CEREMONY_INFORMATION_PATH, CEREMONY_INTEREST_NOTICE, CEREMONY_NOMINATE_PATH } from '../../domain/ceremonyRegistration';

const organisingSecretary = ceremonyProgramme.committee?.find((member) => member.role === 'Organising Committee Secretary');

const participation = [
  {
    icon: Users,
    title: 'Delegate',
    text: 'Tell us you would like to attend as a delegate. This records interest only and does not reserve a place.',
  },
  {
    icon: Presentation,
    title: 'Student poster',
    text: 'Tell us you are interested in presenting a student poster. Submission requirements will be communicated separately.',
  },
  {
    icon: Award,
    title: 'Award nomination',
    text: 'Use the official nomination form to nominate someone. Registering interest on this page does not submit a nomination.',
  },
];

const SECTION_INNER = 'mx-auto max-w-6xl px-4 pb-16 sm:px-6';
const SECTION_GAP = 'mt-16';
const [eventDay, ...eventMonthYear] = CEREMONY_EVENT_DATE.split(' ');
const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CEREMONY_ADDRESS)}`;

function EvenSection({
  id,
  bg = 'paper',
  children,
}: {
  id?: string;
  bg?: 'paper' | 'raised';
  children: ReactNode;
}) {
  return (
    <section id={id} className={bg === 'raised' ? 'bg-paper-raised' : 'bg-paper'}>
      <div className={SECTION_INNER}>{children}</div>
    </section>
  );
}

export default function SecondInternationalAwardsPage() {
  const bannerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

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

  const openRegistration = () => setOpen(true);

  return (
    <>
      <section ref={bannerRef} className="about-banner bg-paper border-b border-paper-border" aria-labelledby="ceremony-heading">
        <div aria-hidden="true" className="about-shape about-shape-blob-blue" style={{ top: '-90px', right: '-110px' }} />
        <div aria-hidden="true" className="about-shape about-shape-blob-gold hidden sm:block" style={{ bottom: '-80px', left: '-60px' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring hidden md:block" style={{ top: '60px', right: '22%' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring-gold hidden lg:block" style={{ bottom: '70px', right: '8%' }} />
        <div aria-hidden="true" className="about-shape about-shape-dot" style={{ top: '28%', left: '6%' }} />
        <div className={`relative z-10 ${SECTION_INNER} pt-20 sm:pt-24 lg:pt-28`}>
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
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
              <p className="about-paragraph mt-7 max-w-2xl text-base leading-relaxed text-forum-900/80 sm:text-lg sm:leading-[1.75]">
                The second international IFSMHP awards ceremony is on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}, Pune. Nomination is separate from membership and does not guarantee selection.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button type="button" size="lg" onClick={openRegistration}>
                  Register your interest
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button as="link" to={CEREMONY_INFORMATION_PATH} variant="outline" size="lg">
                  Award information
                </Button>
              </div>
            </div>

            <aside className="overflow-hidden rounded-2xl border border-paper-border bg-paper-raised shadow-sm" aria-labelledby="ceremony-date-heading">
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
          {organisingSecretary && (
            <div className={SECTION_GAP}>
              <article className="grid overflow-hidden rounded-2xl border border-paper-border bg-paper-raised shadow-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
                <img
                  src={yaseenShaikhPortrait}
                  alt={`${organisingSecretary.name}, ${organisingSecretary.role}, in NCC uniform`}
                  className="h-56 w-full object-cover object-top sm:h-full"
                />
                <div className="p-6 sm:p-8">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass-700">{organisingSecretary.role}</p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-forum-900 sm:text-3xl">{organisingSecretary.name}</h2>
                  {organisingSecretary.tagline && <p className="mt-2 text-sm font-medium text-forum-900">{organisingSecretary.tagline}</p>}
                  {organisingSecretary.affiliation && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{organisingSecretary.affiliation}</p>}
                  <div className="mt-5">
                    <Button as="link" to={CEREMONY_INFORMATION_PATH} variant="outline">
                      Organising committee profile
                    </Button>
                  </div>
                </div>
              </article>
            </div>
          )}
          <div className={SECTION_GAP}>
            <PreviousAwardPhotos />
          </div>
        </div>
      </section>

      <EvenSection>
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-forum-900">Ways to take part</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Choose one participation type when you register. Each option records your interest. It does not confirm a place, a poster, or an award.
          </p>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {participation.map((item) => (
            <article
              key={item.title}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-paper-border bg-gradient-to-br from-white via-paper to-forum-50 p-6 shadow-[0_12px_28px_-16px_rgba(1,37,89,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-18px_rgba(1,37,89,0.4)]"
            >
              <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forum-700 via-brass-500 to-brass-400" />
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-forum-700 to-forum-900 text-brass-400 shadow-md shadow-forum-900/20">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold text-forum-900">{item.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </article>
          ))}
        </div>
      </EvenSection>

      <EvenSection bg="raised">
        <div className="grid items-stretch gap-6 lg:grid-cols-2 lg:gap-8">
          <article className="rounded-2xl border border-paper-border bg-gradient-to-br from-white to-forum-50 p-6 shadow-[0_14px_32px_-18px_rgba(1,37,89,0.38)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-18px_rgba(1,37,89,0.42)] sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-forum-600 to-forum-900 text-white shadow-md shadow-forum-900/25">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold text-forum-900">What registration means</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-muted">{CEREMONY_INTEREST_NOTICE}</p>
            <p className="mt-4 text-sm leading-relaxed text-ink-muted">
              Ceremony registration is separate from IFSMHP membership.{' '}
              <a href="/register" className="font-medium text-forum-700 underline">Membership registration</a>
              {' '}remains on its own page.
            </p>
          </article>
          <article className="rounded-2xl border border-brass-500/20 bg-gradient-to-br from-brass-50 via-white to-forum-50 p-6 shadow-[0_14px_32px_-18px_rgba(195,157,73,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_44px_-18px_rgba(195,157,73,0.4)] sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-forum-900">Included in your registration</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink">
              <li className="flex gap-3 rounded-lg bg-white/90 px-4 py-3 shadow-sm ring-1 ring-paper-border">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                <span>Your interest in attending is recorded.</span>
              </li>
              <li className="flex gap-3 rounded-lg bg-white/90 px-4 py-3 shadow-sm ring-1 ring-paper-border">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-600" aria-hidden="true" />
                <span>You can be contacted about this ceremony after you give consent.</span>
              </li>
              <li className="flex gap-3 rounded-lg bg-gradient-to-r from-brass-50 to-white px-4 py-3 ring-1 ring-inset ring-brass-500/25">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-brass-700" aria-hidden="true" />
                <span>An award, a poster, and admission are not confirmed by this form.</span>
              </li>
            </ul>
          </article>
        </div>
      </EvenSection>

      <EvenSection>
        <div className="grid items-center gap-8 overflow-hidden rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 via-white to-brass-50 p-6 shadow-[0_16px_40px_-20px_rgba(1,37,89,0.4)] sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-12">
          <div>
            <h2 className="font-display text-3xl font-semibold text-forum-900">Open the nomination form with a QR code</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              The code opens the award nomination form. It is separate from IFSMHP membership registration. Interest registration on this page does not submit a nomination.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button as="link" to={CEREMONY_NOMINATE_PATH}>
                Go to the nomination form
              </Button>
              <Button as="link" to={CEREMONY_INFORMATION_PATH} variant="outline">
                Award information
              </Button>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-[0_12px_30px_-12px_rgba(1,37,89,0.35)] ring-1 ring-brass-500/20">
            <CeremonyRegistrationQr />
          </div>
        </div>
      </EvenSection>

      <EvenSection id="ceremony-cta">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forum-900 via-forum-800 to-forum-950 p-8 text-center text-white shadow-[0_20px_48px_-18px_rgba(1,37,89,0.55),0_8px_20px_-10px_rgba(195,157,73,0.35)] sm:p-10">
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-tr from-brass-500/10 via-transparent to-brass-400/15" />
          <div aria-hidden="true" className="absolute -left-16 -top-16 h-48 w-48 rounded-full border border-brass-400/20" />
          <div aria-hidden="true" className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full border border-brass-400/15" />
          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brass-500/15 text-brass-400 ring-1 ring-inset ring-brass-400/30">
              <Award className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold text-white sm:text-4xl">Register your interest</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-forum-100">
              Tell us you would like to attend on {CEREMONY_EVENT_DATE} at {CEREMONY_VENUE}. This records interest and does not reserve admission.
            </p>
            <div className="mt-8 flex justify-center">
              <Button id="ceremony-register-cta" type="button" size="lg" variant="secondary" onClick={openRegistration}>
                Register for the Ceremony
              </Button>
            </div>
          </div>
        </div>
      </EvenSection>

      <CeremonyRegistrationDialog
        open={open}
        onClose={() => setOpen(false)}
        returnFocusId="ceremony-register-cta"
      />
    </>
  );
}
