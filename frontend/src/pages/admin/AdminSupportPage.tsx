import { useState } from 'react';
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

type Status = 'All' | 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
type SupportType = 'All' | 'Moral Support' | 'Official Support' | 'Funding Support';
type Priority = 'All' | 'Urgent' | 'High' | 'Standard' | 'Low';

interface Ticket {
  id: string;
  subject: string;
  member: string;
  memberId: string;
  project: string;
  supportType: Exclude<SupportType, 'All'>;
  status: Exclude<Status, 'All'>;
  priority: 'Urgent' | 'High' | 'Standard' | 'Low';
  submitted: string;
  assignedAdmin: string;
  queueDays: number;
  lastMessage: string;
}

const tickets: Ticket[] = [
  { id: 'sr-00241', subject: 'Funding support for PTSD intervention study — 4th cohort extension', member: 'Dr. A. Kapoor', memberId: 'IFSMHP-2024-000176', project: 'PTSD intervention study', supportType: 'Funding Support', status: 'Pending', priority: 'Urgent', submitted: '2026-08-20', assignedAdmin: 'Unassigned', queueDays: 1, lastMessage: 'Member: "Enrollment rates exceeded target; 4th cohort feasible if IFSMHP can endorse…"' },
  { id: 'sr-00240', subject: 'Official letter of support for ethics submission (REC UK)', member: 'Prof. M. Whitfield', memberId: 'IFSMHP-2024-000045', project: 'Palliative care anxiety trial', supportType: 'Official Support', status: 'Under Review', priority: 'High', submitted: '2026-08-19', assignedAdmin: 'CRO Office', queueDays: 2, lastMessage: 'System: "Attached ethics protocol; deadline August 26."' },
  { id: 'sr-00239', subject: 'Moral support — career transition out of academia for postdoc member', member: 'Dr. T. Mbeki', memberId: 'IFSMHP-2024-000198', project: 'Not project-linked', supportType: 'Moral Support', status: 'Pending', priority: 'Standard', submitted: '2026-08-19', assignedAdmin: 'Unassigned', queueDays: 2, lastMessage: 'Member: "Looking for guidance on industry roles…"' },
  { id: 'sr-00238', subject: 'Request to move publication from Approved to Published early', member: 'Dr. S. Chen', memberId: 'IFSMHP-2024-000142', project: 'Digital mental health platforms', supportType: 'Official Support', status: 'Approved', priority: 'Standard', submitted: '2026-08-17', assignedAdmin: 'CRO Office', queueDays: 0, lastMessage: 'CRO: "Approved — public launch with the Monday release."' },
  { id: 'sr-00237', subject: 'Additional funding request for conference travel (INPrague 2026)', member: 'Dr. S. Wijaya', memberId: 'IFSMHP-2024-000156', project: 'Bahasa depression screening tool', supportType: 'Funding Support', status: 'Rejected', priority: 'Low', submitted: '2026-08-16', assignedAdmin: 'CRO Office', queueDays: 0, lastMessage: 'CRO: "Travel fund pool exhausted this quarter; resubmit Q1 2027."' },
  { id: 'sr-00236', subject: 'Official endorsement for national press release of RCT outcomes', member: 'Dr. M. Fernández', memberId: 'IFSMHP-2024-000201', project: 'Postpartum depression screening', supportType: 'Official Support', status: 'Completed', priority: 'High', submitted: '2026-08-12', assignedAdmin: 'CRO Office', queueDays: 0, lastMessage: 'CRO: "Letter issued; press embargo set."' },
  { id: 'sr-00235', subject: 'Moral support — burnout check-in for high-volume clinic members', member: 'Dr. E. Thompson', memberId: 'IFSMHP-2024-000105', project: 'Not project-linked', supportType: 'Moral Support', status: 'Completed', priority: 'Standard', submitted: '2026-08-10', assignedAdmin: 'Dr. L. Okafor', queueDays: 0, lastMessage: 'System: "Support pair assigned — ongoing."' },
  { id: 'sr-00234', subject: 'Funding — seed grant for pilot fMRI biomarker study', member: 'Prof. H. Lindberg', memberId: 'IFSMHP-2024-000092', project: 'Sleep intervention RCT', supportType: 'Funding Support', status: 'Under Review', priority: 'High', submitted: '2026-08-04', assignedAdmin: 'CRO Office', queueDays: 7, lastMessage: 'CRO: "Budget reviewed; awaiting scoped feedback from Scientific Advisory…"' },
];

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

const priorityBadge: Record<Ticket['priority'], 'danger' | 'warning' | 'default' | 'info'> = {
  Urgent: 'danger',
  High: 'warning',
  Standard: 'default',
  Low: 'info',
};

export default function AdminSupportPage() {
  const [status, setStatus] = useState<Status>('All');
  const [supportType, setSupportType] = useState<SupportType>('All');
  const [priority, setPriority] = useState<Priority>('All');
  const [member, setMember] = useState('');
  const [submittedDate, setSubmittedDate] = useState('');
  const [search, setSearch] = useState('');

  const filtered = tickets.filter((t) => {
    if (status !== 'All' && t.status !== status) return false;
    if (supportType !== 'All' && t.supportType !== supportType) return false;
    if (priority !== 'All' && t.priority !== priority) return false;
    if (member && !t.member.toLowerCase().includes(member.toLowerCase())) return false;
    if (submittedDate && t.submitted !== submittedDate) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openCount = tickets.filter((t) => ['Pending', 'Under Review'].includes(t.status)).length;
  const urgentCount = tickets.filter((t) => t.priority === 'Urgent').length;
  const overSLA = tickets.filter((t) => ['Pending', 'Under Review'].includes(t.status) && t.queueDays >= 5).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Open Tickets', value: openCount.toString(), icon: Headphones, color: 'forum', note: `${urgentCount} urgent` },
          { label: 'Over SLA', value: overSLA.toString(), icon: AlertCircle, color: 'brass', note: '≥ 5 days in queue', warn: true },
          { label: 'Approved / Week', value: '11', icon: CheckCircle2, color: 'slateteal', note: 'Of 17 triaged' },
          { label: 'Closed / Month', value: '43', icon: CheckCircle2, color: 'forum', note: 'Avg. resolution: 3.4d' },
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
                <TextInput placeholder="Search request ID or subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full sm:w-40">
                {(['All', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'] as Status[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Statuses' : v}</option>)}
              </SelectInput>
              <SelectInput value={supportType} onChange={(e) => setSupportType(e.target.value as SupportType)} className="w-full sm:w-48">
                {(['All', 'Moral Support', 'Official Support', 'Funding Support'] as SupportType[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Support Types' : v}</option>)}
              </SelectInput>
              <SelectInput value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="w-full sm:w-36">
                {(['All', 'Urgent', 'High', 'Standard', 'Low'] as Priority[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Priorities' : v}</option>)}
              </SelectInput>
              <TextInput type="text" placeholder="Filter member…" value={member} onChange={(e) => setMember(e.target.value)} className="w-full sm:w-40" />
              <TextInput type="date" aria-label="Filter by submitted date" value={submittedDate} onChange={(e) => setSubmittedDate(e.target.value)} className="w-full sm:w-40" />
              <button type="button" aria-label="Filters active" className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-sm text-ink-muted hover:bg-forum-50">
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
                  const s = statusMap[t.status];
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
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium rounded-full bg-forum-50 text-forum-700 px-2.5 py-1">
                          {(() => { const Icon = supportTypeIcon[t.supportType]; return <Icon className="h-3.5 w-3.5" />; })()}
                          {t.supportType}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 hidden xl:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          <Clock className="h-3.5 w-3.5" />
                          {t.submitted}
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
                            to={`/admin/support/${t.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-50 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Open
                          </Link>
                          {['Pending', 'Under Review'].includes(t.status) && (
                            <Button size="sm" variant="primary" className="!px-2.5 !py-1 !text-xs">
                              <Send className="h-3.5 w-3.5" />
                              Triage
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {t.status === 'Approved' && (
                            <Button size="sm" className="!px-2.5 !py-1 !text-xs bg-success-600 hover:bg-success-600/90">
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
          {filtered.length === 0 && <p className="py-10 text-center text-sm text-ink-muted">No support requests match the selected filters.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
