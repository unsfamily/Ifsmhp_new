import { useEffect, useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Globe2,
  Ban,
  Filter,
  Loader2,
  RefreshCw,
  AlertCircle,
  BookOpenCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import {
  adminApi,
  type AdminPublicationRow,
  type AdminPublicationsResult,
  type PublicationStatusLabel,
} from '../../api/admin';
import { normalizeError } from '../../api/client';
import { PUBLICATION_CATEGORIES, PUBLICATION_STATUS_LABELS } from '../../api/publications';
import { useApiData } from '../../hooks/useApiData';
import { formatBytes } from '../../utils/formatBytes';

type Status = 'All' | PublicationStatusLabel;
type Queue = 'review' | 'published' | 'all';

const PAGE_SIZE = 20;

/** Days a manuscript may sit in the queue before the wait is worth flagging. */
const QUEUE_WARN_DAYS = 8;

const statusConfig: Record<PublicationStatusLabel, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: Clock },
  Submitted: { variant: 'info', icon: FileText },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Published: { variant: 'brass', icon: Globe2 },
  Rejected: { variant: 'danger', icon: XCircle },
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

/** Initials from a full name, for the author avatar chip. */
const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';

export default function AdminPublicationsPage() {
  const [tab, setTab] = useState<Queue>('review');
  const [status, setStatus] = useState<Status>('All');
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [showCategory, setShowCategory] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // One request per pause in typing, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change restarts paging; otherwise page 2 of the old filter leaks in.
  useEffect(() => { setPage(1); }, [tab, status, category, debouncedSearch]);

  const { data, loading, error } = useApiData<AdminPublicationsResult>(
    () =>
      adminApi.publications({
        queue: tab,
        status: status === 'All' ? undefined : status,
        category: category === 'All' ? undefined : category,
        q: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [tab, status, category, debouncedSearch, page, reloadKey],
  );

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, data?.pagination.pages ?? 1);
  const safePage = data?.pagination.page ?? page;

  const hasActiveFilters = status !== 'All' || category !== 'All' || search.trim() !== '';
  const clearFilters = () => { setStatus('All'); setCategory('All'); setSearch(''); };
  const refresh = () => setReloadKey((key) => key + 1);

  /** Runs one inline decision, then reloads so the row shows what was stored. */
  const runRowAction = async (id: string, call: () => Promise<unknown>, success: string, failure: string) => {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await call();
      setNotice(success);
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || failure);
    } finally {
      setBusyId(null);
    }
  };

  const avgReview = counts?.avgReviewDays;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          {
            label: 'In Review Queue',
            value: counts ? counts.inReview.toString() : '—',
            icon: FileText,
            color: 'forum',
            note: counts ? `${counts.approved} approved, ready to publish` : 'Awaiting a decision',
          },
          {
            label: 'Published This Month',
            value: counts ? counts.publishedThisMonth.toString() : '—',
            icon: Globe2,
            color: 'brass',
            note: counts ? `${counts.published} published in total` : 'Live on the public site',
          },
          {
            label: 'Total Public Views',
            value: counts ? counts.totalViews.toLocaleString() : '—',
            icon: Eye,
            color: 'slateteal',
            note: 'All published work',
          },
          {
            label: 'Avg. Review Time',
            value: !counts ? '—' : avgReview === null ? 'No data' : `${avgReview} days`,
            icon: Clock,
            color: 'forum',
            note: 'Submission to approval',
          },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}>
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {(actionError || notice) && (
        <div className={`rounded-lg border p-4 ${actionError ? 'border-danger-600/20 bg-danger-100' : 'border-success-600/20 bg-success-100'}`}>
          <p className={`text-sm ${actionError ? 'text-danger-600' : 'text-success-600'}`}>{actionError ?? notice}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex gap-1 rounded-lg bg-forum-50 p-1">
                {(['review', 'published', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize ${
                      tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'
                    }`}
                  >
                    {t === 'review'
                      ? `Review Queue${counts ? ` (${counts.inReview + counts.approved})` : ''}`
                      : t === 'published'
                      ? `Published${counts ? ` (${counts.published})` : ''}`
                      : 'All Submissions'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search title, author, venue, DOI…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full sm:w-40">
                {(['All', ...PUBLICATION_STATUS_LABELS] as Status[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>)}
              </SelectInput>
              <SelectInput
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={`w-full sm:w-44 ${showCategory ? 'block' : 'hidden md:block'}`}
              >
                <option value="All">All Categories</option>
                {PUBLICATION_CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
              </SelectInput>
              <button
                type="button"
                onClick={() => setShowCategory((open) => !open)}
                aria-label="Toggle category filter"
                aria-expanded={showCategory}
                className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-sm text-ink-muted hover:bg-forum-50 md:hidden"
              >
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            {loading && !data ? 'Loading publications…' : <>Showing <strong className="text-ink-muted">{rows.length}</strong> of <strong className="text-ink-muted">{total}</strong></>}
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="ml-2 font-medium text-forum-700 underline underline-offset-2 hover:text-forum-900">
                Clear filters
              </button>
            )}
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {loading && !data ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : rows.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Publication</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Author</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Category</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Queue</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((p: AdminPublicationRow) => {
                      const sc = statusConfig[p.status] ?? statusConfig.Draft;
                      const SIcon = sc.icon;
                      const queueWarn = ['Submitted', 'Under Review'].includes(p.status) && p.queueDays >= QUEUE_WARN_DAYS;
                      const busy = busyId === p.id;
                      return (
                        <tr key={p.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                          <td className="py-3.5 px-2 max-w-xl">
                            <div>
                              <p className="font-medium text-forum-900 leading-snug">{p.title}</p>
                              <p className="text-xs text-ink-subtle mt-0.5 flex items-center gap-2 flex-wrap">
                                <Badge variant="info" className="!py-0">{p.researchType}</Badge>
                                {p.status === 'Published' && p.slug && <code className="font-mono text-[10px] text-ink-subtle bg-paper px-1.5 py-0.5 rounded">/research/{p.slug}</code>}
                                {p.status !== 'Published' && p.pdfSize > 0 && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />PDF: {formatBytes(p.pdfSize)}</span>}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden sm:table-cell">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {initialsOf(p.author ?? '')}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm text-ink truncate">{p.author ?? 'Unknown author'}</p>
                                <p className="text-[10px] text-ink-subtle font-mono truncate">{p.memberId ?? '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell text-sm text-ink-muted">{p.category}</td>
                          <td className="py-3.5 px-2">
                            <Badge variant={sc.variant}>
                              <SIcon className="h-3 w-3 mr-1" />
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell">
                            {['Submitted', 'Under Review'].includes(p.status) ? (
                              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${queueWarn ? 'text-warning-600' : 'text-ink-muted'}`}>
                                <Clock className="h-3.5 w-3.5" />
                                {p.queueDays}d
                                {queueWarn && <Badge variant="warning" className="ml-1 !text-[10px]">Slow</Badge>}
                              </span>
                            ) : p.status === 'Published' ? (
                              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3 text-brass-700" />
                                {formatDate(p.publishedAt)}
                              </span>
                            ) : p.status === 'Approved' ? (
                              <Badge variant="brass">Ready to publish</Badge>
                            ) : (
                              <span className="text-xs text-ink-subtle">{formatDate(p.submittedAt)}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <Link
                                to={`/admin/publications/${p.id}`}
                                className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-50 transition-colors"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                Review
                              </Link>
                              {p.status === 'Submitted' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="!px-2.5 !py-1 !text-xs"
                                  disabled={busy}
                                  onClick={() => void runRowAction(p.id, () => adminApi.transitionPublication(p.id, 'UNDER_REVIEW'), 'Moved into review.', 'Could not start the review.')}
                                >
                                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                  Start Review
                                </Button>
                              )}
                              {['Submitted', 'Under Review'].includes(p.status) && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  className="!px-2.5 !py-1 !text-xs"
                                  disabled={busy}
                                  onClick={() => void runRowAction(p.id, () => adminApi.approvePublication(p.id), 'Publication approved.', 'Could not approve this publication.')}
                                >
                                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                  Approve
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {p.status === 'Approved' && (
                                <Button
                                  size="sm"
                                  className="!px-2.5 !py-1 !text-xs bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500"
                                  disabled={busy}
                                  onClick={() => void runRowAction(p.id, () => adminApi.publishPublication(p.id), 'Published to the public site.', 'Could not publish this publication.')}
                                >
                                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe2 className="h-3.5 w-3.5" />}
                                  Publish
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {p.status === 'Published' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="!px-2.5 !py-1 !text-xs border-warning-600/40 text-warning-700 hover:bg-warning-100"
                                  disabled={busy}
                                  onClick={() => void runRowAction(p.id, () => adminApi.unpublishPublication(p.id), 'Removed from the public listing.', 'Could not unpublish this publication.')}
                                >
                                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                                  Unpublish
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper-border pt-4">
                  <p className="text-xs text-ink-subtle">Page {safePage} of {totalPages}</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={safePage <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" disabled={safePage >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 py-4" aria-busy="true" aria-label="Loading publications">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="flex items-center gap-3">
          <div className="h-10 flex-1 animate-pulse rounded border border-paper-border bg-paper" />
          <div className="h-10 w-28 animate-pulse rounded border border-paper-border bg-paper hidden sm:block" />
          <div className="h-10 w-24 animate-pulse rounded border border-paper-border bg-paper" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="py-12 text-center">
      <AlertCircle className="mx-auto h-12 w-12 text-danger-600" />
      <h3 className="mt-4 font-semibold text-forum-900">Couldn&apos;t load the publications queue</h3>
      <p className="mt-1 text-sm text-ink-muted">{message}</p>
      <Button variant="outline" className="mt-5" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-12 text-center">
      <BookOpenCheck className="mx-auto h-12 w-12 text-ink-subtle" />
      <h3 className="mt-4 font-semibold text-forum-900">
        {hasFilters ? 'No publications match your filters' : 'Nothing in this queue'}
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        {hasFilters
          ? 'Try adjusting the search or filters.'
          : 'Manuscripts appear here as soon as members submit them for review.'}
      </p>
      {hasFilters && (
        <Button variant="outline" className="mt-5" onClick={onClear}>Clear filters</Button>
      )}
    </div>
  );
}
