import { useEffect, useState } from 'react';
import {
  Users,
  HeartHandshake,
  ShieldCheck,
  DollarSign,
  Globe2,
  IdCard,
  BookOpen,
  Lightbulb,
  GraduationCap,
  Target,
  Rocket,
  ArrowRight,
  FileText,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  Award,
  Calendar,
  Sparkles,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';

import bannerCommunity from '../../assets/images/slide_01.png';
import bannerSymposium from '../../assets/images/slide_02.png';
import bannerAwards from '../../assets/images/slide_03.png';
import bannerReviews from '../../assets/images/slide_04.png';

const stats = [
  { value: '277+', label: 'Global Members', icon: Users },
  { value: '123', label: 'Research Scholars & Scientists', icon: GraduationCap },
  { value: '154', label: 'Mental Health Professionals', icon: HeartHandshake },
  { value: '1,000', label: 'Target Members by 2027', icon: Target },
];

const memberBenefits = [
  {
    icon: HeartHandshake,
    title: 'Moral Support',
    desc: 'Connect with peers who understand your research journey through every challenge.',
  },
  {
    icon: ShieldCheck,
    title: 'Official Support',
    desc: 'Institutional backing and credibility that lends authority to your projects.',
  },
  {
    icon: DollarSign,
    title: 'Funding Support',
    desc: 'Access to research grants, financial resources, and funding connections.',
  },
  {
    icon: Globe2,
    title: 'Global Platform',
    desc: 'Showcase your work to an international audience of researchers and professionals.',
  },
  {
    icon: IdCard,
    title: 'Unique Professional ID',
    desc: 'Official recognition and membership credentials that set you apart.',
  },
];

const publicBenefits = [
  {
    icon: BookOpen,
    title: 'Access to Research',
    desc: 'Read cutting-edge research papers and articles from leading experts.',
  },
  {
    icon: Lightbulb,
    title: 'Scientific Insights',
    desc: 'Evidence-based opinions on products and services that matter to you.',
  },
  {
    icon: GraduationCap,
    title: 'Educational Resources',
    desc: 'Stay informed with expert perspectives from trusted professionals.',
  },
];

interface HomeBannerSlide {
  id: string;
  eyebrow: { icon: typeof Globe2; label: string };
  title: string;
  highlightWord: string;
  lead: string;
  chips: Array<{ label: string; value?: string }>;
  gradientOverlay: string;
  bgImage: string;
  ctas: Array<{
    to: string;
    label: string;
    variant: 'primary' | 'outline';
    icon?: typeof ArrowRight;
  }>;
}

const HOME_BANNERS: HomeBannerSlide[] = [
  {
    id: 'home-banner-community',
    eyebrow: { icon: Globe2, label: 'Global Community' },
    title: 'Advancing Global Research & Mental Health Through Collaborative Excellence',
    highlightWord: 'Collaborative Excellence',
    lead: 'Join 277 leading Scientists and Mental Health Professionals worldwide in shaping the future of evidence-based research and practice.',
    chips: [
      { label: '277+ members' },
      { label: 'Across', value: '14 countries' },
      { label: '1,000 target', value: 'by 2027' },
    ],
    gradientOverlay: 'from-forum-950/85 via-forum-900/65 to-forum-700/35',
    bgImage: bannerCommunity,
    ctas: [
      { to: '/register', label: 'Become a Member', variant: 'primary', icon: ArrowRight },
      { to: '/research', label: 'View Published Research', variant: 'outline', icon: FileText },
    ],
  },
  {
    id: 'home-banner-symposium',
    eyebrow: { icon: Calendar, label: 'Spring Symposium 2026 · Save the date' },
    title: 'The 14th IFSMHP Spring Symposium — Call for Abstracts Now Open',
    highlightWord: 'Call for Abstracts Now Open',
    lead: 'Submit your methodological, clinical or policy-focused work by 15 October 2026. Three tracks, 9 keynote plenaries, and a riverside networking reception hosted at the UNS Sydney Forum Hall.',
    chips: [
      { label: 'Dates', value: '12–14 Mar 2026' },
      { label: 'Venue', value: 'UNS Sydney' },
      { label: '3 tracks', value: '9 keynotes' },
    ],
    gradientOverlay: 'from-forum-950/80 via-forum-800/60 to-slateteal-900/40',
    bgImage: bannerSymposium,
    ctas: [
      { to: '/events', label: 'View Event Programme', variant: 'primary', icon: ArrowRight },
      { to: '/gallery', label: 'Browse Event Gallery', variant: 'outline', icon: Sparkles },
    ],
  },
  {
    id: 'home-banner-awards',
    eyebrow: { icon: Award, label: 'CRO Awards Night 2025 · Hall of Fame' },
    title: 'Honouring Nine Distinguished Contributors to Global Mental Health Science',
    highlightWord: 'Hall of Fame',
    lead: 'The 2025 CRO Lifetime Contribution, Distinguished Service and Early-Career Citations were awarded on 22 November at the IFSMHP Awards Dinner. Read citations, view portraits and download commemorative publications.',
    chips: [
      { label: 'Awardees', value: '9 honoured' },
      { label: 'Categories', value: '4 prizes' },
      { label: 'Portraits', value: '11 curated' },
    ],
    gradientOverlay: 'from-amber-950/80 via-brass-900/55 to-rose-950/40',
    bgImage: bannerAwards,
    ctas: [
      { to: '/product-reviews', label: 'Read Awardee Citations', variant: 'primary', icon: ArrowRight },
      { to: '/gallery', label: 'View Awards Gallery', variant: 'outline', icon: Sparkles },
    ],
  },
  {
    id: 'home-banner-reviews',
    eyebrow: { icon: Sparkles, label: 'Expert Reviews · Updated weekly' },
    title: 'Independent, Methodologically Grounded Perspectives on Products, Services & Policies',
    highlightWord: 'Expert Perspectives',
    lead: 'Fifteen new member reviews published this quarter across five review pillars — from digital therapeutics and teletherapy networks to EU mental health strategy and AI-assisted triage safety.',
    chips: [
      { label: 'Pillars', value: '5 categories' },
      { label: 'This quarter', value: '15 new reviews' },
      { label: 'Disclosures', value: '100% declared' },
    ],
    gradientOverlay: 'from-slateteal-950/80 via-forum-900/55 to-indigo-950/40',
    bgImage: bannerReviews,
    ctas: [
      { to: '/product-reviews', label: 'Browse Expert Reviews', variant: 'primary', icon: ArrowRight },
      { to: '/membership', label: 'Become a Reviewer', variant: 'outline', icon: BookOpen },
    ],
  },
];

const TRIANGLE_SVG =
  "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")";

export default function HomePage() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [bannerPlaying, setBannerPlaying] = useState(true);
  const [bannerHover, setBannerHover] = useState(false);

  useEffect(() => {
    if (!bannerPlaying || bannerHover) return;
    const t = window.setInterval(() => {
      setBannerIndex((i) => (i + 1) % HOME_BANNERS.length);
    }, 6200);
    return () => window.clearInterval(t);
  }, [bannerPlaying, bannerHover]);

  const goPrev = () => setBannerIndex((i) => (i - 1 + HOME_BANNERS.length) % HOME_BANNERS.length);
  const goNext = () => setBannerIndex((i) => (i + 1) % HOME_BANNERS.length);

  return (
    <>
      <section
        aria-label="IFSMHP home banner carousel"
        aria-roledescription="carousel"
        aria-live="polite"
        className="relative overflow-hidden"
        onMouseEnter={() => setBannerHover(true)}
        onMouseLeave={() => setBannerHover(false)}
        onFocus={() => setBannerHover(true)}
        onBlur={() => setBannerHover(false)}
      >
        <div className="relative h-[460px] sm:h-[520px] lg:h-[620px]">
          {HOME_BANNERS.map((slide, i) => {
            const active = i === bannerIndex;
            const Icon = slide.eyebrow.icon;
            return (
              <div
                key={slide.id}
                id={`home-banner-slide-${slide.id}`}
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${HOME_BANNERS.length}: ${slide.eyebrow.label}`}
                aria-hidden={!active}
                className={`absolute inset-0 bg-forum-800 transition-opacity duration-700 ease-in-out ${active ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
              >
                <img
                  src={slide.bgImage}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
                <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center px-4 pb-10 pt-14 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8 lg:pb-16">
                  <div className="relative max-w-3xl">
                    <div className="absolute inset-x-[-1.5rem] -inset-y-8 -z-10 rounded-[2.5rem] bg-forum-950/25 backdrop-blur-[2px]" aria-hidden />
                    <span className="inline-flex items-center gap-2 rounded-full bg-forum-950/40 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20 backdrop-blur">
                      <Icon className="h-3.5 w-3.5" />
                      {slide.eyebrow.label}
                    </span>
                    <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.1] text-white drop-shadow-sm sm:text-5xl lg:text-6xl">
                      {slide.title.split(slide.highlightWord).length === 2 ? (
                        <>
                          {slide.title.split(slide.highlightWord)[0]}
                          <span className="text-brass-100">{slide.highlightWord}</span>
                          {slide.title.split(slide.highlightWord)[1]}
                        </>
                      ) : (
                        <>
                          {slide.title}
                        </>
                      )}
                    </h1>
                    <p className="mt-6 text-lg leading-relaxed text-white/90 sm:text-xl">
                      {slide.lead}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {slide.chips.map((chip) => (
                        <span
                          key={chip.label}
                          className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-forum-950/35 px-3 py-1.5 text-xs font-medium text-white backdrop-blur"
                        >
                          <span className="text-white/80">{chip.label}</span>
                          {chip.value ? (
                            <span className="font-semibold text-brass-100">{chip.value}</span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                    <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
                      {slide.ctas.map((cta, idx) => {
                        const CtaIcon = cta.icon;
                        if (cta.variant === 'primary') {
                          return (
                            <Button
                              key={cta.to + idx}
                              as="link"
                              to={cta.to}
                              size="lg"
                              variant="primary"
                              className="min-h-14 whitespace-nowrap bg-brass-500 px-6 text-forum-950 hover:bg-brass-700 focus-visible:ring-brass-500 sm:px-8"
                            >
                              {cta.label}
                              {CtaIcon ? <CtaIcon className="h-4.5 w-4.5" /> : null}
                            </Button>
                          );
                        }
                        return (
                          <Button
                            key={cta.to + idx}
                            as="link"
                            to={cta.to}
                            size="lg"
                            variant="outline"
                            className="min-h-14 whitespace-nowrap border-white/40 bg-forum-950/30 px-6 text-white hover:bg-forum-950/50 focus-visible:ring-white/60 backdrop-blur sm:px-8"
                          >
                            {CtaIcon ? <CtaIcon className="h-4.5 w-4.5" /> : null}
                            {cta.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous slide"
          className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/40 text-white backdrop-blur transition hover:bg-forum-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 sm:left-4 sm:h-11 sm:w-11"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={goNext}
          aria-label="Next slide"
          className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-forum-950/40 text-white backdrop-blur transition hover:bg-forum-950/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300 sm:right-4 sm:h-11 sm:w-11"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-3 px-4 sm:bottom-6 sm:justify-between sm:px-8 lg:px-12">
          <div className="hidden items-center gap-1.5 sm:inline-flex">
            <button
              type="button"
              onClick={() => setBannerPlaying((p) => !p)}
              aria-label={bannerPlaying ? 'Pause carousel' : 'Play carousel'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-forum-950/35 text-white backdrop-blur hover:bg-forum-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-300"
            >
              {bannerPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/80">
              {bannerPlaying ? 'Auto-playing · 6.2 s' : 'Paused'}
            </span>
          </div>
          <ol role="tablist" aria-label="Home banner slides" className="flex items-center gap-2">
            {HOME_BANNERS.map((slide, i) => (
              <li key={slide.id}>
                <button
                  role="tab"
                  aria-selected={i === bannerIndex}
                  aria-controls={`home-banner-slide-${slide.id}`}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setBannerIndex(i)}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    i === bannerIndex ? 'w-10 bg-brass-100' : 'w-2 bg-white/45 hover:bg-white/70'
                  }`}
                />
              </li>
            ))}
          </ol>
          <span className="hidden rounded-full border border-white/15 bg-forum-950/35 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur sm:inline-flex">
            {bannerIndex + 1} / {HOME_BANNERS.length}
          </span>
        </div>
      </section>

      <Section bg="paper" className="-mt-8 sm:-mt-12">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-paper-border bg-paper-raised p-5 shadow-sm sm:p-6"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forum-50 text-forum-700">
                  <Icon className="h-5 w-5" />
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="forum">
        <div className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            Our Global Community
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            A network united by scientific excellence
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Operating across multiple continents, we bring together research scholars,
            scientists, and mental health professionals who share a commitment to
            rigorous, ethical, and impactful work.
          </p>
        </div>
      </Section>

      <Section bg="paper">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            What We Offer
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            For Members
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Comprehensive support systems designed to empower researchers and
            practitioners at every stage of their journey.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {memberBenefits.slice(0, 3).map((b) => (
            <MemberBenefitCard key={b.title} {...b} />
          ))}
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:grid-cols-2">
          {memberBenefits.slice(3).map((b) => (
            <MemberBenefitCard key={b.title} {...b} />
          ))}
        </div>
      </Section>

      <Section bg="raised">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-brass-700">
            For the Public
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Access trusted, evidence-based knowledge
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Our public resources help you make informed decisions with insights
            grounded in scientific rigor.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          {publicBenefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="group rounded-xl border border-paper-border bg-paper p-6 transition-all hover:border-brass-500/30 hover:bg-brass-100/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass-100 text-brass-700 group-hover:bg-brass-500 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{b.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="slateteal">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="rounded-2xl bg-paper-raised p-8 sm:p-10 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-600 text-white">
              <Target className="h-6 w-6" />
            </div>
            <h3 className="mt-6 font-display text-2xl font-semibold text-forum-900">
              Our Vision
            </h3>
            <p className="mt-4 leading-relaxed text-ink-muted">
              By the end of 2027, we aim to build a community of{' '}
              <strong className="text-forum-700">1,000 Scientists and Mental Health
              Professionals</strong> who regularly contribute scientific views and
              opinions through research papers, symposia, and collaborative initiatives
              on products and services at the international level.
            </p>
          </div>

          <div className="rounded-2xl bg-forum-900 p-8 sm:p-10 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass-500 text-white">
              <Rocket className="h-6 w-6" />
            </div>
            <h3 className="mt-6 font-display text-2xl font-semibold text-white">
              Our Mission
            </h3>
            <p className="mt-4 leading-relaxed text-forum-100/80">
              To enlighten people worldwide with scientific views and evidence-based
              opinions about products, services, and experiences that impact{' '}
              <strong className="text-brass-100">mental health</strong> and{' '}
              <strong className="text-brass-100">scientific advancement</strong>.
            </p>
          </div>
        </div>
      </Section>

      <Section bg="paper">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forum-600 to-forum-900 p-10 sm:p-14">
          <div
            className="absolute inset-0 opacity-5"
            style={{ backgroundImage: TRIANGLE_SVG }}
          />
          <div className="relative grid gap-8 items-center lg:grid-cols-5">
            <div className="lg:col-span-3">
              <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
                Ready to contribute to global scientific excellence?
              </h2>
              <p className="mt-4 text-lg text-forum-100/80">
                Join our growing community of researchers and mental health
                professionals. Your voice matters.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 lg:col-span-2 lg:justify-end">
              <Button as="link" to="/register" size="lg" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
                Register Today
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
              <Button
                as="link"
                to="/membership"
                size="lg"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 focus-visible:ring-white/50 bg-transparent"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function MemberBenefitCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof HeartHandshake;
  title: string;
  desc: string;
}) {
  return (
    <div className="group rounded-xl border border-paper-border bg-paper-raised p-6 transition-all hover:border-forum-200 hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-700 group-hover:bg-forum-600 group-hover:text-white transition-colors">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-forum-900">{title}</h3>
      <p className="mt-2 leading-relaxed text-ink-muted">{desc}</p>
    </div>
  );
}
