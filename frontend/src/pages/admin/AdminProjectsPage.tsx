import { useEffect, useMemo, useState } from 'react';
import {
  FolderKanban,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  CalendarDays,
  Flag,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  AlertTriangle,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Mail,
  History,
  X,
  Loader2,
  RefreshCw,
  ArchiveRestore,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { adminApi, type AdminProjectsResult, type ProjectStatusLabel } from '../../api/admin';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';

type ProjectStatus = ProjectStatusLabel;
type Priority = 'Urgent' | 'High' | 'Standard' | 'Low';

const STATUSES: ProjectStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Published',
  'Archived',
];

const PRIORITIES: Priority[] = ['Urgent', 'High', 'Standard', 'Low'];

/** Statuses still waiting on a decision — drives SLA colouring and inline actions. */
const QUEUE_STATUSES: ProjectStatus[] = ['Submitted', 'Under Review'];

const statusConfig: Record<ProjectStatus, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: Clock },
  Submitted: { variant: 'info', icon: FileText },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Published: { variant: 'brass', icon: CheckCircle2 },
  Rejected: { variant: 'danger', icon: XCircle },
  Archived: { variant: 'default', icon: History },
};

const priorityConfig: Record<Priority, { variant: 'danger' | 'warning' | 'info' | 'default'; icon: typeof Flag }> = {
  Urgent: { variant: 'danger', icon: AlertTriangle },
  High: { variant: 'warning', icon: Flag },
  Standard: { variant: 'info', icon: Flag },
  Low: { variant: 'default', icon: Flag },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function formatDate(iso: string | null) {
  if (!iso) return 'Not submitted';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

/** `priority` is a free-form column, so an unexpected value still needs a badge. */
function priorityStyle(priority: string) {
  return priorityConfig[priority as Priority] ?? priorityConfig.Standard;
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .filter((part) => !part.endsWith('.'))
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
}

export default function AdminProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [memberFilter, setMemberFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Debounced so typing in the search or member box does not fire a request per
  // keystroke; the other filters are discrete and can apply immediately.
  const [debounced, setDebounced] = useState({ search: '', member: '' });
  useEffect(() => {
    const id = setTimeout(() => setDebounced({ search, member: memberFilter }), 300);
    return () => clearTimeout(id);
  }, [search, memberFilter]);

  const { data, loading, error } = useApiData<AdminProjectsResult>(
    () =>
      adminApi.projects({
        q: debounced.search || undefined,
        member: debounced.member || undefined,
        status: statusFilter === 'All' ? undefined : statusFilter,
        category: categoryFilter === 'All' ? undefined : categoryFilter,
        priority: priorityFilter === 'All' ? undefined : priorityFilter,
        submittedFrom: dateFrom || undefined,
        submittedTo: dateTo || undefined,
        page,
        limit: pageSize,
      }),
    [debounced, statusFilter, categoryFilter, priorityFilter, dateFrom, dateTo, page, pageSize, reloadKey],
    true,
  );

  const pageItems = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, data?.pagination.pages ?? 1);
  const safePage = data?.pagination.page ?? page;
  const startIdx = (safePage - 1) * pageSize;
  const counts = data?.counts;
  const categories = data?.categories ?? [];

  useEffect(() => { setPage(1); }, [debounced, statusFilter, categoryFilter, priorityFilter, dateFrom, dateTo, pageSize]);

  const hasActiveFilters =
    search !== '' || statusFilter !== 'All' || categoryFilter !== 'All' || memberFilter !== '' ||
    priorityFilter !== 'All' || dateFrom !== '' || dateTo !== '';

  const refresh = () => setReloadKey((k) => k + 1);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setMemberFilter('');
    setPriorityFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  /** Runs an inline decision, then reloads so the row shows the stored result. */
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

  const availableRowActions = (s: ProjectStatus) => ({
    view: true,
    startReview: s === 'Submitted',
    approve: s === 'Submitted' || s === 'Under Review',
    reject: s === 'Submitted' || s === 'Under Review',
    publish: s === 'Approved',
    archive: s === 'Published' || s === 'Rejected' || s === 'Approved',
    restore: s === 'Archived' || s === 'Draft',
  });

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Research Projects</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">Project management and review queue — triage submissions, set priority, and decide which projects advance to publication.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Syncing…' : 'Refresh'}
          </Button>
        </div>
      </div>

      {(actionError || notice) && (
        <div
          className={`rounded-lg border p-4 ${
            actionError ? 'border-danger-600/20 bg-danger-100' : 'border-success-600/20 bg-success-100'
          }`}
        >
          <p className={`text-sm ${actionError ? 'text-danger-600' : 'text-success-600'}`}>{actionError ?? notice}</p>
        </div>
      )}

      {/* ===== KPI STRIP ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total Projects', value: counts?.total, icon: FolderKanban, color: 'forum' },
          { label: 'In Review Queue', value: counts?.inReview, icon: Eye, color: 'slateteal' },
          { label: `SLA Breach (≥${counts?.slaTargetDays ?? '—'}d)`, value: counts?.slaBreach, icon: AlertTriangle, color: 'danger' as const, warn: true },
          { label: 'Urgent Priority', value: counts?.urgent, icon: Flag, color: 'brass' },
          { label: 'Approved', value: counts?.approved, icon: CheckCircle2, color: 'success' as const },
          { label: 'Published', value: counts?.published, icon: FileText, color: 'forum' },
        ].map((k) => {
          const Icon = k.icon;
          const bgMap: Record<string, string> = {
            forum: 'bg-forum-50 text-forum-700',
            slateteal: 'bg-slateteal-100 text-slateteal-700',
            brass: 'bg-brass-100 text-brass-700',
            success: 'bg-success-100 text-success-600',
            danger: 'bg-danger-100 text-danger-600',
          };
          return (
            <Card key={k.label} className={k.warn && (k.value ?? 0) > 0 ? 'border-warning-600/30 ring-2 ring-warning-100' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bgMap[k.color as keyof typeof bgMap]}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  {k.warn && (k.value ?? 0) > 0 && <Badge variant="warning">Action</Badge>}
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value ?? '—'}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== FILTERS CARD ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput placeholder="Search project title, member, description…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={filtersOpen ? 'primary' : 'outline'} size="sm" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter className="h-3.5 w-3.5" />
              {filtersOpen ? 'Hide Filters' : 'More Filters'}
            </Button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900">
                <X className="h-3 w-3" />Clear all
              </button>
            )}
          </div>
        </CardHeader>
        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SelectInput label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'All')}>
                <option value="All">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectInput>
              <SelectInput label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="All">All Categories</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
              <TextInput
                label="Member"
                placeholder="Name or Member ID"
                value={memberFilter}
                onChange={(e) => setMemberFilter(e.target.value)}
              />
              <SelectInput label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'All')}>
                <option value="All">All Priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectInput>
              <TextInput label="Submitted From" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <TextInput label="Submitted To" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </CardContent>
          </div>
        )}
      </Card>

      {/* ===== PROJECTS TABLE ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-forum-600" />
              Project Review Queue
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{pageItems.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{total}</span> projects
              {hasActiveFilters && <> · <span className="text-brass-700 font-medium">filters applied</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows</label>
            <SelectInput value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : pageItems.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle min-w-[280px]">Project</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell min-w-[180px]">Member</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Category</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Submitted</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Priority</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((p) => {
                      const sConf = statusConfig[p.status];
                      const SIcon = sConf.icon;
                      const pConf = priorityStyle(p.priority);
                      const PIcon = pConf.icon;
                      const act = availableRowActions(p.status);
                      const isMenuOpen = menuOpenFor === p.id;
                      const inQueue = QUEUE_STATUSES.includes(p.status);
                      const slaWarn = inQueue && p.queueDays >= 5;
                      const slaDanger = inQueue && p.queueDays >= 7;
                      const busy = busyId === p.id;
                      const memberName = p.member ?? 'Unknown member';
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 relative"
                          onMouseLeave={() => isMenuOpen && setMenuOpenFor(null)}
                        >
                          <td className="py-3.5 px-2 align-top">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 h-10 w-10 shrink-0 flex items-center justify-center rounded-lg ${p.priority === 'Urgent' ? 'bg-danger-100 text-danger-600' : p.priority === 'High' ? 'bg-warning-100 text-warning-600' : 'bg-forum-50 text-forum-700'}`}>
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-forum-900 leading-snug">
                                  <Link to={`/admin/projects/${p.id}`} className="hover:text-forum-600 hover:underline">{p.title}</Link>
                                </p>
                                <p className="text-xs text-ink-muted mt-1 line-clamp-2 max-w-xl leading-snug">{p.description}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{p.views} views</span>
                                  {p.support.length > 0 && (
                                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{p.support.join(', ')}</span>
                                  )}
                                  {inQueue && (
                                    <span className={`inline-flex items-center gap-1 font-semibold ${slaDanger ? 'text-danger-600' : slaWarn ? 'text-warning-600' : 'text-ink-muted'}`}>
                                      <Clock className="h-3 w-3" />{p.queueDays}d in queue
                                      {slaDanger && <Badge variant="danger" className="!text-[10px]">SLA</Badge>}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden sm:table-cell align-top">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink inline-flex items-center gap-1.5">
                                <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold">
                                  {initialsOf(memberName)}
                                </span>
                                {memberName}
                              </p>
                              <code className="text-[11px] font-mono text-ink-subtle truncate">{p.memberId ?? 'No Member ID'}</code>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <Badge variant="info">{p.category}</Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell align-top">
                            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(p.submitted)}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={sConf.variant}>
                              <SIcon className="h-3 w-3 mr-1" />
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <Badge variant={pConf.variant}>
                              <PIcon className="h-3 w-3 mr-1" />
                              {p.priority}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 align-top text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {act.startReview && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runRowAction(
                                    p.id,
                                    () => adminApi.transitionProject(p.id, 'UNDER_REVIEW'),
                                    `"${p.title}" moved to Under Review.`,
                                    'Could not move that project into review.',
                                  )}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-warning-100 px-2 py-1 text-xs font-semibold text-warning-700 hover:bg-warning-600 hover:text-white transition-colors disabled:opacity-50"
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                                  Start Review
                                </button>
                              )}
                              {act.approve && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => runRowAction(
                                    p.id,
                                    () => adminApi.approveProject(p.id),
                                    `"${p.title}" approved — the member has been notified.`,
                                    'Could not approve that project.',
                                  )}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors disabled:opacity-50"
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                  Approve
                                </button>
                              )}
                              <Link
                                to={`/admin/projects/${p.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors"
                              >
                                {inQueue ? <ShieldCheck className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {inQueue ? 'Review' : 'View'}
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuOpenFor(isMenuOpen ? null : p.id); }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 mt-1 w-56 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MenuAction to={`/admin/projects/${p.id}`} icon={Eye} label="Open project details" />
                                    {act.startReview && (
                                      <MenuButton
                                        icon={Clock}
                                        label="Mark Under Review"
                                        disabled={busy}
                                        onClick={() => runRowAction(
                                          p.id,
                                          () => adminApi.transitionProject(p.id, 'UNDER_REVIEW'),
                                          `"${p.title}" moved to Under Review.`,
                                          'Could not move that project into review.',
                                        )}
                                      />
                                    )}
                                    <div className="my-1 border-t border-paper-border" />
                                    {act.approve && (
                                      <MenuButton
                                        icon={CheckCircle2}
                                        label="Approve project"
                                        tone="success"
                                        disabled={busy}
                                        onClick={() => runRowAction(
                                          p.id,
                                          () => adminApi.approveProject(p.id),
                                          `"${p.title}" approved — the member has been notified.`,
                                          'Could not approve that project.',
                                        )}
                                      />
                                    )}
                                    {/* Rejection needs written reasons, so it happens on the detail screen. */}
                                    {act.reject && <MenuAction to={`/admin/projects/${p.id}`} icon={XCircle} label="Request revision / reject" tone="danger" />}
                                    {act.publish && (
                                      <MenuButton
                                        icon={FileText}
                                        label="Send to publication"
                                        tone="success"
                                        disabled={busy}
                                        onClick={() => runRowAction(
                                          p.id,
                                          () => adminApi.transitionProject(p.id, 'PUBLISHED'),
                                          `"${p.title}" published.`,
                                          'Could not publish that project.',
                                        )}
                                      />
                                    )}
                                    <div className="my-1 border-t border-paper-border" />
                                    {act.archive && (
                                      <MenuButton
                                        icon={History}
                                        label="Archive"
                                        tone="warning"
                                        disabled={busy}
                                        onClick={() => runRowAction(
                                          p.id,
                                          () => adminApi.transitionProject(p.id, 'ARCHIVED'),
                                          `"${p.title}" archived.`,
                                          'Could not archive that project.',
                                        )}
                                      />
                                    )}
                                    {act.restore && p.status === 'Rejected' && (
                                      <MenuButton
                                        icon={ArchiveRestore}
                                        label="Reopen as draft"
                                        tone="info"
                                        disabled={busy}
                                        onClick={() => runRowAction(
                                          p.id,
                                          () => adminApi.transitionProject(p.id, 'DRAFT'),
                                          `"${p.title}" reopened as a draft.`,
                                          'Could not reopen that project.',
                                        )}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== PAGINATION ===== */}
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-paper-border pt-4">
                <p className="text-xs text-ink-subtle">
                  Showing <span className="font-semibold text-ink-muted">{startIdx + 1}</span>–
                  <span className="font-semibold text-ink-muted">{startIdx + pageItems.length}</span> of{' '}
                  <span className="font-semibold text-ink-muted">{total}</span> projects
                </p>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={safePage === 1}>
                    <ArrowLeft className="h-3.5 w-3.5" />First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" />Prev
                  </Button>
                  <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                    Next<ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                    Last<ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (n: number) => void }) {
  const range = useMemo(() => {
    const pages: (number | '…')[] = [];
    const add = (n: number | '…') => pages.push(n);
    const ws = 1;
    const start = Math.max(2, page - ws);
    const end = Math.min(totalPages - 1, page + ws);
    add(1);
    if (start > 2) add('…');
    for (let i = start; i <= end; i++) add(i);
    if (end < totalPages - 1) add('…');
    if (totalPages > 1) add(totalPages);
    return pages;
  }, [page, totalPages]);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      {range.map((p, i) => p === '…'
        ? <span key={`e${i}`} className="px-2 text-xs text-ink-subtle">…</span>
        : <button key={p} onClick={() => onChange(p)} className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors ${p === page ? 'bg-forum-600 text-white shadow-sm' : 'border border-paper-border text-ink-muted hover:bg-forum-50 hover:text-forum-900'}`}>{p}</button>)
      }
    </div>
  );
}

type MenuTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

const menuToneClasses: Record<MenuTone, string> = {
  default: 'text-ink hover:bg-forum-50 hover:text-forum-900',
  success: 'text-success-600 hover:bg-success-100',
  warning: 'text-warning-600 hover:bg-warning-100',
  danger: 'text-danger-600 hover:bg-danger-100',
  info: 'text-slateteal-700 hover:bg-slateteal-100',
};

function MenuAction({ to, icon: Icon, label, tone = 'default' }: { to: string; icon: typeof Eye; label: string; tone?: MenuTone }) {
  return (
    <Link to={to} className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${menuToneClasses[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Link>
  );
}

/** Same look as MenuAction, but performs a transition instead of navigating. */
function MenuButton({ icon: Icon, label, onClick, tone = 'default', disabled }: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  tone?: MenuTone;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-left transition-colors disabled:opacity-50 ${menuToneClasses[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
      <div className="text-center"><p className="text-sm font-medium text-forum-900">Loading projects…</p><p className="text-xs text-ink-subtle mt-1">Fetching research project queue</p></div>
      <div className="mt-4 w-full max-w-3xl space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg border border-paper-border bg-paper animate-pulse" />)}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-7 w-7" /></div>
      <div className="text-center max-w-md"><p className="text-base font-semibold text-forum-900">Couldn't load the project queue</p><p className="text-sm text-ink-muted mt-1">{message ?? 'Check your network connection and try again. If the error persists, contact technical support.'}</p></div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={onRetry}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
        <Button as="link" to="/admin/support" size="sm" variant="ghost"><Mail className="h-3.5 w-3.5" />Contact support</Button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700"><FolderKanban className="h-8 w-8" /></div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">{hasFilters ? 'No projects match your filters' : 'No projects yet'}</p>
        <p className="text-sm text-ink-muted mt-1">{hasFilters ? 'Try clearing filters or broadening the search range.' : 'Project submissions will appear here as members submit them.'}</p>
      </div>
      {hasFilters && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={onClear}><X className="h-3.5 w-3.5" />Clear filters</Button>
        </div>
      )}
    </div>
  );
}

function Filter({ className = '' }: { className?: string }) {
  return <FilterIcon className={className} />;
}

function FilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
