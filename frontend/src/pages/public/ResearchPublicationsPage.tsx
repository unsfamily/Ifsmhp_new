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
import { publicApi } from '../../api/public';
import { useApiData } from '../../hooks/useApiData';

type Category = 'All' | 'Mental Health' | 'Scientific Research' | 'Product Reviews' | 'Service Analysis';

interface Publication {
  id: string;
  title: string;
  author: string;
  memberId: string;
  date: string | Date;
  category: string;
  researchType: string;
  abstract: string;
  views: number;
  featured?: boolean;
}

const categories: Category[] = ['All', 'Mental Health', 'Scientific Research', 'Product Reviews', 'Service Analysis'];
const researchTypes = ['All', 'Meta-Analysis', 'Systematic Review', 'RCT', 'Validation Study', 'Benchmarking', 'Safety Review', 'Epidemiological', 'Evidence Review'];

function formatDate(dateStr: string | Date) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const categoryBadgeVariant: Record<string, 'default' | 'success' | 'warning' | 'info'> = {
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
  const { data, loading, error } = useApiData<{ items: Publication[] }>(
    () => publicApi.publications({ category, researchType, q: search }) as Promise<{ items: Publication[] }>,
    [category, researchType, search],
  );

  const filtered = data?.items ?? [];

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
          {loading ? 'Loading publications...' : <>Showing <strong className="text-ink-muted">{filtered.length}</strong> publications</>}
          {error ? <span className="ml-2 text-danger-600">{error}</span> : null}
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
            <Button as="link" to="/product-reviews" variant="secondary" size="lg">
              Browse Product Reviews
            </Button>
            {/* <Button
              as="link"
              to="/register"
              size="lg"
              className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500"
            >
              Publish Your Research
            </Button> */}
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
          <Badge variant={categoryBadgeVariant[p.category] ?? 'default'}>
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
