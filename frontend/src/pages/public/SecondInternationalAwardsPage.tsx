import { useEffect, useRef, useState } from 'react';
import { Award } from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import CeremonyRegistrationDialog from '../../components/awards/CeremonyRegistrationDialog';
import { CEREMONY_DATE_NOTICE, CEREMONY_INTEREST_NOTICE } from '../../domain/ceremonyRegistration';

type Source = 'hero' | 'cta';

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
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
                <Award className="h-3.5 w-3.5" aria-hidden="true" />
                Awards ceremony
              </span>
            </div>
            <h1 id="ceremony-heading" className="mt-7 font-display text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-forum-900 sm:text-5xl">
              Second International Awards Ceremony
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-relaxed text-forum-900/80 sm:text-lg">
              Register your interest in attending the second international IFSMHP awards ceremony. The date and venue are still being finalised.
            </p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-muted">{CEREMONY_DATE_NOTICE}</p>
            <div className="mt-8">
              <Button id="ceremony-register-hero" type="button" size="lg" onClick={() => openFrom('hero')}>
                Register for the Ceremony
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Section>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-3xl font-semibold text-forum-900">What registration means</h2>
          <p className="mt-5 text-base leading-relaxed text-ink-muted">{CEREMONY_INTEREST_NOTICE}</p>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Ceremony registration is separate from IFSMHP membership.{' '}
            <a href="/register" className="font-medium text-forum-700 underline">Membership registration</a>
            {' '}remains on its own page.
          </p>
        </div>
      </Section>

      <Section bg="raised" id="ceremony-cta">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl font-semibold text-forum-900 sm:text-4xl">Register your interest</h2>
          <p className="mt-5 text-lg text-ink-muted">
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
