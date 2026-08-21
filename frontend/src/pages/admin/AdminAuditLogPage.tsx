import { useState } from 'react';
import {
  Search,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  User,
  Eye,
  ChevronRight,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

type ActorFilter = 'All' | 'CRO Office' | 'System' | 'Member';
type ActionFilter = 'All' | 'User' | 'Membership' | 'Project' | 'Publication' | 'Support' | 'Message' | 'Event' | 'Credentials';
type SeverityFilter = 'All' | 'Info' | 'Success' | 'Warning' | 'Danger';

interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: 'ADMIN' | 'MEMBER' | 'SYSTEM';
  action: string;
  entity: string;
  severity: Exclude<SeverityFilter, 'All'>;
  description: string;
  changes?: Record<string, { before: string | null; after: string | null }>;
  ip?: string;
  userAgent?: string;
}

const entries: AuditEntry[] = [
  { id: 'al-88291', at: '2026-08-21 09:12:44 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'MembershipApproved', entity: 'User mr1 / IFSMHP-2026-000278', severity: 'Success', description: 'Approved membership application for Dr. Anika Kapoor (applicant mr1). Issued permanent member ID IFSMHP-2026-000278.', changes: { userRole: { before: 'APPLICANT', after: 'MEMBER' }, status: { before: 'PENDING', after: 'ACTIVE' } }, ip: '81.224.x.x' },
  { id: 'al-88290', at: '2026-08-21 08:58:20 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'PublicationApproved', entity: 'Publication pub3', severity: 'Success', description: 'Publication submission #pub3 moved from UNDER_REVIEW → APPROVED by CRO review. Reviewer comments added to the review thread.', changes: { status: { before: 'UNDER_REVIEW', after: 'APPROVED' } } },
  { id: 'al-88289', at: '2026-08-21 08:41:02 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'SupportRequestAssigned', entity: 'SupportRequest sr-00240', severity: 'Info', description: 'Assigned official endorsement request SR-00240 to Legal Review lane. Added reviewer comment.', ip: '81.224.x.x' },
  { id: 'al-88288', at: '2026-08-21 07:10:11 UTC', actor: 'System', role: 'SYSTEM', action: 'PublicationPublished', entity: 'Publication pub6', severity: 'Success', description: 'Publication state changed APPROVED → PUBLISHED per CRO timing schedule. Created slug: /research/mindfulness-app-rct-gad-2026.' },
  { id: 'al-88287', at: '2026-08-20 19:02:55 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'CredentialDocumentDownloaded', entity: 'Document c4 / Application mr1', severity: 'Warning', description: 'ADMIN access to sensitive credential document: "MCI Registration Certificate" for member application mr1. Access logged per I.17.', changes: { accessedBy: { before: null, after: 'admin@ifsmhp.org' } } },
  { id: 'al-88286', at: '2026-08-20 17:33:18 UTC', actor: 'Dr. S. Chen (IFSMHP-2024-000142)', role: 'MEMBER', action: 'FileDownload', entity: 'File f1 / DocumentExchange doc44', severity: 'Info', description: 'Member downloaded own submitted document. Not tracked as admin-access.' },
  { id: 'al-88285', at: '2026-08-20 16:11:02 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'SupportRequestCompleted', entity: 'SupportRequest sr-00236', severity: 'Success', description: 'Closed support request. Endorsement letter issued; embargo set.', changes: { status: { before: 'APPROVED', after: 'COMPLETED' } } },
  { id: 'al-88284', at: '2026-08-20 15:05:47 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'BroadcastSent', entity: 'Announcement ann-17', severity: 'Info', description: 'Platform-wide broadcast: "2026 Symposium Early-bird registration opens August 23". Delivered to 277 members and 1,204 newsletter subscribers.' },
  { id: 'al-88283', at: '2026-08-20 13:22:05 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'UserStatusChanged', entity: 'User m4 / IFSMHP-2024-000198', severity: 'Warning', description: 'Administrative action: User set to DEACTIVATED at the request of the member. Audit trail per §I.17.', changes: { status: { before: 'ACTIVE', after: 'DEACTIVATED' } }, ip: '81.224.x.x' },
  { id: 'al-88282', at: '2026-08-20 11:44:32 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'ProjectRejected', entity: 'Project pa4', severity: 'Danger', description: 'Project submission returned to DRAFT with revision request. Member can edit and re-submit. Reason: "Budget justification section under-reported materials for the secondary site."', changes: { status: { before: 'UNDER_REVIEW', after: 'REJECTED' } }, ip: '81.224.x.x' },
  { id: 'al-88281', at: '2026-08-20 10:30:00 UTC', actor: 'System', role: 'SYSTEM', action: 'LoginFailedRateLimit', entity: 'Unauthenticated / IP 45.88.x.x', severity: 'Danger', description: 'Automated rate-limit block: 42 consecutive failed logins from the same IP within 6 minutes. IP blacklisted for 24h.', ip: '45.88.x.x' },
  { id: 'al-88280', at: '2026-08-20 09:15:22 UTC', actor: 'CRO Office (admin@ifsmhp.org)', role: 'ADMIN', action: 'MemberIdIssued', entity: 'User m6 / IFSMHP-2024-000245', severity: 'Success', description: 'Transactional issue of Member ID: IFSMHP-2024-000245. Row-locked sequence counter incremented (245 of 2024).' },
];

const severityConfig: Record<Exclude<SeverityFilter, 'All'>, { badge: 'default' | 'success' | 'warning' | 'danger'; dot: string; icon: typeof Clock }> = {
  Info: { badge: 'default', dot: 'bg-slateteal-500', icon: Eye },
  Success: { badge: 'success', dot: 'bg-success-600', icon: CheckCircle2 },
  Warning: { badge: 'warning', dot: 'bg-warning-600', icon: AlertTriangle },
  Danger: { badge: 'danger', dot: 'bg-danger-600', icon: XCircle },
};

export default function AdminAuditLogPage() {
  const [actor, setActor] = useState<ActorFilter>('All');
  const [action, setAction] = useState<ActionFilter>('All');
  const [severity, setSeverity] = useState<SeverityFilter>('All');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = entries.filter((e) => {
    if (actor !== 'All') {
      if (actor === 'CRO Office' && e.role !== 'ADMIN') return false;
      if (actor === 'System' && e.role !== 'SYSTEM') return false;
      if (actor === 'Member' && e.role !== 'MEMBER') return false;
    }
    if (severity !== 'All' && e.severity !== severity) return false;
    if (action !== 'All' && !e.action.toLowerCase().includes(action.toLowerCase())) return false;
    if (search && !(e.description.toLowerCase().includes(search.toLowerCase()) || e.actor.toLowerCase().includes(search.toLowerCase()) || e.entity.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Admin Actions (24h)', value: entries.filter((e) => e.role === 'ADMIN').length.toString(), icon: ShieldCheck, color: 'forum', note: 'All state changes captured' },
          { label: 'Warnings (7d)', value: entries.filter((e) => e.severity === 'Warning').length.toString(), icon: AlertTriangle, color: 'brass', note: 'Admin sensitive access + role changes' },
          { label: 'Danger Events (7d)', value: entries.filter((e) => e.severity === 'Danger').length.toString(), icon: XCircle, color: 'slateteal', note: 'Rejections, security events' },
          { label: 'Log Retention', value: '365 days', icon: Clock, color: 'forum', note: 'Immutable append-only · §I.17' },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                  <Badge variant="warning" className="!text-[10px]">§I.17</Badge>
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
                <ShieldCheck className="h-5 w-5 text-forum-600" />
                System Audit Log
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Immutable, append-only record of all admin state changes, credential accesses, and security events. Architecture §I.17.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search log…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={actor} onChange={(e) => setActor(e.target.value as ActorFilter)} className="w-full sm:w-36">
                {(['All', 'CRO Office', 'System', 'Member'] as ActorFilter[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Actors' : v}</option>)}
              </SelectInput>
              <SelectInput value={action} onChange={(e) => setAction(e.target.value as ActionFilter)} className="w-full sm:w-40 hidden md:block">
                {(['All', 'User', 'Membership', 'Project', 'Publication', 'Support', 'Message', 'Event', 'Credentials'] as ActionFilter[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Actions' : v}</option>)}
              </SelectInput>
              <SelectInput value={severity} onChange={(e) => setSeverity(e.target.value as SeverityFilter)} className="w-full sm:w-32">
                {(['All', 'Info', 'Success', 'Warning', 'Danger'] as SeverityFilter[]).map((v) => <option key={v} value={v}>{v}</option>)}
              </SelectInput>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between mb-3 text-xs text-ink-subtle">
            <p>Showing <span className="font-semibold text-ink-muted">{filtered.length}</span> of <span className="font-semibold text-ink-muted">2,138</span> entries</p>
            <Button variant="ghost" size="sm">
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
          <ol className="relative border-l-2 border-paper-border ml-3 pl-5 space-y-4">
            {filtered.map((e) => {
              const sev = severityConfig[e.severity];
              const SevIcon = sev.icon;
              const isExpanded = expandedId === e.id;
              return (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[27px] top-1.5 h-5 w-5 rounded-full ring-4 ring-paper-raised ${sev.dot} flex items-center justify-center`}>
                    <SevIcon className="h-2.5 w-2.5 text-white" />
                  </span>
                  <div className={`rounded-xl border border-paper-border p-4 hover:bg-forum-50/30 transition-colors ${e.changes ? 'cursor-pointer' : ''}`} onClick={() => e.changes && setExpandedId(isExpanded ? null : e.id)}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={sev.badge} className="!py-0">{e.severity}</Badge>
                          <code className="text-[11px] font-mono text-forum-700 font-semibold bg-forum-50 px-1.5 py-0.5 rounded">{e.action}</code>
                          <span className="text-xs text-ink-muted inline-flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />{e.at}
                          </span>
                          {e.ip && <span className="text-[11px] text-ink-subtle font-mono">· {e.ip}</span>}
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold flex items-center justify-center">
                            {e.role === 'ADMIN' ? <ShieldCheck className="h-4 w-4" /> : e.role === 'SYSTEM' ? <Clock className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-ink">{e.actor}</p>
                            <p className="text-[11px] text-ink-subtle mt-0.5">{e.entity}</p>
                          </div>
                        </div>
                        <p className="mt-2.5 text-sm text-ink leading-relaxed">{e.description}</p>
                      </div>
                      {e.changes && (
                        <div className="flex md:justify-end md:items-start items-center">
                          {isExpanded ? (
                            <Badge variant="info" className="inline-flex items-center gap-1">
                              Field changes
                              <ChevronRight className="h-3 w-3 rotate-90" />
                            </Badge>
                          ) : (
                            <Badge variant="info" className="inline-flex items-center gap-1">
                              Field changes
                              <ChevronRight className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {isExpanded && e.changes && (
                      <div className="mt-4 border-t border-paper-border pt-4">
                        <h5 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle mb-2">State Changes (Before → After)</h5>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(e.changes).map(([field, { before, after }]) => (
                            <div key={field} className="rounded-lg border border-paper-border divide-y divide-paper-border overflow-hidden">
                              <div className="px-3 py-1.5 bg-paper text-[10px] font-semibold uppercase tracking-wider text-ink-subtle font-mono">{field}</div>
                              <div className="grid grid-cols-2 text-xs">
                                <div className="px-3 py-2 border-r border-paper-border">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-danger-600 mb-1">Before</p>
                                  <p className="text-ink font-mono">{before ?? <span className="text-ink-subtle italic">null</span>}</p>
                                </div>
                                <div className="px-3 py-2">
                                  <p className="text-[10px] font-semibold uppercase tracking-wider text-success-600 mb-1">After</p>
                                  <p className="text-ink font-mono">{after ?? <span className="text-ink-subtle italic">null</span>}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
