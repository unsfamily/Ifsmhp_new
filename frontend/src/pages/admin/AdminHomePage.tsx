import {
  Users,
  FolderKanban,
  FileText,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Eye,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Building2,
  BarChart3,
  Award,
  MessageSquare,
  ChevronRight,
  Calendar,
  IdCard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

const kpis = [
  { label: 'Total Members', value: '277', change: '+14 this week', trend: 'up', icon: Users, color: 'forum' },
  { label: 'Active Projects', value: '142', change: '+8 submitted', trend: 'up', icon: FolderKanban, color: 'slateteal' },
  { label: 'Publications Queue', value: '12', change: '-3 approved', trend: 'down', icon: FileText, color: 'brass' },
  { label: 'Open Support Tickets', value: '23', change: '+2 urgent', trend: 'up', icon: ShieldCheck, color: 'forum' },
];

const membersToReview = [
  { id: 'mr1', name: 'Dr. Anika Kapoor', role: 'Clinical Psychologist', institution: 'AIIMS Delhi', country: 'India', applied: '3 days ago', type: 'Professional' },
  { id: 'mr2', name: 'Prof. Henrik Lindberg', role: 'Neuroscientist', institution: 'Karolinska Institutet', country: 'Sweden', applied: '2 days ago', type: 'Scientist' },
  { id: 'mr3', name: 'Dr. Maya Fernández', role: 'Child Psychiatrist', institution: 'Hospital Clínico UCH', country: 'Chile', applied: '1 day ago', type: 'Professional' },
  { id: 'mr4', name: 'Dr. Theo Mbeki', role: 'Public Health Researcher', institution: 'Wits University', country: 'South Africa', applied: '4 hours ago', type: 'Scientist' },
];

const projectsAwaiting = [
  { id: 'pa1', title: 'AI-driven suicide risk assessment in emergency departments', member: 'Dr. N. Hargrove', support: 'Funding', days: 2, priority: 'High' },
  { id: 'pa2', title: 'Postpartum depression screening protocol for low-resource settings', member: 'Dr. M. Fernández', support: 'Official', days: 3, priority: 'Standard' },
  { id: 'pa3', title: 'Sleep intervention RCT in refugee populations', member: 'Prof. H. Lindberg', support: 'Moral + Funding', days: 1, priority: 'Urgent' },
  { id: 'pa4', title: 'Validation of Bahasa depression screening tool', member: 'Dr. S. Wijaya', support: 'Official', days: 4, priority: 'Standard' },
  { id: 'pa5', title: 'Psilocybin therapy protocol for palliative care', member: 'Prof. M. Whitfield', support: 'Official + Funding', days: 6, priority: 'High' },
];

const trendColors = {
  up: 'text-success-600 bg-success-100',
  down: 'text-danger-600 bg-danger-100',
};

const colorBg = {
  forum: 'bg-forum-50 text-forum-700',
  slateteal: 'bg-slateteal-100 text-slateteal-700',
  brass: 'bg-brass-100 text-brass-700',
};

const memberTypeColors = { Scientist: 'default' as const, Professional: 'info' as const };

export default function AdminHomePage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-600 via-forum-700 to-forum-900 p-6 sm:p-8 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <Badge variant="brass">
              <BarChart3 className="h-2.5 w-2.5 mr-1" />
              System Overview
            </Badge>
            <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold leading-tight">
              Welcome back — 8 new actions require your review today.
            </h2>
            <p className="mt-2 text-forum-100/80 max-w-2xl">
              Membership growth is tracking ahead of 2027 targets. Publication backlog is within SLA. Two high-priority funding decisions are pending.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button as="link" to="/admin/members" size="lg" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
              <Users className="h-4.5 w-4.5" />
              Review Applications
            </Button>
            <Button as="link" to="/admin/publications" size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
              <FileText className="h-4.5 w-4.5" />
              Approve Publications
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          const TrendIcon = k.trend === 'up' ? TrendingUp : TrendingDown;
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${colorBg[k.color as keyof typeof colorBg]}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trendColors[k.trend as keyof typeof trendColors]}`}>
                    <TrendIcon className="h-3 w-3" />
                    {k.change}
                  </span>
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <p className="font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                  <ChevronRight className="h-5 w-5 text-ink-subtle" />
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-forum-600" />
                New Member Applications — Pending Review
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Awaiting credential verification and committee approval</p>
            </div>
            <Button as="link" to="/admin/members" variant="ghost" size="sm">
              View Queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-paper-border text-left">
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Applicant</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Institution</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Type</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Applied</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {membersToReview.map((m) => (
                    <tr key={m.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                      <td className="py-3.5 px-2">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold">
                            {m.name.split(' ').slice(1, 2).concat(m.name.split(' ').slice(-1)).map((n) => n[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-forum-900">{m.name}</p>
                            <p className="text-xs text-ink-muted truncate max-w-[200px]">{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden sm:table-cell">
                        <div className="text-sm">
                          <p className="text-ink">{m.institution}</p>
                          <p className="text-xs text-ink-subtle inline-flex items-center gap-1 mt-0.5">
                            <Building2 className="h-3 w-3" />
                            {m.country}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden md:table-cell">
                        <Badge variant={memberTypeColors[m.type as keyof typeof memberTypeColors]}>{m.type}</Badge>
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <Clock className="h-3 w-3" />
                          {m.applied}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button className="inline-flex items-center gap-1 rounded-md bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors">
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </button>
                          <button className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors">
                            <Eye className="h-3 w-3" />
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-brass-700" />
                Support Priority Alerts
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {[
                { level: 'Urgent', icon: AlertCircle, text: '2 funding deadlines in next 72h', tone: 'danger' },
                { level: 'High', icon: Clock, text: '5 approvals past 48-hour SLA target', tone: 'warning' },
                { level: 'Info', icon: Award, text: '12 Member IDs ready to be issued', tone: 'info' },
                { level: 'Info', icon: Calendar, text: '3 symposium proposals due Friday', tone: 'default' },
              ].map((a, i) => {
                const Icon = a.icon;
                const toneCls = {
                  danger: 'bg-danger-100 text-danger-600 border-danger-600/20',
                  warning: 'bg-warning-100 text-warning-600 border-warning-600/20',
                  info: 'bg-slateteal-100 text-slateteal-700 border-slateteal-500/20',
                  default: 'bg-forum-50 text-forum-700 border-forum-200',
                }[a.tone];
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${toneCls}`}>
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{a.level}</p>
                      <p className="text-sm font-medium mt-0.5">{a.text}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <IdCard className="h-5 w-5 text-slateteal-500" />
                Quick Actions
              </h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              {[
                { to: '/admin/members', icon: IdCard, label: 'Issue Member IDs', tone: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white' },
                { to: '/admin/projects', icon: DollarSign, label: 'Grant Decisions', tone: 'bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white' },
                { to: '/admin/publications', icon: FileText, label: 'Paper Approvals', tone: 'bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white' },
                { to: '/admin/reports', icon: BarChart3, label: 'Monthly Report', tone: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white' },
              ].map((q, i) => {
                const Icon = q.icon;
                return (
                  <Link
                    key={i}
                    to={q.to}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-paper-border transition-all hover:border-transparent ${q.tone}`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium text-center leading-tight">{q.label}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-forum-600" />
              Project Reviews — Awaiting CRO Decision
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Support request vetting by priority queue</p>
          </div>
          <Button as="link" to="/admin/projects" variant="ghost" size="sm">
            All Projects
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-border text-left">
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Project</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Member</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Support</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Priority</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Queue</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Decision</th>
                </tr>
              </thead>
              <tbody>
                {projectsAwaiting.map((p) => (
                  <tr key={p.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                    <td className="py-3.5 px-2 max-w-md">
                      <p className="font-medium text-forum-900 leading-snug">{p.title}</p>
                    </td>
                    <td className="py-3.5 px-2 text-ink-muted hidden sm:table-cell">{p.member}</td>
                    <td className="py-3.5 px-2">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-forum-700 bg-forum-50 rounded-full px-2 py-0.5">
                        <DollarSign className="h-3 w-3" />
                        {p.support}
                      </span>
                    </td>
                    <td className="py-3.5 px-2">
                      <Badge variant={p.priority === 'Urgent' ? 'danger' : p.priority === 'High' ? 'warning' : 'default'}>
                        {p.priority}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${p.days >= 5 ? 'text-danger-600 font-semibold' : p.days >= 3 ? 'text-warning-600 font-medium' : 'text-ink-muted'}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {p.days} {p.days === 1 ? 'day' : 'days'}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 text-right">
                      <div className="inline-flex gap-1.5 items-center">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3.5 w-3.5" />
                          Review
                        </Button>
                        <button className="inline-flex items-center gap-1 rounded-md bg-forum-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forum-700 transition-colors">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Decide
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
