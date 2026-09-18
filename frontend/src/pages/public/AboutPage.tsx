import { useEffect, useRef } from 'react';
import {
  Award,
  Users,
  FileText,
  DollarSign,
  Target,
  Lightbulb,
  ShieldCheck,
  BookOpenCheck,
  Globe2,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';

const impactStats = [
  { value: '277', label: 'Current Members Worldwide', icon: Users },
  { value: '89', label: 'Research Projects Supported', icon: FileText },
  { value: '156', label: 'Papers Published', icon: BookOpenCheck },
  { value: '47', label: 'Funding Grants Awarded', icon: DollarSign },
];

const objectives = [
  {
    icon: Award,
    title: 'Support Research Excellence',
    desc: 'Provide comprehensive support for quality research through every stage of the process.',
  },
  {
    icon: Lightbulb,
    title: 'Enable Scientific Expression',
    desc: 'Create platforms for members to share views and opinions with the global community.',
  },
  {
    icon: BookOpenCheck,
    title: 'Public Education',
    desc: 'Enlighten people with evidence-based scientific perspectives they can trust.',
  },
  {
    icon: Globe2,
    title: 'Global Collaboration',
    desc: 'Foster international partnerships and knowledge exchange across continents.',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Assurance',
    desc: 'Promote rigorous, ethical research standards throughout all our initiatives.',
  },
];

export default function AboutPage() {
  const bannerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    let io: IntersectionObserver | null = null;
    let triggered = false;
    try {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !triggered) {
              triggered = true;
              el.classList.add('in-view');
              io?.disconnect();
            }
          });
        },
        { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
      );
      io.observe(el);
    } catch {
      el.classList.add('in-view');
    }
    return () => {
      io?.disconnect();
    };
  }, []);

  return (
    <>
      <section
        ref={bannerRef}
        className="about-banner bg-paper border-b border-paper-border"
        aria-labelledby="about-heading"
      >
        {/* Decorative background shapes (dark blue + gold) */}
        <div
          aria-hidden="true"
          className="about-shape about-shape-blob-blue"
          style={{ top: '-90px', right: '-110px' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-blob-gold hidden sm:block"
          style={{ bottom: '-80px', left: '-60px' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-ring hidden md:block"
          style={{ top: '60px', right: '22%' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-ring-gold hidden lg:block"
          style={{ bottom: '80px', right: '12%' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-dot"
          style={{ top: '40%', left: '8%' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-dot"
          style={{ top: '22%', right: '14%' }}
        />
        <div
          aria-hidden="true"
          className="about-shape about-shape-line hidden sm:block"
          style={{ bottom: '32%', left: '18%' }}
        />

        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-3xl">
            {/* Eyebrow label — gold */}
            <div className="flex items-center gap-3">
              <span className="about-label inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
                About IFSMHP
              </span>
              <span
                aria-hidden="true"
                className="about-line inline-block h-[2px] w-16 sm:w-24 rounded-full bg-brass-500/90"
              />
            </div>

            {/* Main heading — word-by-word reveal with gold shimmer on key words */}
            <h1
              id="about-heading"
              className="about-heading-word mt-7 font-display text-[2.5rem] leading-[1.1] font-semibold tracking-tight text-forum-900 sm:text-5xl sm:leading-[1.08] lg:text-6xl lg:leading-[1.05]"
            >
              Bridging research and real-world impact
            </h1>

            {/* Paragraph — delayed fade-up with slightly reduced dark-blue opacity */}
            <p className="about-paragraph mt-7 text-base sm:text-lg lg:text-xl leading-relaxed text-forum-900/80 sm:leading-[1.75]">
              Founded with a vision of creating a unified global platform for scientists
              and mental health professionals, IFSMHP exists to ensure every researcher
              has the support they need to pursue work that benefits humanity.
            </p>
          </div>
        </div>
      </section>

      <Section bg="paper">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {impactStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className="rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700">
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className="mt-5 font-display text-3xl font-semibold text-forum-900">
                  {stat.value}
                </p>
                <p className="mt-1 text-sm text-ink-muted">{stat.label}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-6 rounded-xl border border-brass-500/30 bg-brass-100/40 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brass-500 text-white">
              <Target className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-forum-900">
                Target: 1,000 Members by End of 2027
              </h3>
              <p className="mt-1 text-ink-muted">
                We're actively growing our community of scientists and mental health
                professionals to create an even greater impact on a global scale.
              </p>
            </div>
          </div>
        </div>
      </Section>

      <Section bg="raised">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-forum-700">
            Leadership
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Guided by a vision for excellence
          </h2>
        </div>

        <div className="mt-14 mx-auto max-w-2xl">
          <div className="rounded-2xl border border-paper-border bg-paper p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-forum-100 ring-4 ring-brass-500/20">
              <svg
                className="h-14 w-14 text-forum-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="mt-6 font-display text-xl font-semibold text-forum-900">
              Chief Research Officer
            </h3>
            <p className="mt-1 text-sm font-medium text-brass-700 uppercase tracking-wide">
              CRO, IFSMHP
            </p>
            <p className="mt-5 text-ink-muted leading-relaxed">
              Leading IFSMHP's mission to support global research excellence and
              mental health advancement. Committed to ensuring every member receives
              the resources, recognition, and platform needed to make a difference.
            </p>
          </div>
        </div>
      </Section>

    <Section bg="forum">
        <div className="grid gap-12 items-center lg:grid-cols-2 lg:gap-16">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
              Our Story
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
              Every researcher deserves support
            </h2>
            <div className="mt-6 space-y-5 text-ink-muted leading-relaxed">
              {/* <p>
                IFSMHP was founded with a simple yet powerful conviction:{' '}
                <strong className="text-ink">
                  every researcher deserves support
                </strong>{' '}
                — moral, official, and financial — to pursue groundbreaking work that
                benefits humanity.
              </p> */}
              <p>
                Founded with the vision of creating a unified global platform for scientists and mental health professionals, IFSMHP bridges the gap between research and real-world impact. We believe that every researcher deserves support—moral, official, and financial—to pursue groundbreaking work that benefits humanity.
              </p>
              {/* <p>
                We bridge that gap by creating a unified global platform where
                scientists and mental health professionals can connect, collaborate,
                and contribute to real-world impact — together.
              </p> */}
            </div>
          </div>
          {/* <div className="relative">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-forum-600 to-forum-900 p-1 shadow-lg">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-forum-900/50">
                <div className="text-center px-8">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brass-500 text-white">
                    <Users className="h-8 w-8" />
                  </div>
                  <p className="mt-5 font-display text-2xl font-semibold text-white">
                    277 Members
                  </p>
                  <p className="mt-1 text-forum-100/70">
                    across multiple continents
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-1.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2.5 w-2.5 rounded-full ${
                          i < 2 ? 'bg-brass-500' : 'bg-white/15'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-xs text-forum-100/60">
                      28% toward 2027 goal
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div> */}
        </div>
      </Section>


      <Section bg="raised">
        <div className="grid gap-12 items-center lg:grid-cols-1 lg:gap-16 text-center max-w-2xl mx-auto">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
              Our Impact
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
              277 Current Members Worldwide
            </h2>
            <div className="mt-6 space-y-5 text-ink-muted leading-relaxed">
              <p>
                Research Projects Supported<br/>
                Papers Published<br/>
                Funding Grants Awarded<br/>
                Target: 1,000 Members by End of 2027
              </p>
              
            </div>
          </div>
          
        </div>
      </Section>

      <Section bg="paper">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            Our Objectives
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            What we aim to achieve
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Five core objectives guide every decision, initiative, and program we
            create for our global community.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {objectives.map((obj) => {
            const Icon = obj.icon;
            return (
              <div
                key={obj.title}
                className="group rounded-xl border border-paper-border bg-paper-raised p-6 transition-all hover:border-forum-200 hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-700 group-hover:bg-forum-600 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">
                  {obj.title}
                </h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{obj.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="forum">
        <div className="rounded-2xl bg-paper-raised p-8 sm:p-12 text-center shadow-sm">
          <h2 className="font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Ready to be part of our story?
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-lg text-ink-muted">
            Join IFSMHP today and contribute to a community dedicated to advancing
            research and mental health worldwide.
          </p>
          <div className="mt-8 flex justify-center flex-wrap gap-3">
            <Button as="link" to="/register" size="lg">
              Become a Member
            </Button>
            <Button as="link" to="/contact" size="lg" variant="outline">
              Get in Touch
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
