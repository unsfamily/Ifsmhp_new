import { useState } from 'react';
import {
  Search,
  FileText,
  Download,
  Share2,
  Filter,
  User,
  Calendar,
  Tag,
  BookOpenCheck,
  Eye,
  ChevronDown,
} from 'lucide-react';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

type Category = 'All' | 'Mental Health' | 'Scientific Research' | 'Product Reviews' | 'Service Analysis';

interface Publication {
  id: string;
  title: string;
  author: string;
  memberId: string;
  date: string;
  category: Exclude<Category, 'All'>;
  researchType: string;
  abstract: string;
  views: number;
  featured?: boolean;
}

const publications: Publication[] = [
  {
    id: '1',
    title: 'Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms: A Meta-Analysis',
    author: 'Dr. Sarah Chen',
    memberId: 'IFSMHP-00142',
    date: '2026-07-15',
    category: 'Mental Health',
    researchType: 'Meta-Analysis',
    abstract:
      'This comprehensive meta-analysis examines 47 randomized controlled trials evaluating cognitive behavioral therapy delivered through digital platforms. Results indicate a 34% reduction in symptom severity across anxiety and depression cohorts, with strongest outcomes observed in blended care models combining digital tools with in-person sessions.',
    views: 1247,
    featured: true,
  },
  {
    id: '2',
    title: 'Emerging Therapeutic Compounds for Treatment-Resistant Depression: Evidence Review',
    author: 'Prof. Marcus Whitfield',
    memberId: 'IFSMHP-00089',
    date: '2026-07-02',
    category: 'Scientific Research',
    researchType: 'Systematic Review',
    abstract:
      'A rigorous evidence review of novel pharmacological approaches for treatment-resistant depression, covering ketamine-derived compounds, psychedelic-assisted therapy, and neurosteroid modulators. Safety profiles, efficacy thresholds, and clinical implementation pathways are discussed.',
    views: 2103,
    featured: true,
  },
  {
    id: '3',
    title: 'Evaluating Commercial Wearable EEG Devices: Scientific Validity Assessment',
    author: 'Dr. Amara Patel',
    memberId: 'IFSMHP-00215',
    date: '2026-06-28',
    category: 'Product Reviews',
    researchType: 'Validation Study',
    abstract:
      'Five commercially available wearable EEG devices are evaluated against clinical-grade systems for signal fidelity, artifact rejection, and event-related potential detection. Findings identify meaningful accuracy gaps in consumer-grade products, particularly for frontal lobe asymmetry metrics.',
    views: 876,
    featured: true,
  },
  {
    id: '4',
    title: 'Teletherapy Service Quality Across International Platforms: Benchmarking Analysis',
    author: 'Dr. James Okafor',
    memberId: 'IFSMHP-00167',
    date: '2026-06-18',
    category: 'Service Analysis',
    researchType: 'Benchmarking',
    abstract:
      'A cross-national benchmarking of 22 teletherapy platforms across 14 countries, examining therapist credentialing, session documentation, privacy compliance, crisis response protocols, and patient-reported satisfaction scores. Significant regional variations in regulatory adherence are documented.',
    views: 654,
  },
  {
    id: '5',
    title: 'Mindfulness App Intervention Efficacy: Randomized Controlled Trial',
    author: 'Dr. Elena Rodriguez',
    memberId: 'IFSMHP-00203',
    date: '2026-06-05',
    category: 'Mental Health',
    researchType: 'RCT',
    abstract:
      'An 8-week RCT (n=342) evaluating a commercial mindfulness meditation application against a waitlist control. The intervention group demonstrated statistically significant reductions in perceived stress (p<0.001) and improved sleep quality (d=0.42).',
    views: 1532,
  },
  {
    id: '6',
    title: 'AI-Powered Mental Health Chatbots: Clinical Safety Profile Review',
    author: 'Prof. Naomi Hargrove',
    memberId: 'IFSMHP-00078',
    date: '2026-05-22',
    category: 'Product Reviews',
    researchType: 'Safety Review',
    abstract:
      'Assessment of 11 AI chatbot systems marketed for mental health support, analyzing crisis response adequacy, diagnostic accuracy claims, data encryption standards, and user disengagement protocols. Critical safety recommendations are proposed for regulatory frameworks.',
    views: 1890,
  },
  {
    id: '7',
    title: 'Post-Pandemic Youth Mental Health Service Utilization: Five-Nation Study',
    author: 'Dr. Liam Sutherland',
    memberId: 'IFSMHP-00134',
    date: '2026-05-10',
    category: 'Service Analysis',
    researchType: 'Epidemiological',
    abstract:
      'A comparative analysis of youth (14-24) mental health service utilization patterns across Australia, Canada, Germany, Singapore, and the United Kingdom, using administrative data from 2020-2025. Unmet demand correlates strongly with primary care referral pathways.',
    views: 987,
  },
  {
    id: '8',
    title: 'Blood Biomarker Panels for Major Depressive Disorder: Current Evidence Status',
    author: 'Dr. Priya Natarajan',
    memberId: 'IFSMHP-00231',
    date: '2026-04-28',
    category: 'Scientific Research',
    researchType: 'Evidence Review',
    abstract:
      'Systematic review of candidate blood-based biomarker panels (inflammatory, neurotrophic, metabolic, genetic) for major depressive disorder subtyping and treatment response prediction. Clinical readiness thresholds and validation gaps are outlined.',
    views: 2241,
  },
];

const categories: Category[] = ['All', 'Mental Health', 'Scientific Research', 'Product Reviews', 'Service Analysis'];
const researchTypes = ['All', 'Meta-Analysis', 'Systematic Review', 'RCT', 'Validation Study', 'Benchmarking', 'Safety Review', 'Epidemiological', 'Evidence Review'];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const categoryBadgeVariant: Record<Exclude<Category, 'All'>, 'default' | 'success' | 'warning' | 'info'> = {
  'Mental Health': 'info',
  'Scientific Research': 'default',
  'Product Reviews': 'warning',
  'Service Analysis': 'success',
};

export default function ResearchPublicationsPage() {
  const [category, setCategory] = useState<Category>('All');
  const [researchType, setResearchType] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = publications.filter((p) => {
    if (category !== 'All' && p.category !== category) return false;
    if (researchType !== 'All' && p.researchType !== researchType) return false;
    if (search) {
      const s = search.toLowerCase();
      if (
        !p.title.toLowerCase().includes(s) &&
        !p.author.toLowerCase().includes(s) &&
        !p.abstract.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const featured = filtered.filter((p) => p.featured);
  const rest = filtered.filter((p) => !p.featured);

  return (
    <>
      <section className="bg-gradient-to-br from-forum-700 to-forum-900">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20">
              <FileText className="h-3.5 w-3.5" />
              Research & Publications
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Latest Research & Insights
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/80">
              Access peer-reviewed papers, evidence-based reviews, and expert
              perspectives from IFSMHP members worldwide.
            </p>
          </div>
        </div>
      </section>

      <Section bg="paper" className="pb-6">
        <div className="rounded-xl border border-paper-border bg-paper-raised p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search papers, authors, keywords..."
                className="w-full rounded-md border border-paper-border bg-paper pl-10 pr-4 py-2.5 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-border bg-paper px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-700 lg:hidden"
            >
              <Filter className="h-4.5 w-4.5" />
              Filters
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          <div className={`mt-4 grid gap-4 sm:grid-cols-2 ${showFilters ? 'block' : 'hidden lg:grid'}`}>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                      category === c
                        ? 'bg-forum-600 text-white shadow-sm'
                        : 'bg-forum-50 text-forum-700 hover:bg-forum-100'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Research Type
              </label>
              <select
                value={researchType}
                onChange={(e) => setResearchType(e.target.value)}
                className="w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              >
                {researchTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-subtle">
          Showing <strong className="text-ink-muted">{filtered.length}</strong> publications
        </p>
      </Section>

      {featured.length > 0 && (
        <Section bg="raised" className="py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brass-100 text-brass-700">
              <BookOpenCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-forum-900">
                Featured Research Papers
              </h2>
              <p className="text-sm text-ink-subtle">Editor's selection</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {featured.map((p) => (
              <ArticleCard key={p.id} p={p} featured />
            ))}
          </div>
        </Section>
      )}

      <Section bg="paper" className="py-10">
        <h2 className="font-display text-2xl font-semibold text-forum-900">
          All Publications
        </h2>
        {rest.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-paper-border bg-paper-raised p-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-ink-subtle" />
            <p className="mt-4 font-medium text-ink-muted">No publications match your filters</p>
            <p className="mt-1 text-sm text-ink-subtle">Try adjusting the search or category filters.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {rest.map((p) => (
              <ArticleCard key={p.id} p={p} />
            ))}
          </div>
        )}
      </Section>

      <Section bg="forum">
        <div className="rounded-2xl bg-forum-900 p-8 sm:p-12 text-center">
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            Scientific Opinions & Reviews
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-forum-100/80">
            Expert perspectives from IFSMHP members on emerging mental health products,
            therapeutic services, research methodologies, international health policies,
            and new technologies shaping the field.
          </p>
          <div className="mt-8 flex justify-center flex-wrap gap-3">
            <Button as="link" to="/research" variant="secondary" size="lg">
              Browse Product Reviews
            </Button>
            <Button
              as="link"
              to="/register"
              size="lg"
              className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500"
            >
              Publish Your Research
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}

function ArticleCard({ p, featured = false }: { p: Publication; featured?: boolean }) {
  return (
    <article
      className={`group flex flex-col rounded-xl border bg-paper-raised shadow-sm transition-all hover:shadow-md ${
        featured ? 'border-brass-500/30 ring-1 ring-brass-500/10' : 'border-paper-border hover:border-forum-200'
      }`}
    >
      <div className="px-6 pt-5 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={categoryBadgeVariant[p.category]}>
            <Tag className="h-3 w-3 mr-1" />
            {p.category}
          </Badge>
          <Badge variant="brass">{p.researchType}</Badge>
          {featured && (
            <Badge variant="brass">
              <BookOpenCheck className="h-3 w-3 mr-1" />
              Featured
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-ink-subtle">
          <Eye className="h-3.5 w-3.5" />
          {p.views.toLocaleString()} views
        </div>
      </div>

      <div className="flex-1 px-6 pt-4 pb-6">
        <h3 className={`font-semibold text-forum-900 leading-snug ${featured ? 'text-lg sm:text-xl' : 'text-base sm:text-lg'}`}>
          {p.title}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-subtle">
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            <span className="text-ink-muted font-medium">{p.author}</span>
            <span className="text-brass-700 font-medium">{p.memberId}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(p.date)}
          </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted line-clamp-4">
          {p.abstract}
        </p>
      </div>

      <div className="border-t border-paper-border px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button size="sm" variant="primary">
            <FileText className="h-4 w-4" />
            Read Full Paper
          </Button>
          <Button size="sm" variant="outline">
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-forum-700 transition-colors"
          aria-label="Share"
        >
          <Share2 className="h-4 w-4" />
          Share
        </button>
      </div>
    </article>
  );
}
