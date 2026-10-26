import { useEffect, useRef, useState } from 'react';
import { Award, CalendarClock, Presentation, UserRound, Users } from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import CeremonyAwardProgramme from '../../components/awards/CeremonyAwardProgramme';
import CeremonyRegistrationDialog from '../../components/awards/CeremonyRegistrationDialog';
import CeremonyRegistrationQr from '../../components/awards/CeremonyRegistrationQr';
import { ceremonyProgramme } from '../../domain/ceremonyProgramme';
import { CEREMONY_DATE_NOTICE, CEREMONY_INTEREST_NOTICE, CEREMONY_REGISTER_PATH } from '../../domain/ceremonyRegistration';

type Source = 'hero' | 'cta';

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
    text: 'Tell us you are interested in an award nomination. Nomination requirements will be communicated separately.',
  },
];

export default function SecondInternationalAwardsPage() {
  const bannerRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState<Source>('hero');

  useEffect(() => {
    const previous = document.title;
    document.title = 'Second International Awards Ceremony · IFSMHP';
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

  const openFrom = (next: Source) => {
    setSource(next);
    setOpen(true);
  };

  return (
    <>
      <section ref={bannerRef} className="about-banner bg-paper border-b border-paper-border" aria-labelledby="ceremony-heading">
        <div aria-hidden="true" className="about-shape about-shape-blob-blue" style={{ top: '-90px', right: '-110px' }} />
        <div aria-hidden="true" className="about-shape about-shape-blob-gold hidden sm:block" style={{ bottom: '-80px', left: '-60px' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring hidden md:block" style={{ top: '60px', right: '22%' }} />
        <div aria-hidden="true" className="about-shape about-shape-ring-gold hidden lg:block" style={{ bottom: '70px', right: '8%' }} />
        <div aria-hidden="true" className="about-shape about-shape-dot" style={{ top: '28%', left: '6%' }} />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:gap-16">
            <div>
              <div className="flex items-center gap-3">
                <span className="about-label inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
                  <Award className="h-3.5 w-3.5" aria-hidden="true" />
                  Awards ceremony
                </span>
                <span aria-hidden="true" className="about-line inline-block h-[2px] w-16 rounded-full bg-brass-500/90 sm:w-24" />
              </div>
              <h1 id="ceremony-heading" className="mt-7 font-display text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-forum-900 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.05]">
                Second International <span className="text-brass-600">Awards</span> Ceremony
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-forum-900/80 sm:text-lg sm:leading-[1.75]">
                Register your interest in attending the second international IFSMHP awards ceremony. The date and venue are still being finalised.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button id="ceremony-register-hero" type="button" size="lg" onClick={() => openFrom('hero')}>
                  Register for the Ceremony
                </Button>
                <Button as="link" to={CEREMONY_REGISTER_PATH} size="lg" variant="outline">
                  Open the form
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-paper-border bg-paper-raised p-6 shadow-sm sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-600 text-white">
                <CalendarClock className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-forum-900">Date and venue</h2>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{CEREMONY_DATE_NOTICE}</p>
              <dl className="mt-6 divide-y divide-paper-border text-sm">
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-ink-muted">Date</dt>
                  <dd className="text-right font-medium text-forum-900">Being finalised</dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-ink-muted">Venue</dt>
                  <dd className="text-right font-medium text-forum-900">Being finalised</dd>
                </div>
                <div className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-ink-muted">Registration</dt>
                  <dd className="text-right font-medium text-forum-900">Interest only</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <CeremonyAwardProgramme programme={ceremonyProgramme} />

      <Section>
        <div className="max-w-2xl">
          <h2 className="font-display text-3xl font-semibold text-forum-900">Ways to take part</h2>
          <p className="mt-4 text-base leading-relaxed text-ink-muted">
            Choose one participation type when you register. Each option records your interest. It does not confirm a place, a poster, or an award.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {participation.map((item) => (
            <article key={item.title} className="rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forum-50 text-forum-700">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-display text-xl font-semibold text-forum-900">{item.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{item.text}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section bg="raised">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <article className="rounded-2xl border border-paper-border bg-paper p-6 shadow-sm sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-forum-600 text-white">
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
          <article className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 to-paper p-6 shadow-sm sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-forum-900">Included in your registration</h2>
            <ul className="mt-5 space-y-3 text-sm leading-relaxed text-ink">
              <li className="rounded-lg bg-white/80 px-4 py-3 ring-1 ring-paper-border">Your interest in attending is recorded.</li>
              <li className="rounded-lg bg-white/80 px-4 py-3 ring-1 ring-paper-border">You can be contacted about this ceremony after you give consent.</li>
              <li className="rounded-lg bg-white/80 px-4 py-3 ring-1 ring-paper-border">An award, a poster, and admission are not confirmed by this form.</li>
            </ul>
          </article>
        </div>
      </Section>

      <Section>
        <div className="grid items-center gap-10 rounded-2xl border border-paper-border bg-paper-raised p-6 shadow-sm sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16">
          <div>
            <h2 className="font-display text-3xl font-semibold text-forum-900">Open the form with a QR code</h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-muted">
              The code opens a registration page, so it works when someone scans it from a poster or another phone. The buttons on this page still open the same form here, without leaving the ceremony page.
            </p>
            <div className="mt-6">
              <Button as="link" to={CEREMONY_REGISTER_PATH} variant="outline">
                Go to the registration form
              </Button>
            </div>
          </div>
          <CeremonyRegistrationQr />
        </div>
      </Section>

      <Section bg="paper" id="ceremony-cta">
        <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 to-paper-raised p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-forum-600 text-white">
            <Award className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">Register your interest</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-muted">
            Tell us you would like to attend. Ceremony updates will follow once the date and venue are confirmed.
          </p>
          <div className="mt-8 flex justify-center">
            <Button id="ceremony-register-cta" type="button" size="lg" onClick={() => openFrom('cta')}>
              Register for the Ceremony
            </Button>
          </div>
        </div>
      </Section>

      <CeremonyRegistrationDialog
        open={open}
        onClose={() => setOpen(false)}
        returnFocusId={source === 'hero' ? 'ceremony-register-hero' : 'ceremony-register-cta'}
      />
    </>
  );
}
