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
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';

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

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-forum-900 via-forum-700 to-forum-600">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-28 lg:py-32">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <Globe2 className="h-3.5 w-3.5" />
              Global Community
            </span>
            <h1 className="mt-6 max-w-4xl text-4xl font-semibold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              Advancing Global Research &amp; Mental Health Through{' '}
              <span className="text-brass-100">Collaborative Excellence</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-forum-100/80 sm:text-xl">
              Join 277 leading Scientists and Mental Health Professionals worldwide
              in shaping the future of evidence-based research and practice.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3 sm:gap-4">
              <Button as="link" to="/register" size="lg" variant="primary" className="min-h-14 whitespace-nowrap bg-brass-500 px-6 hover:bg-brass-700 focus-visible:ring-brass-500 sm:px-8">
                Become a Member
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
              <Button as="link" to="/research" size="lg" variant="outline" className="min-h-14 whitespace-nowrap border-white/30 bg-transparent px-6 text-white hover:bg-white/10 focus-visible:ring-white/50 sm:px-8">
                <FileText className="h-4.5 w-4.5" />
                View Published Research
              </Button>
            </div>
          </div>
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
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
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
