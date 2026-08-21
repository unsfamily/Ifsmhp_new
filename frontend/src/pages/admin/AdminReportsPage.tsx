import { useState } from 'react';
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  Users,
  FolderKanban,
  Globe2,
  Headphones,
  MessageSquare,
  CalendarClock,
  ChevronRight,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileSpreadsheet,
  Mail,
  AlertCircle,
  Search,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

interface ReportDef {
  id: string;
  title: string;
  category: 'Membership' | 'Publications' | 'Support' | 'Engagement' | 'Platform' | 'Finance';
  description: string;
  cadence: 'Monthly' | 'Weekly' | 'Quarterly' | 'On-demand' | 'Real-time';
  lastRun?: string;
  nextRun?: string;
  recipient?: string;
  format: 'PDF' | 'XLSX' | 'Both';
  metric: string;
  trend: 'up' | 'down' | 'flat';
  trendValue: string;
  samplePeriod: string;
}

const reports: ReportDef[] = [
  { id: 'rpt-membership-monthly', title: 'Membership Monthly Review', category: 'Membership', description: 'Applications received, approval/rejection counts, member ID issuance, geographic cohort distribution, credential verification statistics, and cohort retention.', cadence: 'Monthly', lastRun: 'Aug 01, 2026', nextRun: 'Sep 01, 2026', recipient: 'CRO + SAB', format: 'Both', metric: '14 new members', trend: 'up', trendValue: '+18% MoM', samplePeriod: 'July 2026' },
  { id: 'rpt-review-sla', title: 'Review SLA Performance', category: 'Publications', description: 'SLA compliance for publication review, project review, and support queues. 25/50/75 percentile review times, reviewer backlog, per-category breaching items.', cadence: 'Weekly', lastRun: 'Aug 19, 2026', nextRun: 'Aug 26, 2026', recipient: 'CRO Office', format: 'XLSX', metric: 'Avg. 6.2 days (pub)', trend: 'up', trendValue: '−1.3d since June', samplePeriod: 'Aug 12 – 18' },
  { id: 'rpt-funding', title: 'Funding & Support Disbursement', category: 'Finance', description: 'All funding approvals by project, by category, by cohort. Official endorsement counts, moral support pairings opened/closed. Budget utilization per grant line.', cadence: 'Quarterly', lastRun: 'Jul 01, 2026', nextRun: 'Oct 01, 2026', recipient: 'CRO + Finance Board', format: 'Both', metric: '€241,850 approved Q2', trend: 'up', trendValue: '+33% QoQ', samplePeriod: 'Q2 2026' },
  { id: 'rpt-support', title: 'Support Request Case Report', category: 'Support', description: 'All support tickets by category, time-to-first-response, time-to-approve, top requester segments, approval/rejection ratios, linked publications.', cadence: 'Monthly', lastRun: 'Aug 01, 2026', nextRun: 'Sep 01, 2026', recipient: 'CRO Office', format: 'Both', metric: 'Avg. 2.4 days response', trend: 'down', trendValue: '−0.7d MoM', samplePeriod: 'July 2026' },
  { id: 'rpt-engagement', title: 'Platform Engagement Dashboard', category: 'Engagement', description: 'Active member DAU/MAU, document views, message reply ratios, publication read-through, event attendance, community threads opened.', cadence: 'Weekly', lastRun: 'Aug 19, 2026', nextRun: 'Aug 26, 2026', recipient: 'CRO Office + Comms', format: 'PDF', metric: 'MAU 198 (71%)', trend: 'up', trendValue: '+6.4% WoW', samplePeriod: 'Aug 12 – 18' },
  { id: 'rpt-content', title: 'Publications Impact Report', category: 'Publications', description: 'Publications approved vs. published, public views, external backlinks, citation counts, top downloaded PDFs, subject area performance.', cadence: 'Quarterly', lastRun: 'Jul 01, 2026', nextRun: 'Oct 01, 2026', recipient: 'SAB', format: 'Both', metric: '21,847 public views', trend: 'up', trendValue: '+42% YoY', samplePeriod: 'Q2 2026' },
  { id: 'rpt-events', title: 'Events & Attendance Report', category: 'Engagement', description: 'Events created, RSVP pipeline, actual attendance vs capacity, speaker stats, geographic participation for virtual events.', cadence: 'Monthly', lastRun: 'Aug 01, 2026', nextRun: 'Sep 01, 2026', recipient: 'Events Committee', format: 'PDF', metric: '4 events, 971 RSVPs', trend: 'up', trendValue: '+22% MoM', samplePeriod: 'July 2026' },
  { id: 'rpt-messages', title: 'Messaging & Inquiries Report', category: 'Platform', description: 'Inbox response times, escalations to SAB, conversation topics, contact-form inquiries triaged, spam detection rate, public inquiry reply time.', cadence: 'Weekly', lastRun: 'Aug 19, 2026', nextRun: 'Aug 26, 2026', recipient: 'CRO Office', format: 'XLSX', metric: '96% response within 24h', trend: 'flat', trendValue: '−0.2% WoW', samplePeriod: 'Aug 12 – 18' },
];

const categoryIcon: Record<ReportDef['category'], typeof Users> = {
  Membership: Users,
  Publications: Globe2,
  Support: Headphones,
  Engagement: MessageSquare,
  Platform: BarChart3,
  Finance: FileSpreadsheet,
};

const cadenceBadge: Record<ReportDef['cadence'], 'info' | 'brass' | 'warning' | 'default' | 'success'> = {
  Weekly: 'info',
  Monthly: 'brass',
  Quarterly: 'warning',
  'On-demand': 'default',
  'Real-time': 'success',
};

export default function AdminReportsPage() {
  const [category, setCategory] = useState<'All' | ReportDef['category']>('All');
  const [period, setPeriod] = useState<'Last 7 days' | 'Last 30 days' | 'Last 90 days' | 'Custom'>('Last 30 days');
  const [search, setSearch] = useState('');

  const filtered = reports.filter((r) => {
    if (category !== 'All' && r.category !== category) return false;
    if (search && !(r.title.toLowerCase().includes(search.toLowerCase()) || r.description.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const categories = ['All', 'Membership', 'Publications', 'Support', 'Engagement', 'Platform', 'Finance'] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active Members (30d)', value: '198 / 277', sub: '71.5%', trend: '+6.4%', trendDir: 'up' as const, icon: Users, color: 'forum' },
          { label: 'Publications In Review', value: '12', sub: 'SLA 6.2 / 10d', trend: '−1.3d', trendDir: 'up' as const, icon: FolderKanban, color: 'brass' },
          { label: 'New Publications (30d)', value: '27', sub: 'Public views 21,847', trend: '+42%', trendDir: 'up' as const, icon: Globe2, color: 'slateteal' },
          { label: 'Support SLA Compliance', value: '96.3%', sub: '43 resolved', trend: '+1.1%', trendDir: 'up' as const, icon: Headphones, color: 'forum' },
        ].map((m) => {
          const Icon = m.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[m.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                  <span className={`text-xs font-semibold inline-flex items-center gap-0.5 ${m.trendDir === 'up' ? 'text-success-600' : m.trendDir === 'down' ? 'text-danger-600' : 'text-ink-muted'}`}>
                    {m.trendDir === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : m.trendDir === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {m.trend}
                  </span>
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{m.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{m.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{m.sub}</p>
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
                <FileText className="h-5 w-5 text-forum-600" />
                Standard Reports Library
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Pre-built reports. All are exportable, auditable, and include the CRO watermark. Scheduled reports are delivered automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="w-full sm:w-40">
                {categories.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Categories' : v}</option>)}
              </SelectInput>
              <SelectInput value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-full sm:w-44 hidden md:block">
                {['Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom'].map((v) => <option key={v} value={v}>{v}</option>)}
              </SelectInput>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((r) => {
              const CatIcon = categoryIcon[r.category];
              return (
                <div key={r.id} className="rounded-xl border border-paper-border hover:ring-2 hover:ring-forum-600/10 hover:shadow-sm transition-all overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-paper-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-forum-50 text-forum-700 flex items-center justify-center">
                          <CatIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <Badge variant={cadenceBadge[r.cadence]} className="!text-[10px] !py-0">{r.cadence}</Badge>
                          <p className="text-[10px] uppercase tracking-wider text-ink-subtle mt-1.5 font-semibold">{r.category}</p>
                        </div>
                      </div>
                      <Badge variant="info" className="!text-[10px] !py-0">{r.format}</Badge>
                    </div>
                    <h4 className="font-semibold text-forum-900 leading-snug">{r.title}</h4>
                    <p className="text-xs text-ink-muted mt-1.5 line-clamp-2">{r.description}</p>
                  </div>
                  <div className="p-5 bg-paper/50 space-y-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-semibold text-forum-900">{r.metric}</p>
                        <p className="text-[11px] text-ink-subtle mt-0.5">{r.samplePeriod}</p>
                      </div>
                      <span className={`text-xs font-semibold inline-flex items-center gap-1 ${r.trend === 'up' ? 'text-success-600' : r.trend === 'down' ? 'text-danger-600' : 'text-ink-muted'}`}>
                        {r.trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : r.trend === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {r.trendValue}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-paper-border pt-3">
                      {r.lastRun && (
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Last Run</p>
                          <p className="text-ink">{r.lastRun}</p>
                        </div>
                      )}
                      {r.nextRun && (
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Next Run</p>
                          <p className="text-ink">{r.nextRun}</p>
                        </div>
                      )}
                      {r.recipient && (
                        <div className="col-span-2">
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Auto-delivered to</p>
                          <p className="text-ink">{r.recipient}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 border-t border-paper-border bg-paper-raised flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5" />
                        {r.format.includes('XLSX') && <FileSpreadsheet className="h-3.5 w-3.5" />}
                        Export
                      </Button>
                      <Button variant="primary" size="sm">
                        <Mail className="h-3.5 w-3.5" />
                        Run Now
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-brass-700" />
              Scheduled Reports
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {reports.filter((r) => r.nextRun).slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-md bg-brass-100 text-brass-700 flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forum-900 truncate max-w-[200px]">{r.title}</p>
                    <p className="text-[11px] text-ink-subtle">{r.nextRun} · {r.recipient}</p>
                  </div>
                </div>
                <Badge variant={cadenceBadge[r.cadence]} className="!text-[10px] !py-0">{r.cadence}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-600" />
              Reports Requiring CRO Attention
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {[
              { when: 'Due today', title: 'Review SLA Performance', issue: '2 publications over 10-day SLA threshold', severity: 'warning' as const },
              { when: 'Past due', title: 'Funding & Support Disbursement', issue: 'Q2 audit sign-off still pending SAB Chair', severity: 'danger' as const },
              { when: 'This week', title: 'Publications Impact Report', issue: '34 external citation counts need manual verification', severity: 'default' as const },
            ].map((r) => (
              <div key={r.title} className={`flex items-start justify-between p-3 rounded-lg border ${r.severity === 'danger' ? 'border-danger-600/30 bg-danger-100/30' : r.severity === 'warning' ? 'border-warning-600/30 bg-warning-100/30' : 'border-paper-border'}`}>
                <div className="flex items-start gap-3 min-w-0">
                  <Badge variant={r.severity === 'danger' ? 'danger' : r.severity === 'warning' ? 'warning' : 'info'} className="!text-[10px] !py-0">{r.when}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forum-900">{r.title}</p>
                    <p className="text-[11px] text-ink-muted">{r.issue}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0 mt-0.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
