import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ChevronRight,
  IdCard,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
  Edit3,
  Ban,
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { adminApi, type AdminMembersResult, type AccountStatusLabel } from '../../api/admin';
import { useApiData } from '../../hooks/useApiData';

const statusBadgeMap: Record<AccountStatusLabel, 'success' | 'warning' | 'info' | 'brass' | 'danger' | 'default'> = {
  Pending: 'info',
  Active: 'success',
  Suspended: 'brass',
  Deactivated: 'default',
  Rejected: 'danger',
};

const statusIconMap: Record<AccountStatusLabel, typeof Clock> = {
  Pending: Clock,
  Active: CheckCircle2,
  Suspended: Ban,
  Deactivated: UserX,
  Rejected: XCircle,
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function AdminMembersPage() {
  const [search, setSearch] = useState('');
  const [memberIdSearch, setMemberIdSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | AccountStatusLabel>('All');
  const [regFrom, setRegFrom] = useState('');
  const [regTo, setRegTo] = useState('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Debounced so typing does not fire a request per keystroke.
  const [debounced, setDebounced] = useState({ search: '', memberIdSearch: '', emailSearch: '', institutionSearch: '', countrySearch: '' });
  useEffect(() => {
    const id = setTimeout(
      () => setDebounced({ search, memberIdSearch, emailSearch, institutionSearch, countrySearch }),
      300,
    );
    return () => clearTimeout(id);
  }, [search, memberIdSearch, emailSearch, institutionSearch, countrySearch]);

  // Filtering and paging happen server-side: the directory can outgrow a page,
  // so narrowing only the rows already fetched would misreport the totals.
  const { data, loading, error } = useApiData<AdminMembersResult>(
    () =>
      adminApi.members({
        q: debounced.search,
        memberId: debounced.memberIdSearch,
        email: debounced.emailSearch,
        institution: debounced.institutionSearch,
        country: debounced.countrySearch,
        professionalType: typeFilter,
        status: statusFilter,
        registeredFrom: regFrom,
        registeredTo: regTo,
        page,
        limit: pageSize,
      }),
    [debounced, typeFilter, statusFilter, regFrom, regTo, page, pageSize, reloadKey],
  );

  const pageItems = data?.items ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.pages ?? 1;
  const typeOptions = data?.professionalTypes ?? [];
  const counts = data?.accountCounts ?? {
    total: 0, active: 0, pending: 0, suspended: 0, deactivated: 0, rejected: 0,
  };

  useEffect(() => {
    setPage(1);
  }, [debounced, typeFilter, statusFilter, regFrom, regTo, pageSize]);

  const refresh = () => setReloadKey((k) => k + 1);
  const safePage = page;
  const startIdx = (safePage - 1) * pageSize;

  const hasActiveFilters = search !== '' || memberIdSearch !== '' || emailSearch !== '' || institutionSearch !== '' || countrySearch !== '' || typeFilter !== 'All' || statusFilter !== 'All' || regFrom !== '' || regTo !== '';

  const clearFilters = () => {
    setSearch('');
    setMemberIdSearch('');
    setEmailSearch('');
    setInstitutionSearch('');
    setCountrySearch('');
    setTypeFilter('All');
    setStatusFilter('All');
    setRegFrom('');
    setRegTo('');
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return iso;
    }
  };

  const availableActions = (status: AccountStatusLabel) => ({
    view: true,
    edit: status !== 'Rejected' && status !== 'Deactivated',
    suspend: status === 'Active',
    deactivate: status === 'Active' || status === 'Suspended' || status === 'Pending',
    reactivate: status === 'Suspended' || status === 'Deactivated',
    approve: status === 'Pending',
    reject: status === 'Pending',
  });

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            {loading ? (
              <Badge variant="info">
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                Syncing…
              </Badge>
            ) : null}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            Members
          </h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Manage IFSMHP members, applications and membership status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ===== KPI STRIP ===== */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total', value: counts.total, icon: Users, color: 'forum' },
          { label: 'Pending Review', value: counts.pending, icon: Clock, color: 'brass' },
          { label: 'Active', value: counts.active, icon: CheckCircle2, color: 'success' as const },
          { label: 'Suspended', value: counts.suspended, icon: Ban, color: 'brass' },
          { label: 'Deactivated', value: counts.deactivated, icon: UserX, color: 'forum' },
          { label: 'Rejected', value: counts.rejected, icon: XCircle, color: 'danger' as const },
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
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-forum-900">{k.value}</p>
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

      {/* ===== SEARCH & FILTERS ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput
              placeholder="Search by name or role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filtersOpen ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filtersOpen ? 'Hide Filters' : 'More Filters'}
              <Filter className="h-3.5 w-3.5" />
            </Button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
        </CardHeader>

        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="Member ID"
                icon={<IdCard className="h-4 w-4 text-ink-subtle" />}
                placeholder="IFSMHP-YYYY-NNNNNN"
                value={memberIdSearch}
                onChange={(e) => setMemberIdSearch(e.target.value)}
              />
              <TextInput
                label="Email"
                icon={<Mail className="h-4 w-4 text-ink-subtle" />}
                placeholder="name@institution.edu"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
              />
              <TextInput
                label="Institution"
                icon={<Building2 className="h-4 w-4 text-ink-subtle" />}
                placeholder="University / Hospital…"
                value={institutionSearch}
                onChange={(e) => setInstitutionSearch(e.target.value)}
              />
              <TextInput
                label="Country"
                icon={<Globe2 className="h-4 w-4 text-ink-subtle" />}
                placeholder="Country name…"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
              />
              <SelectInput
                label="Professional Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="All">All Professional Types</option>
                {typeOptions.map((t: string) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectInput>
              <SelectInput
                label="Membership Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | AccountStatusLabel)}
              >
                <option value="All">All Statuses</option>
                {(['Pending', 'Active', 'Suspended', 'Deactivated', 'Rejected'] as AccountStatusLabel[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <TextInput
                label="Registration From"
                icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />}
                type="date"
                value={regFrom}
                onChange={(e) => setRegFrom(e.target.value)}
              />
              <TextInput
                label="Registration To"
                icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />}
                type="date"
                value={regTo}
                onChange={(e) => setRegTo(e.target.value)}
              />
            </CardContent>
          </div>
        )}
      </Card>

      {/* ===== MEMBERS TABLE ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-forum-600" />
              Member Directory
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{pageItems.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{total}</span> members
              {hasActiveFilters && (
                <> · <span className="text-brass-700 font-medium">filters applied</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows per page</label>
            <SelectInput
              value={pageSize.toString()}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-24"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
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
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Member</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Member ID</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Professional Type</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Institution</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Country</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Registration</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Approved</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((m) => {
                      const StatusIcon = statusIconMap[m.accountStatus];
                      const actions = availableActions(m.accountStatus);
                      const isMenuOpen = actionMenuOpenId === m.id;
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 relative"
                          onMouseLeave={() => isMenuOpen && setActionMenuOpenId(null)}
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold">
                                {m.name.split(' ').slice(1, 2).concat(m.name.split(' ').slice(-1)).map((n) => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-forum-900">{m.name}</p>
                                <p className="text-xs text-ink-muted truncate max-w-[220px]">
                                  <Mail className="h-3 w-3 inline mr-1 align-text-bottom opacity-60" />
                                  {m.email}
                                </p>
                                <p className="text-xs text-ink-subtle truncate max-w-[220px] md:hidden">
                                  {m.institution}
                                </p>
                              </div>
                              {m.priority === 'High' && <Badge variant="danger" className="hidden sm:inline-flex">High</Badge>}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell">
                            {m.memberId ? (
                              <code className="text-[11px] font-mono rounded bg-forum-50 text-forum-700 px-2 py-1 font-semibold whitespace-nowrap">
                                {m.memberId}
                              </code>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
                                <Clock className="h-3 w-3" />
                                Pending ID
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell">
                            <Badge variant="info">{m.professionalType}</Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden sm:table-cell">
                            <div className="text-sm">
                              <p className="text-ink truncate max-w-[200px]">{m.institution}</p>
                              <p className="text-xs text-ink-subtle inline-flex items-center gap-1 mt-0.5 lg:hidden">
                                <Globe2 className="h-3 w-3" />
                                {m.country}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 text-xs text-ink">
                              <Globe2 className="h-3 w-3 text-ink-subtle" />
                              {m.country}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 hidden xl:table-cell">
                            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(m.registrationDate)}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 hidden xl:table-cell">
                            {m.approvedAt ? (
                              <div>
                                <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                                  <CheckCircle2 className="h-3 w-3 text-success-600" />
                                  {formatDate(m.approvedAt)}
                                </span>
                                {/* Approved but never notified — the admin needs to see this. */}
                                {!m.approvalEmailSentAt && (
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-danger-600">
                                    <AlertCircle className="h-3 w-3" />
                                    Email not sent
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-ink-subtle">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2">
                            <Badge variant={statusBadgeMap[m.accountStatus]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {m.accountStatus}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 text-right align-top">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {actions.approve && (
                                <button
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approve
                                </button>
                              )}
                              <Link
                                to={`/admin/members/${m.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors"
                                title="View"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpenId(isMenuOpen ? null : m.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 mt-1 w-52 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MenuAction to={`/admin/members/${m.id}`} icon={Eye} label="View details" />
                                    {actions.edit && <MenuAction to={`/admin/members/${m.id}`} icon={Edit3} label="Edit member" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    {actions.approve && <MenuAction to={`/admin/members/${m.id}`} icon={CheckCircle2} label="Approve & issue ID" tone="success" />}
                                    {actions.reject && <MenuAction to={`/admin/members/${m.id}`} icon={XCircle} label="Reject application" tone="danger" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    {actions.suspend && <MenuAction to={`/admin/members/${m.id}`} icon={Ban} label="Suspend account" tone="warning" />}
                                    {actions.reactivate && <MenuAction to={`/admin/members/${m.id}`} icon={UserCheck} label="Reactivate account" tone="success" />}
                                    {actions.deactivate && <MenuAction to={`/admin/members/${m.id}`} icon={UserX} label="Deactivate permanently" tone="danger" />}
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
                  <span className="font-semibold text-ink-muted">{Math.min(startIdx + pageItems.length, total)}</span> of{' '}
                  <span className="font-semibold text-ink-muted">{total}</span> members
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                  >
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (n: number) => void }) {
  const range = useMemo(() => {
    const pages: (number | '…')[] = [];
    const add = (n: number | '…') => pages.push(n);
    const windowSize = 1;
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);

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
      {range.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-2 text-xs text-ink-subtle">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors ${
              p === page
                ? 'bg-forum-600 text-white shadow-sm'
                : 'border border-paper-border text-ink-muted hover:bg-forum-50 hover:text-forum-900'
            }`}
          >
            {p}
          </button>
        )
      )}
    </div>
  );
}

function MenuAction({ to, icon: Icon, label, tone = 'default' }: { to: string; icon: typeof Eye; label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClasses = {
    default: 'text-ink hover:bg-forum-50 hover:text-forum-900',
    success: 'text-success-600 hover:bg-success-100',
    warning: 'text-warning-600 hover:bg-warning-100',
    danger: 'text-danger-600 hover:bg-danger-100',
  };
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${toneClasses[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
      <div className="text-center">
        <p className="text-sm font-medium text-forum-900">Loading members…</p>
        <p className="text-xs text-ink-subtle mt-1">Retrieving directory from the registry</p>
      </div>
      <div className="mt-4 w-full max-w-xl space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-paper-border bg-paper animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry, message }: { onRetry: () => void; message?: string }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
        <AlertCircle className="h-7 w-7" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">Couldn't load members</p>
        <p className="text-sm text-ink-muted mt-1">
          {message ?? 'We hit a problem fetching the member directory. Check your connection or try again.'}
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
        <Button as="link" to="/admin/support" size="sm" variant="ghost">
          <Mail className="h-3.5 w-3.5" />
          Contact support
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700">
        <Users className="h-8 w-8" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">
          {hasFilters ? 'No members match your filters' : 'No members yet'}
        </p>
        <p className="text-sm text-ink-muted mt-1">
          {hasFilters
            ? 'Try clearing or adjusting the current search and filters.'
            : 'Membership applications will appear here as they are submitted.'}
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        {hasFilters ? (
          <Button size="sm" variant="outline" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : (
          <Button as="link" to="/register" size="sm" variant="primary">
            <UserCheck className="h-3.5 w-3.5" />
            Invite a member
          </Button>
        )}
      </div>
    </div>
  );
}
