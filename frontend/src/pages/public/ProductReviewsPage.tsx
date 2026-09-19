import { useMemo, useState } from 'react';
import {
  Search,
  Filter,
  ChevronDown,
  Star,
  Calendar,
  User,
  ThumbsUp,
  MessageSquare,
  X,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  BadgeCheck,
  ArrowLeft,
  Clock,
  Tag,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Card, CardHeader, CardContent } from '../../components/common/Card';

type ReviewCategory =
  | 'all'
  | 'products'
  | 'services'
  | 'methodologies'
  | 'policies'
  | 'technologies';

const CATEGORY_DEFS: Array<{
  key: ReviewCategory;
  label: string;
  headline: string;
  description: string;
  icon: string;
  gradient: string;
  count: number;
}> = [
  {
    key: 'all',
    label: 'All Reviews',
    headline: 'All expert perspectives',
    description: 'Combined perspectives from every review pillar across the IFSMHP member network.',
    icon: 'Sparkles',
    gradient: 'from-forum-600 via-slateteal-500 to-brass-400',
    count: 82,
  },
  {
    key: 'products',
    label: 'New mental health products',
    headline: 'New mental health products',
    description:
      'Independent assessments of digital therapeutics, pharmacological innovations, wearables, and at-home interventions by clinicians and methodologists.',
    icon: 'ShieldCheck',
    gradient: 'from-forum-700 via-forum-500 to-slateteal-500',
    count: 24,
  },
  {
    key: 'services',
    label: 'Therapeutic services',
    headline: 'Therapeutic services',
    description:
      'Member evaluations of clinic networks, teletherapy providers, inpatient programmes, and peer-support services across 14 countries.',
    icon: 'BadgeCheck',
    gradient: 'from-forum-600 via-slateteal-500 to-brass-400',
    count: 18,
  },
  {
    key: 'methodologies',
    label: 'Research methodologies',
    headline: 'Research methodologies',
    description:
      'Critical appraisals of study design, measurement instruments, qualitative protocols, and mixed-methods approaches used in recent trials.',
    icon: 'Sparkles',
    gradient: 'from-brass-700 via-brass-500 to-brass-200',
    count: 16,
  },
  {
    key: 'policies',
    label: 'International health policies',
    headline: 'International health policies',
    description:
      'Policy briefs and comparative reviews of national mental health legislation, insurance reform, and intergovernmental frameworks.',
    icon: 'ShieldCheck',
    gradient: 'from-slateteal-700 via-forum-700 to-forum-900',
    count: 14,
  },
  {
    key: 'technologies',
    label: 'Emerging technologies in mental health',
    headline: 'Emerging technologies in mental health',
    description:
      'First looks at AI-assisted triage, immersive VR exposure therapy, predictive analytics, sensor-based monitoring, and digital biomarkers.',
    icon: 'BadgeCheck',
    gradient: 'from-brass-500 via-forum-600 to-forum-800',
    count: 10,
  },
];

interface ProductReview {
  id: string;
  title: string;
  author: string;
  authorRole: string;
  category: Exclude<ReviewCategory, 'all'>;
  subjects: string[];
  rating: number;
  publishedAt: string;
  readMinutes: number;
  endorsements: number;
  comments: number;
  summary: string;
  pros: string[];
  cons: string[];
  verdict: string;
  methodology: string;
  ethics: string;
  conflicts: string;
  tags: string[];
  featured: boolean;
  region: string;
}

const REVIEWS: ProductReview[] = [
  {
    id: 'pr-2026-001',
    title: 'CBT-Digital Therapist v4.2 — A pragmatic RCT replication across three outpatient clinics',
    author: 'Dr. Priya Natarajan',
    authorRole: 'Associate Professor of Clinical Psychology, India',
    category: 'products',
    subjects: ['Digital CBT', 'Outpatient anxiety', 'App-based therapy'],
    rating: 4,
    publishedAt: '2026-08-06',
    readMinutes: 9,
    endorsements: 47,
    comments: 12,
    summary:
      'A well-powered replication (n=318) finds the 8-module programme non-inferior to face-to-face CBT on GAD-7 at 12 weeks, though engagement drops sharply after module 4 for younger users.',
    pros: [
      'Clinician-grade session summaries integrate with EHRs',
      'Transparent measurement-burst design with weekly PHQ-9/GAD-7',
      'Culturally adapted vignettes in 6 languages',
    ],
    cons: [
      '41% 8-week dropout without booster prompts',
      'Nudging algorithms favour content over rest days',
      'Accessibility gaps for screen-reader users',
    ],
    verdict:
      'Recommended as a first-line digital adjunct in busy clinics, provided programmes pair it with fortnightly human check-ins and a stepped-care exit path.',
    methodology:
      'Parallel-arm pragmatic RCT with blinded outcome assessors; intention-to-treat plus complier-average causal effect analysis.',
    ethics:
      'Approved under IRB protocol IFSMHP-2026-017; digital informed consent with 72-hour cooling-off option.',
    conflicts:
      'No manufacturer funding; devices provided under an independent evaluation grant administered by IFSMHP Scientific Advisory Board.',
    tags: ['RCT', 'Anxiety', 'Digital-Therapeutic', 'App', 'Stepped-Care'],
    featured: true,
    region: 'Oceania',
  },
  {
    id: 'pr-2026-002',
    title: 'Skyline Teletherapy Network — Access, continuity, and therapeutic alliance across rural catchments',
    author: 'Prof. Harold M. Okafor',
    authorRole: 'Chair of Global Mental Health, IFSMHP Africa Regional Hub',
    category: 'services',
    subjects: ['Teletherapy', 'Rural access', 'Therapeutic alliance'],
    rating: 4,
    publishedAt: '2026-07-22',
    readMinutes: 8,
    endorsements: 38,
    comments: 9,
    summary:
      'Review of 2,400 matched cases across 11 regional hubs: alliance ratings (WAI-SF) remain within 0.2 SD of in-person care, though crisis follow-through remains a persistent gap.',
    pros: [
      'Stable platform uptime >99.6% across low-bandwidth regions',
      'Clinician rostering prioritises same-language practitioners',
      'Integrated referral handoff to local psychiatric services',
    ],
    cons: [
      'After-hours crisis response median 3h 40m',
      'Billing reconciliation errors for 8% of insurance claims',
      'No dedicated adolescent supervision pathway',
    ],
    verdict:
      'A strong tier-2 teletherapy provider for regional and rural members; consider negotiating a dedicated crisis SLA before institutional contracting.',
    methodology:
      'Retrospective matched-cohort study with inverse-probability weighting; triangulated with qualitative interviews of 72 clinicians.',
    ethics:
      'Secondary use de-identified data approved under hub-wide IRB umbrella IFSMHP-AFR-2025-031.',
    conflicts: 'Hub holds no equity or commercial relationship; review under independent member-services contract.',
    tags: ['Teletherapy', 'Rural', 'Alliance', 'Health-Services', 'Crisis'],
    featured: true,
    region: 'Sub-Saharan Africa',
  },
  {
    id: 'pr-2026-003',
    title: 'Experience-Sampling Measurement platforms — Comparing Momentum, DiaryFlow, and PsycESM on construct validity',
    author: 'Dr. Saskia van der Meer',
    authorRole: 'Senior Lecturer in Quantitative Methods, University of Groningen',
    category: 'methodologies',
    subjects: ['ESM', 'Ecological momentary assessment', 'Construct validity'],
    rating: 5,
    publishedAt: '2026-07-11',
    readMinutes: 12,
    endorsements: 61,
    comments: 18,
    summary:
      'Head-to-head multitrait-multimethod comparison across three ESM platforms with 394 undergraduates finds converging validity acceptable, but recommends prespecifying delivery schedule and imputation model before fielding.',
    pros: [
      'All three platforms pass minimum convergent validity thresholds',
      'DiaryFlow offers open export + reproducible analytic pipelines',
      'Momentum handles planned missing designs natively',
    ],
    cons: [
      'PsycESM proprietary algorithms make replication difficult',
      'Battery drain on Android devices under 10-prompt/day schedules',
      'Training cost for qualitative coding add-ons is non-trivial',
    ],
    verdict:
      'A methodological landmark for ESM adopters. Members planning large-scale deployments should pre-register delivery windows, imputation, and device stratification.',
    methodology:
      'Multitrait-multimethod matrix + Bayesian multilevel confirmatory factor models with platform as a design factor.',
    ethics: 'Ethics review delegated to local review board (EC-RUG-2025-1142) with fully informed opt-in.',
    conflicts: 'No manufacturer involvement; instruments licensed under IFSMHP methodology shared-services grant.',
    tags: ['ESM', 'Methodology', 'Validity', 'Multilevel', 'Pre-Registration'],
    featured: false,
    region: 'Europe',
  },
  {
    id: 'pr-2026-004',
    title: 'EU Mental Health Strategy (2026–2032) — Implementability and alignment with national capacity',
    author: 'Dr. Elena Marchetti',
    authorRole: 'Senior Policy Fellow, IFSMHP Brussels Office',
    category: 'policies',
    subjects: ['EU policy', 'Mental health strategy', 'Implementation'],
    rating: 3,
    publishedAt: '2026-06-28',
    readMinutes: 11,
    endorsements: 29,
    comments: 14,
    summary:
      'The framework sets admirable headline targets but under-funds frontline workforce pipelines; 7 of 27 member states report no earmarked national budget lines at six months post-adoption.',
    pros: [
      'Explicit parity commitments with physical health in 6 legislative domains',
      'Strong youth and digital-literacy annexes',
      'Annual reporting mandate linked to semester-cycle governance',
    ],
    cons: [
      'No ring-fenced EU structural funds allocation',
      'Workforce targets are non-binding and conflict with austerity budgets',
      'Migration mental health annex relies on voluntary opt-ins',
    ],
    verdict:
      'Strategically useful as an advocacy template, but members active at member-state level should push for binding fiscal annexes before the 2028 midpoint review.',
    methodology:
      'Document analysis + key-informant interviews (n=34) across DGs, permanent representations, and national mental health alliances.',
    ethics: 'Falls under policy-evaluation exemption; human subjects recorded with informed consent.',
    conflicts: 'Research supported by unrestricted IFSMHP policy programme grant; no industry co-funding.',
    tags: ['Policy', 'EU', 'Workforce', 'Funding', 'Advocacy'],
    featured: true,
    region: 'European Union',
  },
  {
    id: 'pr-2026-005',
    title: 'VR-PTSD Exposure Suite (Clinic Edition) — Clinical safety, presence, and predictor modelling',
    author: 'Dr. Alistair Chen-Mendes',
    authorRole: 'Consultant Clinical Psychologist, Toronto Western Hospital',
    category: 'technologies',
    subjects: ['VR', 'Exposure therapy', 'PTSD'],
    rating: 4,
    publishedAt: '2026-06-14',
    readMinutes: 10,
    endorsements: 54,
    comments: 16,
    summary:
      '90-session observational study with 30 veterans finds 62% reliable change on PCL-5; simulator sickness is well-contained but clinician-initiated halt procedures remain essential.',
    pros: [
      'Gradient exposure authoring tool with 30 licensed environments',
      'Integrated heart-rate variability biofeedback on headset',
      'Session exportable for case-formulation review',
    ],
    cons: [
      'Headset weight and fit issues for users with glasses',
      'Authored scenes cannot be shared across sites without a licence tier',
      'Limited validated protocols for complex dissociative presentations',
    ],
    verdict:
      'Worth licensing for specialised trauma clinics with VR-experienced clinicians; defer generalist rollout until cross-hardware scene interoperability improves.',
    methodology:
      'Pre-post observational study with reliable-change indices and elastic-net adverse-event prediction models.',
    ethics:
      'Hospital research ethics board review (REB #2025-0328) with enhanced adverse-event monitoring protocol.',
    conflicts: 'Site licences provided at 50% discount under independent evaluation clause; no personal compensation.',
    tags: ['VR', 'PTSD', 'Exposure', 'Technology', 'Adverse-Events'],
    featured: false,
    region: 'North America',
  },
  {
    id: 'pr-2026-006',
    title: 'Long-acting injectable antipsychotics formulary update — Comparative real-world persistence across three jurisdictions',
    author: 'Dr. Ngozi Adebayo',
    authorRole: 'Associate Professor of Pharmacotherapy, University of Lagos',
    category: 'products',
    subjects: ['Pharmacotherapy', 'LAI', 'Real-world evidence'],
    rating: 4,
    publishedAt: '2026-05-30',
    readMinutes: 9,
    endorsements: 31,
    comments: 7,
    summary:
      '12-month persistence rates 18–27 percentage points higher than matched oral regimens; regional supply-chain fragility offsets gains in low-income settings.',
    pros: [
      'Consistent persistence advantage across all three sites',
      'Audit-friendly administration logs for community teams',
      'Subgroup effects strongest for first-episode cohorts',
    ],
    cons: [
      'Cold-chain gaps in rural clusters mean 11% stock-out events',
      'Formulary negotiations with payers take >120 days median',
      'Training burden on community nurses is under-estimated',
    ],
    verdict:
      'Strong formulary candidate if bundled with supply-chain resilience investment and nurse-delivered shared-decision aid kits.',
    methodology:
      'Propensity-score matched real-world cohort (n=1,240) across Lagos, Kuala Lumpur, and Vancouver.',
    ethics: 'Multisite IRB approvals with cross-recognition under IFSMHP harmonisation protocol.',
    conflicts: 'Unrestricted investigator-initiated grant; pharma-provided molecules only through standard tender channels.',
    tags: ['Pharmacology', 'Real-World', 'Formulary', 'Equity', 'Nursing'],
    featured: false,
    region: 'Global',
  },
  {
    id: 'pr-2026-007',
    title: 'Youth Peer-Support Accreditation Programme — Fidelity and 12-month outcomes',
    author: 'Dr. Lina Park',
    authorRole: 'Senior Research Fellow, Centre for Adolescent Mental Health',
    category: 'services',
    subjects: ['Peer support', 'Youth', 'Accreditation'],
    rating: 4,
    publishedAt: '2026-05-17',
    readMinutes: 7,
    endorsements: 42,
    comments: 11,
    summary:
      'Fidelity-rated sites show reliable reductions on internalising symptom clusters at 6 and 12 months, but turnover of peer workers remains a structural challenge.',
    pros: [
      'Fidelity manual + video review coaching model',
      'Strong lived-experience governance on curriculum steering',
      'Low per-participant cost compared to outpatient groups',
    ],
    cons: [
      '38% annualised peer-worker turnover',
      'Transition to formal clinical roles has no mapped career ladder',
      'Crisis escalation plans vary widely across sites',
    ],
    verdict:
      'Commendable model; commission with a two-year workforce retention component rather than one-year outcome-only contracts.',
    methodology:
      'Hybrid cluster implementation-effectiveness design with stepped-wedge rollout across 9 community sites.',
    ethics:
      'Lived-experience co-design ethics protocol approved; peer-reviewers included on the consenting team.',
    conflicts: 'Programme delivered under independent evaluation contract; no employment links to accrediting body.',
    tags: ['Youth', 'Peer-Support', 'Implementation', 'Lived-Experience'],
    featured: false,
    region: 'East Asia',
  },
  {
    id: 'pr-2026-008',
    title: 'Adaptive Survey Platforms — Differential coverage error in nationally representative mental health surveys',
    author: 'Dr. Rafael Duarte Costa',
    authorRole: 'Associate Professor of Survey Methodology, University of São Paulo',
    category: 'methodologies',
    subjects: ['Survey methods', 'Adaptive design', 'Coverage error'],
    rating: 5,
    publishedAt: '2026-05-02',
    readMinutes: 11,
    endorsements: 28,
    comments: 6,
    summary:
      'Simulations on five recent national surveys show adaptive allocation recovers 5–8% of latent coverage bias in hard-to-reach subgroups; recommends mandatory sensitivity reporting.',
    pros: [
      'Open-source allocation engine compatible with major survey packages',
      'Reporting templates for Kish-effective sample size and balance diagnostics',
      'Frame-mismatch diagnostics flag frame error early',
    ],
    cons: [
      'Requires two-phase budget commitment from commissioners',
      'Analysts need 3–5 day training bootcamp',
      'Weighting workflow still relies on proprietary modules',
    ],
    verdict:
      'Should become the default adaptive design for members fielding national mental health prevalence instruments in 2027.',
    methodology:
      'Simulations calibrated to five completed national surveys; external replication on two independent data holdings.',
    ethics: 'Secondary-use de-identified data with institutional data steward sign-off.',
    conflicts: 'Methodology research funded under IFSMHP measurement programme; no vendor ties.',
    tags: ['Survey', 'Methods', 'Adaptive', 'Coverage', 'Weights'],
    featured: false,
    region: 'Latin America',
  },
  {
    id: 'pr-2026-009',
    title: 'AI Symptom Checker Triage (v3) — Evaluating false-negative rates across seven primary-care cohorts',
    author: 'Dr. Miriam Goldberg',
    authorRole: 'Director of Health AI Assurance, IFSMHP Centre for Digital Ethics',
    category: 'technologies',
    subjects: ['AI', 'Triage', 'Primary care', 'Safety'],
    rating: 3,
    publishedAt: '2026-04-18',
    readMinutes: 10,
    endorsements: 59,
    comments: 22,
    summary:
      'Top-quartile accuracy on common presentations, but 11.2% false-negative rate for suicidal ideation prompts on adolescent presentations — a threshold current deployments do not adequately mitigate.',
    pros: [
      'Transparent feature attributions for clinicians via printout',
      '21 languages with dialect models',
      'Interoperable with HL7 FHIR message flows',
    ],
    cons: [
      'Clinically meaningful missed-cases rate in adolescent mood presentations',
      'Audit trails for override decisions are truncated by default',
      'Pricing scales per encounter, not per site, penalising safety-net clinics',
    ],
    verdict:
      'Use only with mandatory two-person clinical review for all flagged under-25 mood cases; require vendor to publish quarterly safety audits under contract.',
    methodology:
      'Retrospective ground-truth benchmarking across seven primary-care EHR corpora; case-note review of discordant pairs.',
    ethics: 'Data access under patient-safety governance with de-identification and audit logging.',
    conflicts: 'Assurance work conducted under IFSMHP digital ethics programme; vendor has no oversight of report.',
    tags: ['AI', 'Safety', 'Triage', 'Primary-Care', 'Audit'],
    featured: true,
    region: 'Global',
  },
  {
    id: 'pr-2026-010',
    title: 'Australia National Mental Health Workforce Strategy 2026 — Budget realism and pipeline modelling',
    author: 'Dr. Eleanor Ross-Wright',
    authorRole: 'Professor of Health Systems, India & IFSMHP Workforce Observatory',
    category: 'policies',
    subjects: ['Workforce', 'Australia', 'Budget', 'Pipeline'],
    rating: 4,
    publishedAt: '2026-04-04',
    readMinutes: 9,
    endorsements: 22,
    comments: 8,
    summary:
      'Strategy targets are achievable under steady-state assumptions, but not under the modelled 15% demand-growth scenario; requires additional supervised registrar placements in rural hubs.',
    pros: [
      'First national linked workforce pipeline model with 10-year horizon',
      'Aboriginal and Torres Strait Islander workforce targets with cultural governance',
      'Telework incentive stipulations for regional placements',
    ],
    cons: [
      'No graduate-entry bursary expansion beyond pilot sites',
      'Supervision caps will bind in psychiatry and clinical psychology',
      'Workload metrics do not price in documentation burden inflation',
    ],
    verdict:
      'A credible, well-modelled strategy; budget the 2027 mid-cycle refresh to cover supervision and bursary expansion.',
    methodology:
      'Linked health-workforce stock-flow model with three demand scenarios; sensitivity-tested against Commonwealth budget assumptions.',
    ethics: 'No human subjects; publicly available workforce microdata aggregated to cells.',
    conflicts: 'Observatory funded through independent IFSMHP endowment; no government consulting contracts.',
    tags: ['Workforce', 'Policy', 'Australia', 'Budget', 'Pipeline'],
    featured: false,
    region: 'Oceania',
  },
];

const ORDER_OPTIONS = [
  { key: 'recent', label: 'Most recent' },
  { key: 'rated', label: 'Highest rated' },
  { key: 'endorsed', label: 'Most endorsed' },
  { key: 'discussed', label: 'Most discussed' },
] as const;

type OrderKey = (typeof ORDER_OPTIONS)[number]['key'];

const CATEGORY_KEY_TO_LABEL = Object.fromEntries(
  CATEGORY_DEFS.filter((c) => c.key !== 'all').map((c) => [c.key, c.label]),
) as Record<Exclude<ReviewCategory, 'all'>, string>;

function categoryVariant(cat: Exclude<ReviewCategory, 'all'>): 'info' | 'success' | 'brass' | 'warning' | 'default' {
  switch (cat) {
    case 'products':
      return 'info';
    case 'services':
      return 'success';
    case 'methodologies':
      return 'brass';
    case 'policies':
      return 'warning';
    case 'technologies':
      return 'default';
  }
}

function stars(n: number) {
  return Array.from({ length: 5 }, (_, i) => i < n);
}

const PAGE_TITLE_INTRO = 'Expert perspectives from IFSMHP members on:';

export default function ProductReviewsPage() {
  const [activeCategory, setActiveCategory] = useState<ReviewCategory>('all');
  const [order, setOrder] = useState<OrderKey>('recent');
  const [query, setQuery] = useState('');
  const [minRating, setMinRating] = useState(0);
  const [mobileFilters, setMobileFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortOpen, setSortOpen] = useState(false);

  const activeCategoryDef = CATEGORY_DEFS.find((c) => c.key === activeCategory) ?? CATEGORY_DEFS[0]!;

  const filtered = useMemo(() => {
    let list = [...REVIEWS];
    if (activeCategory !== 'all') list = list.filter((r) => r.category === activeCategory);
    if (minRating > 0) list = list.filter((r) => r.rating >= minRating);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) =>
        [r.title, r.summary, r.author, r.authorRole, r.subjects.join(' '), r.tags.join(' '), r.region]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    switch (order) {
      case 'rated':
        list.sort((a, b) => b.rating - a.rating || b.endorsements - a.endorsements);
        break;
      case 'endorsed':
        list.sort((a, b) => b.endorsements - a.endorsements);
        break;
      case 'discussed':
        list.sort((a, b) => b.comments - a.comments);
        break;
      case 'recent':
      default:
        list.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    }
    return list;
  }, [activeCategory, order, query, minRating]);

  const selected = selectedId ? REVIEWS.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div id="main" className="bg-paper text-ink">
      <section className="bg-gradient-to-br from-forum-700 via-forum-800 to-forum-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <Sparkles className="h-3.5 w-3.5" />
              IFSMHP Expert Reviews
            </span>
            <h1 className="mt-6 font-display text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-[3.25rem]">
              {PAGE_TITLE_INTRO}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-relaxed text-forum-100/80">
              Independent, methodologically grounded perspectives from IFSMHP clinicians, researchers and policy fellows.
            </p>
            <ul className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-2">
              {CATEGORY_DEFS.filter((c) => c.key !== 'all').map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory(c.key);
                      window.requestAnimationFrame(() => {
                        document.getElementById('reviews-filter-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                    }}
                    className={`group flex h-full w-full items-start gap-3 rounded-2xl border p-5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 ${
                      activeCategory === c.key
                        ? 'border-brass-500/80 bg-white/10 ring-1 ring-brass-500/40'
                        : 'border-white/10 bg-white/5 hover:bg-white/10'
                    }`}
                  >
                    <span
                      className={`mt-1 inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg shadow-black/20 ${c.gradient}`}
                    >
                      {c.icon === 'ShieldCheck' ? (
                        <ShieldCheck className="h-5 w-5" />
                      ) : c.icon === 'BadgeCheck' ? (
                        <BadgeCheck className="h-5 w-5" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                    </span>
                    <span className="flex-1">
                      <span className="block font-display text-xl font-semibold text-white">{c.label}</span>
                      <p className="mt-1.5 text-sm text-forum-100/80">{c.description}</p>
                      <p className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brass-100 group-hover:underline">
                        {c.count} reviews · Browse now →
                      </p>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <Section bg="paper" className="py-10 lg:py-14">
        <div id="reviews-filter-anchor" className="lg:grid lg:grid-cols-12 lg:gap-8">
          <aside className="lg:col-span-3">
            <div className="sticky top-4 space-y-6">
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <h3 className="font-display text-lg">Browse by category</h3>
                  <button
                    type="button"
                    onClick={() => setMobileFilters((s) => !s)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-paper px-3 py-1.5 text-xs font-semibold text-ink lg:hidden"
                  >
                    <Filter className="h-3.5 w-3.5" /> Filters
                    <ChevronDown className={`h-3.5 w-3.5 transition ${mobileFilters ? 'rotate-180' : ''}`} />
                  </button>
                </CardHeader>
                <CardContent className={`${mobileFilters ? 'block' : 'hidden'} lg:block`}>
                  <ul className="space-y-1.5">
                    {CATEGORY_DEFS.map((c) => (
                      <li key={c.key}>
                        <button
                          type="button"
                          onClick={() => setActiveCategory(c.key)}
                          className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition ${
                            activeCategory === c.key
                              ? 'bg-forum-50 text-forum-900 ring-1 ring-forum-200'
                              : 'hover:bg-paper-raised text-ink'
                          }`}
                        >
                          <span className="font-medium">{c.label}</span>
                          <Badge variant={c.key === 'all' ? 'default' : categoryVariant(c.key as Exclude<ReviewCategory, 'all'>)}>
                            {c.count}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className={`${mobileFilters ? 'block' : 'hidden'} lg:block`}>
                <CardHeader>
                  <h3 className="font-display text-lg">Minimum rating</h3>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[0, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r)}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          minRating === r
                            ? 'border-forum-400 bg-forum-50 text-forum-900'
                            : 'border-ink-line bg-paper text-ink hover:bg-paper-raised'
                        }`}
                      >
                        {r === 0 ? 'Any rating' : <>
                          {Array.from({ length: r }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-brass-500 stroke-brass-700" />
                          ))}
                          {r === 3 ? '3+ stars' : r === 4 ? '4+ stars' : '5 stars'}
                        </>}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className={`${mobileFilters ? 'block' : 'hidden'} lg:block`}>
                <CardHeader>
                  <h3 className="font-display text-lg">Disclosure policy</h3>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-ink-subtle">
                  <p>
                    All member reviewers operate under the <span className="font-semibold text-ink">IFSMHP Review Independence Protocol</span>:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 flex-none text-forum-600" /> Mandatory conflict-of-interest disclosure per review.</li>
                    <li className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 flex-none text-slateteal-600" /> Dual member-editor blind sign-off before publication.</li>
                    <li className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 flex-none text-brass-500" /> Methodological appendices and protocol pre-registrations linked where available.</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </aside>

          <div className="mt-8 space-y-6 lg:col-span-9 lg:mt-0">
            <div className="flex flex-col gap-4 rounded-2xl border border-ink-line bg-paper-raised p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search titles, authors, tags, regions…"
                  className="w-full rounded-xl border border-ink-line bg-paper py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-subtle focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                />
              </div>
              <div className="relative">
                <button
                  onClick={() => setSortOpen((s) => !s)}
                  className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-ink-line bg-paper px-3 py-2.5 text-sm font-medium text-ink hover:bg-paper-raised sm:w-52"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Filter className="h-4 w-4 text-ink-subtle" />
                    {ORDER_OPTIONS.find((o) => o.key === order)?.label}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition ${sortOpen ? 'rotate-180' : ''}`} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 z-10 mt-2 w-full min-w-[14rem] overflow-hidden rounded-xl border border-ink-line bg-paper shadow-lg sm:w-56">
                    {ORDER_OPTIONS.map((o) => (
                      <button
                        key={o.key}
                        onClick={() => {
                          setOrder(o.key);
                          setSortOpen(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm transition ${
                          order === o.key ? 'bg-forum-50 text-forum-900' : 'text-ink hover:bg-paper-raised'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-ink-subtle">
                Showing <span className="font-semibold text-ink">{filtered.length}</span> of {REVIEWS.length} reviews ·&nbsp;
                <span className="text-forum-700">{activeCategoryDef.label}</span>
              </div>
              {(query || activeCategory !== 'all' || minRating > 0) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQuery('');
                    setActiveCategory('all');
                    setMinRating(0);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Sparkles className="mx-auto h-10 w-10 text-ink-subtle/60" />
                  <h4 className="mt-4 font-display text-xl">No reviews match your filters.</h4>
                  <p className="mt-2 max-w-xl mx-auto text-sm text-ink-subtle">
                    Try a broader category, lower the rating threshold, or adjust your search query.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setQuery(''); setMinRating(0); }}>Reset filters</Button>
                    <Button variant="primary" size="sm" as="link" to="/research">
                      <ChevronRight className="h-4 w-4" /> Return to Research
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ul className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <Card className="group h-full border-ink-line/80 transition hover:border-forum-300 hover:shadow-md">
                      <CardContent className="flex h-full flex-col gap-4">
                        <div className="flex items-start justify-between gap-3">
                          <Badge variant={categoryVariant(r.category)} className="gap-1.5 text-[11px] uppercase tracking-wider">
                            {CATEGORY_KEY_TO_LABEL[r.category]}
                          </Badge>
                          <div className="flex items-center gap-0.5" aria-label={`${r.rating} of 5 stars`}>
                            {stars(r.rating).map((filled, i) => (
                              <Star
                                key={i}
                                className={`h-3.5 w-3.5 ${filled ? 'fill-brass-500 stroke-brass-700' : 'stroke-ink-subtle/40'}`}
                              />
                            ))}
                          </div>
                        </div>
                        <button type="button" onClick={() => setSelectedId(r.id)} className="text-left">
                          <h3 className="font-display text-xl leading-snug text-ink group-hover:text-forum-800">
                            {r.title}
                          </h3>
                        </button>
                        <p className="text-sm leading-relaxed text-ink-subtle">{r.summary}</p>
                        <ul className="flex flex-wrap gap-1.5">
                          {r.subjects.slice(0, 3).map((s) => (
                            <li key={s}>
                              <Badge variant="default" className="!text-[11px]">
                                <Tag className="h-3 w-3" /> {s}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink-line/70 pt-4">
                          <div className="flex items-center gap-2.5 text-xs text-ink-subtle">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-[11px] font-semibold text-white">
                              {r.author.split(' ').slice(-2).map((p) => p[0]).join('')}
                            </span>
                            <div className="leading-tight">
                              <div className="font-semibold text-ink">{r.author}</div>
                              <div>{r.authorRole}</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-subtle">
                            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{r.publishedAt}</span>
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{r.readMinutes} min</span>
                            <span className="inline-flex items-center gap-1 text-forum-700"><ThumbsUp className="h-3 w-3" />{r.endorsements}</span>
                            <span className="inline-flex items-center gap-1 text-slateteal-700"><MessageSquare className="h-3 w-3" />{r.comments}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Badge variant="info" className="gap-1 text-[11px]">{r.region}</Badge>
                          <Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>
                            Read full review <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {selected && (
        <ReviewDetailModal review={selected} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function ReviewDetailModal({ review, onClose }: { review: ProductReview; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-forum-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-ink-line bg-paper shadow-2xl sm:max-w-4xl sm:rounded-3xl">
        <header className="flex items-start justify-between gap-4 border-b border-ink-line bg-forum-50/40 px-5 py-4 sm:px-8 sm:py-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={categoryVariant(review.category)}>
                {CATEGORY_KEY_TO_LABEL[review.category]}
              </Badge>
              <Badge variant="default">{review.region}</Badge>
              <span className="inline-flex items-center gap-0.5">
                {stars(review.rating).map((filled, i) => (
                  <Star key={i} className={`h-4 w-4 ${filled ? 'fill-brass-500 stroke-brass-700' : 'stroke-ink-subtle/40'}`} />
                ))}
              </span>
            </div>
            <h2 className="font-display text-2xl leading-snug text-ink sm:text-3xl">
              {review.title}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{review.author} · {review.authorRole}</span>
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{review.publishedAt}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{review.readMinutes} min read</span>
              <span className="inline-flex items-center gap-1 text-forum-700"><ThumbsUp className="h-3.5 w-3.5" />{review.endorsements} endorsements</span>
              <span className="inline-flex items-center gap-1 text-slateteal-700"><MessageSquare className="h-3.5 w-3.5" />{review.comments} comments</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-ink-line bg-paper text-ink-subtle hover:text-ink hover:bg-paper-raised"
            aria-label="Close review"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <section className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><h3 className="font-display text-lg">Executive summary</h3></CardHeader>
                <CardContent className="text-sm leading-relaxed text-ink">{review.summary}</CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="font-display text-lg">Editorial verdict</h3></CardHeader>
                <CardContent className="text-sm leading-relaxed text-ink">
                  <p className="before:mr-2 before:text-brass-500 before:font-serif before:text-2xl before:leading-none before:content-['“']">
                    {review.verdict}
                  </p>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader><h3 className="font-display text-lg">Strengths</h3></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-ink">
                    {review.pros.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-success-100 text-success-700">+</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="font-display text-lg">Limitations</h3></CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-ink">
                    {review.cons.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-danger-100 text-danger-700">−</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><h3 className="font-display text-lg">Methodological approach</h3></CardHeader>
                <CardContent className="text-sm leading-relaxed text-ink">{review.methodology}</CardContent>
              </Card>
              <Card>
                <CardHeader><h3 className="font-display text-lg">Ethics & governance</h3></CardHeader>
                <CardContent className="text-sm leading-relaxed text-ink">{review.ethics}</CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><h3 className="font-display text-lg">Conflict of interest & funding</h3></CardHeader>
              <CardContent className="text-sm leading-relaxed text-ink">{review.conflicts}</CardContent>
            </Card>
            <div className="flex flex-wrap gap-2">
              {review.tags.map((t) => (
                <Badge key={t} variant="default" className="gap-1 text-[11px] uppercase tracking-wider">
                  <Tag className="h-3 w-3" /> {t}
                </Badge>
              ))}
            </div>
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-line bg-paper-raised px-5 py-4 sm:px-8">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" /> Back to reviews
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm"><ThumbsUp className="h-4 w-4" /> Endorse review</Button>
            <Button variant="primary" size="sm"><MessageSquare className="h-4 w-4" /> Join the discussion</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
