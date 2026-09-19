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
  ArrowLeft,
  ExternalLink,
  Link2,
  Loader2,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import Section from '../../components/common/Section';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import researchBackgroundImage from '../../assets/images/research.png';
import {
  doiUrl,
  publicApi,
  publicationFileUrl,
  type Paginated,
  type PublicPublication,
  type PublicPublicationDetail,
} from '../../api/public';
import { useApiData } from '../../hooks/useApiData';
import { formatBytes } from '../../utils/formatBytes';

type Category = 'All' | 'Mental Health' | 'Scientific Research' | 'Product Reviews' | 'Service Analysis';

type Publication = PublicPublication;

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
  // `/research/:id` and `/research` share this component; the param is what
  // decides whether a single paper or the listing is rendered.
  const { id } = useParams();
  if (id) return <PublicationDetail slugOrId={id} />;
  return <PublicationList />;
}

function PublicationList() {
  const [category, setCategory] = useState<Category>('All');
  const [researchType, setResearchType] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [author, setAuthor] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { data, loading, error } = useApiData<Paginated<Publication>>(
    () => publicApi.publications({ category, researchType, q: search, author: author || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [category, researchType, search, author, dateFrom, dateTo],
  );

  const filtered = data?.items ?? [];

  // The strip above highlights a subset; "All Publications" below is the whole
  // list, featured papers included — filtering them out of it left the section
  // empty whenever every published paper happened to be featured.
  const featured = filtered.filter((p) => p.featured);

  const hasActiveFilters =
    category !== 'All' || researchType !== 'All' || search.trim() !== ''
    || author.trim() !== '' || dateFrom !== '' || dateTo !== '';

  const clearFilters = () => {
    setCategory('All');
    setResearchType('All');
    setSearch('');
    setAuthor('');
    setDateFrom('');
    setDateTo('');
  };

  /** True only until the first payload lands — `data` survives later refetches. */
  const firstLoad = loading && !data;

  return (
    <>
      <section
        className="relative isolate overflow-hidden"
        style={{
          backgroundImage: `url(${researchBackgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Dark blue + gold tinted overlay so white copy stays legible over the photo */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(1,37,89,0.90) 0%, rgba(1,37,89,0.82) 45%, rgba(1,37,89,0.62) 78%, rgba(195,157,73,0.18) 100%), linear-gradient(180deg, rgba(1,37,89,0.22) 0%, rgba(1,37,89,0.48) 100%)',
          }}
        />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-brass-100 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
              <FileText className="h-3.5 w-3.5" />
              Research & Publications
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-tight text-white sm:text-5xl">
              Latest Research & Insights
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-forum-100/85">
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

          <div className={`mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${showFilters ? 'block' : 'hidden lg:grid'}`}>
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
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Search by author..."
                className="w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Date Published
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="From"
                  className="flex-1 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="To"
                  className="flex-1 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm shadow-sm transition-colors focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
                />
              </div>
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
        {firstLoad ? (
          <div className="mt-8 grid gap-6 lg:grid-cols-2" aria-busy="true" aria-label="Loading publications">
            {[0, 1].map((key) => (
              <div key={key} className="h-64 animate-pulse rounded-xl border border-paper-border bg-paper-raised" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 rounded-xl border border-dashed border-paper-border bg-paper-raised p-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-danger-600" />
            <p className="mt-4 font-medium text-forum-900">Couldn&apos;t load publications</p>
            <p className="mt-1 text-sm text-ink-subtle">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed border-paper-border bg-paper-raised p-16 text-center">
            <FileText className="mx-auto h-12 w-12 text-ink-subtle" />
            {/* "Nothing published yet" and "nothing matched" are different
                answers; blaming filters that are not set reads as a fault. */}
            <p className="mt-4 font-medium text-ink-muted">
              {hasActiveFilters ? 'No publications match your filters' : 'No publications yet'}
            </p>
            <p className="mt-1 text-sm text-ink-subtle">
              {hasActiveFilters
                ? 'Try adjusting the search or category filters.'
                : 'Published research from IFSMHP members will appear here.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-5" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {filtered.map((p) => (
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

/** Copies a paper's public URL, briefly flipping the button to confirm. */
async function share(slugOrId: string, setCopied: (v: boolean) => void) {
  try {
    await navigator.clipboard?.writeText(`${window.location.origin}/research/${slugOrId}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  } catch {
    // Clipboard access can be denied; the link is in the address bar regardless.
  }
}

function ArticleCard({ p, featured = false }: { p: Publication; featured?: boolean }) {
  const [copied, setCopied] = useState(false);
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
          <Link to={`/research/${p.id}`} className="transition-colors hover:text-forum-700">
            {p.title}
          </Link>
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
          <Button size="sm" variant="primary" as="link" to={`/research/${p.id}`}>
            <FileText className="h-4 w-4" />
            Read Full Paper
          </Button>
          {/* Hidden rather than disabled when there is no manuscript — a dead
              control is worse than an absent one. */}
          {p.hasManuscript && (
            <a
              href={publicationFileUrl(p.id)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-border bg-paper px-3 py-1.5 text-sm font-semibold text-forum-700 transition-colors hover:bg-forum-50"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
          )}
        </div>
        <button
          type="button"
          onClick={() => void share(p.id, setCopied)}
          className="inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-forum-700 transition-colors"
          aria-label="Copy link to this paper"
        >
          {copied ? <Link2 className="h-4 w-4 text-forum-700" /> : <Share2 className="h-4 w-4" />}
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>
    </article>
  );
}

/**
 * A single paper at /research/:slug.
 *
 * The body is resolved in order of fidelity: the manuscript the author uploaded,
 * then the stored full text, then the DOI landing page. Only when a paper has
 * none of the three does it say so — and the abstract stays readable regardless.
 */
function PublicationDetail({ slugOrId }: { slugOrId: string }) {
  const [copied, setCopied] = useState(false);
  const { data: p, loading, error } = useApiData<PublicPublicationDetail>(
    () => publicApi.publication(slugOrId),
    [slugOrId],
  );

  if (loading) {
    return (
      <Section bg="paper" className="py-24">
        <div className="flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-forum-600" />
          <p className="text-sm font-medium text-forum-900">Loading paper…</p>
        </div>
      </Section>
    );
  }

  if (error || !p) {
    return (
      <Section bg="paper" className="py-24">
        <div className="mx-auto max-w-lg rounded-xl border border-dashed border-paper-border bg-paper-raised p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-ink-subtle" />
          <p className="mt-4 font-medium text-forum-900">Paper not found</p>
          <p className="mt-1 text-sm text-ink-subtle">
            This paper may not be published, or the link may be out of date.
          </p>
          <Button as="link" to="/research" variant="outline" size="sm" className="mt-6">
            <ArrowLeft className="h-4 w-4" />
            Back to research
          </Button>
        </div>
      </Section>
    );
  }

  const manuscript = p.files?.find((f) => f.kind === 'MANUSCRIPT' && f.url);

  return (
    <>
      <section className="bg-gradient-to-br from-forum-700 to-forum-900">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
          <Link to="/research" className="inline-flex items-center gap-1.5 text-sm text-forum-100/80 transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back to Research
          </Link>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge variant={categoryBadgeVariant[p.category] ?? 'default'}>
              <Tag className="h-3 w-3 mr-1" />
              {p.category}
            </Badge>
            <Badge variant="brass">{p.researchType}</Badge>
          </div>
          <h1 className="mt-5 text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {p.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-forum-100/80">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-4 w-4" />
              {p.author}
              {p.memberId && <span className="font-medium text-brass-100">{p.memberId}</span>}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(p.date)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4" />
              {p.views.toLocaleString()} views
            </span>
            {p.downloads > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-4 w-4" />
                {p.downloads.toLocaleString()} downloads
              </span>
            )}
          </div>
        </div>
      </section>

      <Section bg="paper" className="py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            {manuscript && (
              <>
                <a
                  href={publicationFileUrl(p.slug ?? p.id, { inline: true })}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-forum-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-forum-900"
                >
                  <FileText className="h-4 w-4" />
                  Read the manuscript
                </a>
                <a
                  href={publicationFileUrl(p.slug ?? p.id)}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-border bg-paper px-4 py-2.5 text-sm font-semibold text-forum-700 transition-colors hover:bg-forum-50"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                  <span className="text-xs font-normal text-ink-subtle">{formatBytes(manuscript.sizeBytes)}</span>
                </a>
              </>
            )}
            {p.doi && (
              <a
                href={doiUrl(p.doi)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-md border border-paper-border bg-paper px-4 py-2.5 text-sm font-semibold text-forum-700 transition-colors hover:bg-forum-50"
              >
                <ExternalLink className="h-4 w-4" />
                DOI: {p.doi}
              </a>
            )}
            <button
              type="button"
              onClick={() => void share(p.slug ?? p.id, setCopied)}
              className="inline-flex items-center gap-1.5 px-2 text-sm text-ink-subtle transition-colors hover:text-forum-700"
              aria-label="Copy link to this paper"
            >
              {copied ? <Link2 className="h-4 w-4 text-forum-700" /> : <Share2 className="h-4 w-4" />}
              {copied ? 'Link copied' : 'Share'}
            </button>
          </div>

          <div className="mt-8 rounded-xl border border-paper-border bg-paper-raised p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-forum-900">Abstract</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{p.abstract}</p>
          </div>

          {p.fullText ? (
            <div className="mt-6 rounded-xl border border-paper-border bg-paper-raised p-6 sm:p-8">
              <h2 className="font-display text-lg font-semibold text-forum-900">Full Paper</h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">{p.fullText}</div>
            </div>
          ) : !manuscript && !p.doi ? (
            <div className="mt-6 rounded-xl border border-dashed border-paper-border bg-paper-raised p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-ink-subtle" />
              <p className="mt-3 font-medium text-ink-muted">The full paper isn&apos;t available yet</p>
              <p className="mt-1 text-sm text-ink-subtle">
                Only the abstract has been published for this work. Check back later, or contact the author.
              </p>
            </div>
          ) : null}

          {p.files && p.files.length > 1 && (
            <p className="mt-6 text-xs text-ink-subtle">
              Supplementary material accompanies this paper; contact the author for access.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
