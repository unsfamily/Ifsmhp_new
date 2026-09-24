import {
  Headphones,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  HeartHandshake,
  Building2,
  ChevronRight,
  Filter,
  ArrowRight,
  Send,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { useSupportList } from '../../hooks/useSupportList';
import { supportDays } from '../../api/support';
import { useAuth } from '../../context/AuthContext';
import SupportPagination from '../../components/support/SupportPagination';

type Status = 'All' | 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
type SupportType = 'All' | 'Moral Support' | 'Official Support' | 'Funding Support';
type Priority = 'All' | 'Urgent' | 'High' | 'Standard' | 'Low';


const statusMap: Record<Exclude<Status, 'All'>, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Pending: { variant: 'info', icon: Clock },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Completed: { variant: 'brass', icon: CheckCircle2 },
  Rejected: { variant: 'danger', icon: XCircle },
};

const supportTypeIcon: Record<Exclude<SupportType, 'All'>, typeof DollarSign> = {
  'Funding Support': DollarSign,
  'Official Support': Building2,
  'Moral Support': HeartHandshake,
};

const priorityBadge: Record<Exclude<Priority, 'All'>, 'danger' | 'warning' | 'default' | 'info'> = {
  Urgent: 'danger',
  High: 'warning',
  Standard: 'default',
  Low: 'info',
};

export default function AdminSupportPage() {
  const { user } = useAuth();
  return user ? <AdminSupportList key={user.id} /> : null;
}

function AdminSupportList() {
  const { data, loading, error, refresh, params, filter, reset } = useSupportList(true);
  const status = (params.get('status') ?? 'All') as Status;
  const supportType = (params.get('supportType') ?? 'All') as SupportType;
  const priority = (params.get('priority') ?? 'All') as Priority;
  const member = params.get('member') ?? '';
  const submittedDate = params.get('submittedDate') ?? '';
  const search = params.get('q') ?? '';
  const setStatus = (v: Status) => filter('status', v);
  const setSupportType = (v: SupportType) => filter('supportType', v);
  const setPriority = (v: Priority) => filter('priority', v);
  const setMember = (v: string) => filter('member', v);
  const setSubmittedDate = (v: string) => filter('submittedDate', v);
  const setSearch = (v: string) => filter('q', v);
  const filtered = data?.items ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-6" style={{ overflowWrap: 'anywhere' }}>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Open Tickets', value: stats?.open.toString() ?? '...', icon: Headphones, color: 'forum', note: stats ? `${stats.urgent} urgent` : '' },
          { label: 'Over SLA', value: stats?.overSla.toString() ?? '...', icon: AlertCircle, color: 'brass', note: `≥ ${stats?.slaTargetDays ?? '—'} days in queue`, warn: !!stats?.overSla },
          { label: 'Approved / Week', value: stats?.approvedWeek.toString() ?? '...', icon: CheckCircle2, color: 'slateteal', note: stats ? `Of ${stats.triagedWeek} triaged` : '' },
          { label: 'Closed / Month', value: stats?.closedMonth.toString() ?? '...', icon: CheckCircle2, color: 'forum', note: `Avg. resolution: ${supportDays(stats?.avgResolutionDays)}` },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label} className={k.warn ? 'border-danger-600/30 ring-2 ring-danger-100' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  {k.warn && <Badge variant="danger">Action</Badge>}
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Headphones className="h-5 w-5 text-forum-600" />
                All Support Requests
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Triage, approve, and respond to member support requests — all actions create audit entries</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput aria-label="Search support requests" placeholder="Search request ID or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput aria-label="Filter status" value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full sm:w-40">
                {(['All', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'] as Status[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Statuses' : v}</option>)}
              </SelectInput>
              <SelectInput aria-label="Filter support type" value={supportType} onChange={(e) => setSupportType(e.target.value as SupportType)} className="w-full sm:w-48">
                {(['All', 'Moral Support', 'Official Support', 'Funding Support'] as SupportType[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Support Types' : v}</option>)}
              </SelectInput>
              <SelectInput aria-label="Filter priority" value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full sm:w-36">
                {(['All', 'Urgent', 'High', 'Standard', 'Low'] as Priority[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Priorities' : v}</option>)}
              </SelectInput>
              <TextInput aria-label="Filter member" type="text" placeholder="Filter member…" value={member} onChange={(e) => setMember(e.target.value)} className="w-full sm:w-40" />
              <TextInput type="date" aria-label="Filter by submitted date" value={submittedDate} onChange={(e) => setSubmittedDate(e.target.value)} className="w-full sm:w-40" />
              <button type="button" aria-label="Reset filters" title="Reset filters" onClick={reset} className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-sm text-ink-muted hover:bg-forum-50">
                <Filter className="h-4 w-4" />
                Filters
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-border text-left">
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Request ID</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Member</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Project</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Support Type</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Submitted</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Priority</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Assigned/Admin</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const s = statusMap[t.status as keyof typeof statusMap] ?? statusMap.Pending;
                  const SI = s.icon;
                  return (
                    <tr key={t.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 align-top">
                      <td className="py-3.5 px-2 max-w-xl">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <code className="font-mono text-[10px] text-ink-subtle bg-paper border border-paper-border px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider">{t.id}</code>
                          </div>
                          <p className="font-medium text-forum-900 leading-snug">{t.subject}</p>
                          <p className="text-xs text-ink-muted mt-1 line-clamp-1">{t.lastMessage}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden sm:table-cell">
                        <div className="min-w-0">
                          <p className="text-sm text-ink">{t.member}</p>
                          <p className="text-[10px] text-ink-subtle font-mono truncate">{t.memberId}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden md:table-cell">
                        <p className="text-sm text-ink max-w-40">{t.project}</p>
                      </td>
                      <td className="py-3.5 px-2 hidden lg:table-cell">
                        {t.type.map((kind) => <span key={kind} className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-forum-50 text-forum-700 px-2.5 py-1">
                          {(() => { const Icon = supportTypeIcon[`${kind} Support`]; return <Icon className="h-3.5 w-3.5" />; })()}
                          {kind} Support
                        </span>)}
                      </td>
                      <td className="py-3.5 px-2 hidden xl:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(t.submitted).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-2">
                        <Badge variant={s.variant}>
                          <SI className="h-3 w-3 mr-1" />
                          {t.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 hidden lg:table-cell">
                        <Badge variant={priorityBadge[t.priority]}>
                          {t.priority === 'Urgent' && <AlertCircle className="h-3 w-3 mr-0.5" />}
                          {t.priority}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 hidden xl:table-cell">
                        <span className="text-xs text-ink-muted">{t.assignedAdmin}</span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <Link
                            to={`/admin/support/${t.id}?${params}`}
                            className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-50 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Open
                          </Link>
                          {['Pending', 'Under Review'].includes(t.status) && (
                            <Button size="sm" variant="primary" className="!px-2.5 !py-1 !text-xs" as="link" to={`/admin/support/${t.id}?${params}#triage`}>
                              <Send className="h-3.5 w-3.5" />
                              Triage
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {t.status === 'Approved' && (
                            <Button size="sm" className="!px-2.5 !py-1 !text-xs bg-success-600 hover:bg-success-600/90" as="link" to={`/admin/support/${t.id}?${params}#complete`}>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Mark Complete
                              <ArrowRight className="h-3.5 w-3.5" />
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
          {loading && <p role="status" className="py-10 text-center text-sm text-ink-muted">Loading support requests...</p>}
          {!loading && !error && filtered.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">{data?.stats.total === 0 ? 'No support requests yet.' : 'No support requests match the selected filters.'}</p>}
          <SupportPagination page={data?.pagination.page ?? 1} pages={data?.pagination.pages ?? 1} total={data?.pagination.total} onPage={(page) => filter('page', String(page))} error={error} onRetry={refresh} />
        </CardContent>
      </Card>
    </div>
  );
}
