import {
  HeartHandshake,
  ShieldCheck,
  DollarSign,
  Users,
  MessageCircle,
  Award,
  Building2,
  FileCheck2,
  Award as AwardIcon,
  FolderKanban,
  Calculator,
  Link2,
  LogIn,
  UserPlus,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';

const moralSupport = [
  { icon: Users, title: 'Peer Mentorship Programs', desc: 'Connect with experienced researchers who guide your journey.' },
  { icon: MessageCircle, title: 'Community Forums', desc: 'Engage in discussions with colleagues facing similar challenges.' },
  { icon: Award, title: 'Recognition & Encouragement', desc: 'Your milestones are celebrated by a community that cares.' },
  { icon: HeartHandshake, title: 'Professional Networking', desc: 'Build meaningful connections with global peers.' },
];

const officialSupport = [
  { icon: Building2, title: 'Institutional Endorsement Letters', desc: 'Official IFSMHP endorsement for your research proposals.' },
  { icon: FileCheck2, title: 'Research Credibility Backing', desc: 'Institutional validation that strengthens your submissions.' },
  { icon: AwardIcon, title: 'Official Documentation', desc: 'Certified documents for academic and professional contexts.' },
  { icon: ShieldCheck, title: 'Certification & Credentials', desc: 'IFSMHP-backed recognition of your professional standing.' },
];

const fundingSupport = [
  { icon: DollarSign, title: 'Research Grant Opportunities', desc: 'Access exclusive grant programs for member projects.' },
  { icon: FolderKanban, title: 'Project Funding Applications', desc: 'Streamlined application processes for eligible research.' },
  { icon: Calculator, title: 'Budget Assistance', desc: 'Expert guidance on research budgeting and financial planning.' },
  { icon: Link2, title: 'Financial Resource Connections', desc: 'Connections to partner funders and institutions globally.' },
];

export default function SupportServicesPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-slateteal-700 via-slateteal-500 to-forum-600">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              Support Services
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              How we support our members
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
              Three integrated pillars of support — moral, official, and financial —
              designed to ensure you can focus on what matters: your research and
              practice.
            </p>
          </div>
        </div>
      </section>

      <Section bg="paper">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-brass-700">
            Pillar 1
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Moral Support
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Because research can be a lonely journey — and no one should walk it
            alone.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {moralSupport.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm hover:shadow-md transition-all hover:border-forum-200"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brass-100 text-brass-700 group-hover:bg-forum-600 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="forum">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-forum-700">
            Pillar 2
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Official Support
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Institutional credibility that opens doors — because great work
            deserves authoritative backing.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {officialSupport.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group rounded-xl border border-forum-200 bg-paper-raised p-6 shadow-sm hover:shadow-md transition-all hover:border-forum-400"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-100 text-forum-700 group-hover:bg-forum-600 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="paper">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            Pillar 3
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Funding Support
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Financial resources and guidance so promising research never stalls
            because of funding gaps.
          </p>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {fundingSupport.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm hover:shadow-md transition-all hover:border-slateteal-500/30"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slateteal-100 text-slateteal-700 group-hover:bg-slateteal-500 group-hover:text-white transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="raised">
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-2xl border border-forum-200 bg-gradient-to-br from-forum-600 to-forum-900 p-8 sm:p-10 text-white">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
              <LogIn className="h-6 w-6" />
            </div>
            <h3 className="mt-6 font-display text-2xl font-semibold">
              Already a Member?
            </h3>
            <p className="mt-3 text-forum-100/80 leading-relaxed">
              Log in to your dashboard to request support for any active project.
              You can select moral, official, or funding support (or all three) and
              track status in real time.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-forum-100/80">
              {[
                'Request support for existing projects',
                'Track support request status',
                'Direct CRO communication',
                'Document submission portal',
              ].map((i) => (
                <li key={i} className="flex gap-2 items-center">
                  <CheckCircle2 className="h-4 w-4 text-brass-100 shrink-0" />
                  {i}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button
                as="link"
                to="/dashboard/support"
                size="lg"
                className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500"
              >
                Request Support
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-paper-border bg-paper-raised p-8 sm:p-10 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-700">
              <UserPlus className="h-6 w-6" />
            </div>
            <h3 className="mt-6 font-display text-2xl font-semibold text-forum-900">
              Not a Member Yet?
            </h3>
            <p className="mt-3 text-ink-muted leading-relaxed">
              Join IFSMHP today to unlock comprehensive support for your research,
              professional practice, and collaborative projects.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-muted">
              {[
                'All three support pillars included',
                'Unique IFSMHP Member ID',
                'Dashboard and publishing platform',
                'Global community and events access',
              ].map((i) => (
                <li key={i} className="flex gap-2 items-center">
                  <CheckCircle2 className="h-4 w-4 text-slateteal-500 shrink-0" />
                  {i}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <Button as="link" to="/register" size="lg">
                Join IFSMHP
                <ArrowRight className="h-4.5 w-4.5" />
              </Button>
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}
