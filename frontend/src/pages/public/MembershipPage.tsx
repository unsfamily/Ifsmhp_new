import {
  UserCheck,
  UserCog,
  Users,
  GraduationCap,
  BookOpen,
  FolderKanban,
  Upload,
  MessageSquare,
  Award,
  CheckCircle2,
  ArrowRight,
  IdCard,
  Globe2,
  Send,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';

const whoCanJoin = [
  { icon: GraduationCap, title: 'Research Scholars & Scientists', desc: 'Across all disciplines contributing to mental health and scientific knowledge.' },
  { icon: UserCog, title: 'Mental Health Professionals', desc: 'Psychiatrists, Psychologists, Counselors, Therapists, and Social Workers.' },
  { icon: BookOpen, title: 'Doctoral Candidates', desc: 'PhD candidates in relevant fields pursuing impactful research.' },
  { icon: Users, title: 'Academic Researchers', desc: 'University-affiliated researchers and institutional faculty.' },
];

const benefits = [
  {
    icon: IdCard,
    title: 'Professional Profile',
    items: [
      'Create your comprehensive professional profile',
      'Receive a unique IFSMHP Member ID',
      'Showcase your credentials, education, and expertise',
      'Build your professional portfolio',
    ],
  },
  {
    icon: FolderKanban,
    title: 'Project Management',
    items: [
      'Upload and manage your research projects',
      'Request moral, official, or funding support',
      'Track project progress and milestones',
      'Collaborate with global peers',
    ],
  },
  {
    icon: Upload,
    title: 'Publishing Platform',
    items: [
      'Publish research papers and articles',
      'Reach a global audience',
      'Contribute to public knowledge',
      'Build your academic reputation',
    ],
  },
  {
    icon: MessageSquare,
    title: 'Direct Communication',
    items: [
      'Dashboard access for document exchange',
      'Share video links and multimedia content',
      'Direct communication with Chief Research Officer',
      'Receive updates and opportunities',
    ],
  },
  {
    icon: Award,
    title: 'Global Recognition',
    items: [
      'Official IFSMHP membership certificate',
      'Professional networking opportunities',
      'Participation in international symposia',
      'Voice your scientific opinions on global platforms',
    ],
  },
  {
    icon: Globe2,
    title: 'Community Access',
    items: [
      'Connect with 277+ members worldwide',
      'Join specialized interest groups',
      'Access member-only forums and discussions',
      'Attend exclusive webinars and events',
    ],
  },
];

const steps = [
  { n: 1, title: 'Complete Registration Form', desc: 'Provide your professional details, background, and areas of interest.' },
  { n: 2, title: 'Upload Credentials', desc: 'Submit your qualifications, certifications, and relevant experience documentation.' },
  { n: 3, title: 'Profile Review', desc: 'Our team carefully verifies your application and credentials.' },
  { n: 4, title: 'Receive Member ID', desc: 'Get your unique IFSMHP identification number and official welcome.' },
  { n: 5, title: 'Access Dashboard', desc: 'Start uploading projects, collaborating, and accessing all member benefits.' },
];

export default function MembershipPage() {
  return (
    <>
      <section className="bg-gradient-to-br from-forum-700 to-forum-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
                <UserCheck className="h-3.5 w-3.5" />
                Membership
              </span>
              <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
                Join our global network of experts
              </h1>
              <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
                Connect with 277+ scientists and mental health professionals across
                continents. Gain the support, credentials, and platform you need to
                advance your work.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button as="link" to="/register" size="lg" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
                  Register Now
                  <ArrowRight className="h-4.5 w-4.5" />
                </Button>
                <Button
                  as="link"
                  to="/contact"
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 focus-visible:ring-white/50 bg-transparent"
                >
                  Ask a Question
                </Button>
              </div>
            </div>
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 backdrop-blur">
              <h3 className="text-lg font-semibold text-white">Who Can Join</h3>
              <ul className="mt-5 space-y-4">
                {whoCanJoin.map((p) => {
                  const Icon = p.icon;
                  return (
                    <li key={p.title} className="flex gap-3.5">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brass-500/20 text-brass-100">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{p.title}</p>
                        <p className="mt-0.5 text-sm text-forum-100/70">{p.desc}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <Section bg="paper">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-slateteal-700">
            Membership Benefits
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Everything you need to thrive
          </h2>
          <p className="mt-5 text-lg text-ink-muted">
            Six pillars of support designed to accelerate your professional impact.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.title}
                className="rounded-xl border border-paper-border bg-paper-raised p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-700">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-forum-900">{b.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {b.items.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-ink-muted">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slateteal-500" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bg="forum">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-sm font-semibold uppercase tracking-wider text-brass-700">
            How to Register
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
            Your path to membership in 5 steps
          </h2>
        </div>

        <div className="mt-14 relative">
          <div className="absolute left-6 top-6 bottom-6 w-px bg-forum-200 hidden sm:block" />
          <ol className="space-y-6 sm:space-y-8">
            {steps.map((step) => (
              <li key={step.n} className="relative flex gap-5 sm:gap-8">
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forum-600 font-display text-lg font-semibold text-white ring-4 ring-paper shadow-sm">
                  {step.n}
                </div>
                <div className="flex-1 rounded-xl border border-paper-border bg-paper-raised p-5 sm:p-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-forum-900">{step.title}</h3>
                  <p className="mt-1 text-ink-muted">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      <Section bg="raised">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-forum-700">
              Ready to begin?
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-forum-900 sm:text-4xl">
              Start your membership application today
            </h2>
            <p className="mt-5 text-lg text-ink-muted">
              Your unique IFSMHP Member ID is waiting. Complete the registration
              form, upload your credentials, and take the first step toward joining
              our global community.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as="link" to="/register" size="lg">
                <Send className="h-4.5 w-4.5" />
                Register Now
              </Button>
              {/* <Button as="link" to="/support-services" size="lg" variant="outline">
                <ShieldCheck className="h-4.5 w-4.5" />
                Explore Support Services
              </Button> */}
            </div>
          </div>
          <div className="rounded-2xl border border-forum-200 bg-forum-50/50 p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-forum-900">
              After you register
            </h3>
            <ul className="mt-5 space-y-4">
              {[
                'Applications reviewed within 3-5 business days',
                'Unique Member ID issued upon approval',
                'Full dashboard access immediately activated',
                'Welcome orientation with CRO office',
                'Official membership certificate delivered',
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-slateteal-500" />
                  <span className="text-ink-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
    </>
  );
}
