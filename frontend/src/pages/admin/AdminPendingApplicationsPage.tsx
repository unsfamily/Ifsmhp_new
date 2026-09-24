import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
  UserX,
  UserCheck,
  RefreshCw,
  Mail,
  AlertCircle,
  CalendarDays,
  Globe2,
  Loader2,
  X,
  SlidersHorizontal,
  GraduationCap,
  Briefcase,
  AlertTriangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { adminApi, type AdminMembersResult, type ApplicationStatusLabel, type ApplicationPriority } from '../../api/admin';
import { useApiData } from '../../hooks/useApiData';

const statusBadgeMap: Record<ApplicationStatusLabel, 'info' | 'warning' | 'success' | 'danger'> = {
  Pending: 'info',
  'Under Review': 'warning',
  Approved: 'success',
  Rejected: 'danger',
};

const priorityBadgeMap: Record<ApplicationPriority, 'default' | 'warning' | 'danger'> = {
  Standard: 'default',
  High: 'warning',
  Urgent: 'danger',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function AdminPendingApplicationsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicationStatusLabel>('Pending');
  const [priorityFilter, setPriorityFilter] = useState<'All' | ApplicationPriority>('All');
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Debounced so typing in the search box does not fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Filtering and paging are done by the server: the queue can outgrow any one
  // page, so narrowing only the rows already fetched would quietly lie.
  const { data, loading, error } = useApiData<AdminMembersResult>(
    () =>
      adminApi.members({
        applicationStatus: statusFilter,
        professionalType: typeFilter,
        priority: priorityFilter,
        submittedFrom,
        submittedTo,
        q: debouncedSearch,
        page,
        limit: pageSize,
      }),
    [statusFilter, typeFilter, priorityFilter, submittedFrom, submittedTo, debouncedSearch, page, pageSize, reloadKey],
    true,
  );

  const rows = data?.items ?? [];
  const counts = data?.counts;
  const totalPages = data?.pagination.pages ?? 1;
  const total = data?.pagination.total ?? 0;
  const typeOptions = data?.professionalTypes ?? [];

  useEffect(() => {
    setPage(1);
  }, [statusFilter, typeFilter, priorityFilter, submittedFrom, submittedTo, debouncedSearch, pageSize]);

  const hasActiveFilters =
    search !== '' ||
    typeFilter !== 'All' ||
    statusFilter !== 'Pending' ||
    priorityFilter !== 'All' ||
    submittedFrom !== '' ||
    submittedTo !== '';

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('All');
    setStatusFilter('Pending');
    setPriorityFilter('All');
    setSubmittedFrom('');
    setSubmittedTo('');
  };

  const refresh = () => setReloadKey((k) => k + 1);

  const formatSubmitted = (iso: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  /** Approve straight from the queue; the full review lives on the detail page. */
  const quickApprove = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      const result = await adminApi.approveMember(id);
      // The member is approved either way; only the notification may have failed.
      if (result.emailSent) {
        setNotice(`Approved — Member ID ${result.memberId} issued and the member has been emailed.`);
      } else {
        setActionError(
          `Approved and Member ID ${result.memberId} issued, but the acknowledgement email could not be sent. Open the review to retry.`,
        );
      }
      refresh();
    } catch {
      setActionError('Could not approve that application. Try opening the full review.');
    } finally {
      setBusyId(null);
    }
  };

  const startReview = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      await adminApi.reviewMember(id);
      refresh();
    } catch {
      setActionError('Could not move that application to review.');
    } finally {
      setBusyId(null);
    }
  };

  const showing = useMemo(() => {
    if (total === 0) return { from: 0, to: 0 };
    const from = (page - 1) * pageSize + 1;
    return { from, to: Math.min(from + rows.length - 1, total) };
  }, [page, pageSize, rows.length, total]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Link to="/admin/members" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              Full directory<ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            Pending Applications
          </h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Review and triage incoming member applications — approvals generate Member IDs, rejections require a written reason.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-lg border border-success-600/20 bg-success-100 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
          <p className="text-sm text-success-600">{notice}</p>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'In Queue', value: counts?.inQueue, icon: Users, color: 'forum' },
          { label: 'New (Pending)', value: counts?.pending, icon: Clock, color: 'brass' },
          { label: 'Under Review', value: counts?.underReview, icon: Eye, color: 'warning' },
          { label: 'Approved Today', value: counts?.approvedToday, icon: CheckCircle2, color: 'success' },
        ].map((k) => {
          const Icon = k.icon;
          const bgMap: Record<string, string> = {
            forum: 'bg-forum-50 text-forum-700',
            brass: 'bg-brass-100 text-brass-700',
            success: 'bg-success-100 text-success-600',
            warning: 'bg-warning-100 text-warning-600',
          };
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-forum-900">
                      {k.value ?? (loading ? '—' : 0)}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">{k.label}</p>
                  </div>
                  <div className={`h-9 w-9 flex items-center justify-center rounded-lg ${bgMap[k.color]}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle z-10" />
            <TextInput
              placeholder="Search applicant name, email or institution…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={filtersOpen ? 'primary' : 'outline'} size="sm" onClick={() => setFiltersOpen((v) => !v)}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filtersOpen ? 'Hide Filters' : 'Filters'}
              <Filter className="h-3.5 w-3.5" />
            </Button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
        </CardHeader>
        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectInput
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | ApplicationStatusLabel)}
              >
                <option value="All">All Statuses</option>
                <option>Pending</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Rejected</option>
              </SelectInput>
              <SelectInput
                label="Priority"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as 'All' | ApplicationPriority)}
              >
                <option value="All">All Priorities</option>
                <option>Urgent</option>
                <option>High</option>
                <option>Standard</option>
              </SelectInput>
              {/* Options come from the data, so they match what applicants chose. */}
              <SelectInput label="Professional Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="All">All Types</option>
                {typeOptions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </SelectInput>
              <div />
              <TextInput
                label="Submitted From"
                type="date"
                value={submittedFrom}
                onChange={(e) => setSubmittedFrom(e.target.value)}
              />
              <TextInput
                label="Submitted To"
                type="date"
                value={submittedTo}
                onChange={(e) => setSubmittedTo(e.target.value)}
              />
              <div className="sm:col-span-2 flex flex-wrap gap-2 items-end">
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('Pending'); setPriorityFilter('Urgent'); }}>
                  Show urgent pending
                </Button>
                <Button variant="outline" size="sm" onClick={() => setStatusFilter('Under Review')}>
                  In review
                </Button>
              </div>
            </CardContent>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-forum-600" />
              Application Queue
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{rows.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{total}</span> applications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows</label>
            <SelectInput value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
              <p className="text-sm text-ink-muted">Loading application queue…</p>
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
                <AlertCircle className="h-8 w-8" />
              </div>
              <p className="text-base font-semibold text-forum-900">Could not load applications</p>
              <p className="text-sm text-ink-muted max-w-md text-center">{error}</p>
              <Button size="sm" variant="outline" onClick={refresh}>
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700">
                <Users className="h-8 w-8" />
              </div>
              <p className="text-base font-semibold text-forum-900">
                {hasActiveFilters ? 'No applications match' : 'Empty queue'}
              </p>
              <p className="text-sm text-ink-muted max-w-md text-center">
                {hasActiveFilters
                  ? 'Try clearing or adjusting the current filters.'
                  : 'Triage is caught up. Applications appear here as soon as an applicant verifies their email.'}
              </p>
              {hasActiveFilters && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Reset filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Applicant</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Type · Degree</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Institution · Country</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Submitted</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Waiting</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Priority</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => {
                      const isMenuOpen = actionMenuOpenId === m.id;
                      const open = m.status === 'Pending' || m.status === 'Under Review';
                      const ageing = open && m.stageSlaBreached;
                      const busy = busyId === m.id;
                      const initials = m.name
                        .split(' ')
                        .filter(Boolean)
                        .slice(-2)
                        .map((n) => n[0])
                        .join('');
                      return (
                        <tr
                          key={m.id}
                          className={`border-b border-paper-border last:border-0 hover:bg-forum-50/40 ${
                            m.priority === 'Urgent' ? 'bg-danger-50/10' : ''
                          }`}
                          onMouseLeave={() => isMenuOpen && setActionMenuOpenId(null)}
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${
                                  m.priority === 'Urgent'
                                    ? 'bg-gradient-to-br from-danger-500 to-danger-700'
                                    : m.priority === 'High'
                                      ? 'bg-gradient-to-br from-brass-500 to-brass-700'
                                      : 'bg-gradient-to-br from-forum-600 to-slateteal-500'
                                }`}
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-forum-900">{m.name}</p>
                                <p className="text-xs text-ink-muted truncate max-w-[220px]">
                                  <Mail className="h-3 w-3 inline mr-1 align-text-bottom opacity-60" />
                                  {m.email}
                                </p>
                                <p className="text-xs text-ink-subtle truncate max-w-[220px] lg:hidden">{m.institution}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell align-top">
                            <div>
                              <Badge variant="info">{m.professionalType}</Badge>
                              {m.highestDegree && (
                                <p className="mt-1.5 text-xs text-ink-muted inline-flex items-center gap-1">
                                  <GraduationCap className="h-3 w-3 text-ink-subtle" />
                                  <span className="truncate max-w-[180px]">{m.highestDegree}</span>
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <div>
                              <p className="text-sm font-medium text-forum-900 truncate max-w-[220px]">{m.institution}</p>
                              {m.country && (
                                <p className="text-xs text-ink-subtle inline-flex items-center gap-1 mt-0.5">
                                  <Globe2 className="h-3 w-3" />
                                  {m.country}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden xl:table-cell align-top">
                            <div>
                              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatSubmitted(m.submittedAt)}
                              </span>
                              {m.applicationId && (
                                <p className="text-[10px] font-mono text-ink-subtle mt-1">App ID: {m.applicationId}</p>
                              )}
                            </div>
                          </td>
                          <td className={`py-3.5 px-2 hidden sm:table-cell align-top ${ageing ? 'text-danger-600 font-semibold' : ''}`}>
                            <span className="inline-flex items-center gap-1 text-xs">
                              {ageing ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5 text-ink-subtle" />}
                              {m.stageSlaDays === null ? (open ? 'Review start unavailable' : '—') : `${m.stageSlaDays} / ${m.stageSlaTarget} days`}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={priorityBadgeMap[m.priority] ?? 'default'}>
                              {m.priority === 'Urgent' && <AlertCircle className="h-3 w-3 mr-0.5" />}
                              {m.priority}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={statusBadgeMap[m.status]}>
                              {m.status === 'Pending' ? (
                                <Clock className="h-3 w-3 mr-1" />
                              ) : m.status === 'Under Review' ? (
                                <Eye className="h-3 w-3 mr-1" />
                              ) : m.status === 'Approved' ? (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              {m.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 text-right align-top">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {open && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => quickApprove(m.id)}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors disabled:opacity-50"
                                  title="Approve and issue Member ID"
                                >
                                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />} Approve
                                </button>
                              )}
                              <Link
                                to={`/admin/members/${m.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors"
                              >
                                <Eye className="h-3 w-3" /> Review
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpenId(isMenuOpen ? null : m.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900"
                                  aria-label="Actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 mt-1 w-56 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Link
                                      to={`/admin/members/${m.id}`}
                                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-forum-50 hover:text-forum-900"
                                    >
                                      <Eye className="h-3.5 w-3.5" /> Open full review
                                    </Link>
                                    {m.status === 'Pending' && (
                                      <button
                                        type="button"
                                        onClick={() => { setActionMenuOpenId(null); startReview(m.id); }}
                                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-warning-600 hover:bg-warning-100"
                                      >
                                        <Briefcase className="h-3.5 w-3.5" /> Start review
                                      </button>
                                    )}
                                    {open && (
                                      <>
                                        <div className="my-1 border-t border-paper-border" />
                                        <button
                                          type="button"
                                          onClick={() => { setActionMenuOpenId(null); quickApprove(m.id); }}
                                          className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-success-600 hover:bg-success-100"
                                        >
                                          <UserCheck className="h-3.5 w-3.5" /> Approve &amp; issue ID
                                        </button>
                                        {/* Rejection needs a written reason, so it happens on the review screen. */}
                                        <Link
                                          to={`/admin/members/${m.id}?decision=reject`}
                                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger-600 hover:bg-danger-100"
                                        >
                                          <UserX className="h-3.5 w-3.5" /> Reject with reason…
                                        </Link>
                                      </>
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
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-paper-border pt-4">
                <p className="text-xs text-ink-subtle">
                  Showing <span className="font-semibold text-ink-muted">{showing.from}</span>–
                  <span className="font-semibold text-ink-muted">{showing.to}</span> of{' '}
                  <span className="font-semibold text-ink-muted">{total}</span>
                </p>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
                    <ArrowLeft className="h-3.5 w-3.5" />
                    First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <span className="px-3 text-xs text-ink-muted">
                    Page {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={page >= totalPages}>
                    Last
                    <ArrowRight className="h-3.5 w-3.5" />
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
