import {
  FileText,
  FolderKanban,
  MessageSquare,
  Eye,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Upload,
  BookOpenCheck,
  DollarSign,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Link } from 'react-router-dom';

const stats = [
  { label: 'Projects', value: '7', change: '+2', icon: FolderKanban, color: 'forum' },
  { label: 'Published Papers', value: '4', change: '+1', icon: FileText, color: 'slateteal' },
  { label: 'Support Requests', value: '2', change: 'Active', icon: ShieldCheck, color: 'brass' },
  { label: 'Publications Views', value: '3,247', change: '+18%', icon: Eye, color: 'forum' },
];

const recentProjects = [
  { id: 'p1', title: 'CBT in Digital Mental Health Platforms', status: 'Published', support: 'Official', date: 'Jul 15, 2026', statusColor: 'success' as const },
  { id: 'p2', title: 'Biomarker Panels for MDD Subtyping', status: 'Under Review', support: 'Funding', date: 'Jul 08, 2026', statusColor: 'warning' as const },
  { id: 'p3', title: 'Wearable EEG Device Validation', status: 'Submitted', support: 'Moral', date: 'Jun 30, 2026', statusColor: 'info' as const },
  { id: 'p4', title: 'Youth Teletherapy Utilization Study', status: 'Draft', support: 'Funding', date: 'Jun 22, 2026', statusColor: 'default' as const },
];

const recentMessages = [
  { id: 'm1', from: 'Chief Research Officer', subject: 'Re: Biomarker Study — Funding Endorsement', time: '2h ago', unread: true, type: 'Document' },
  { id: 'm2', from: 'CRO Office', subject: 'Invitation: Digital Mental Health Symposium', time: '1d ago', unread: true, type: 'Announcement' },
  { id: 'm3', from: 'Chief Research Officer', subject: 'CBT paper published — congratulations!', time: '3d ago', unread: false, type: 'Update' },
];

const upcomingEvents = [
  { date: 'Sep 12', title: 'Digital Mental Health Symposium', type: 'Symposium' },
  { date: 'Oct 03', title: 'Crisis Support Workshop', type: 'Workshop' },
  { date: 'Oct 27', title: 'Annual Research Showcase', type: 'Conference' },
];

const colorMap = {
  forum: { icon: 'bg-forum-50 text-forum-700', change: 'text-forum-700 bg-forum-50' },
  slateteal: { icon: 'bg-slateteal-100 text-slateteal-700', change: 'text-slateteal-700 bg-slateteal-100' },
  brass: { icon: 'bg-brass-100 text-brass-700', change: 'text-brass-700 bg-brass-100' },
};

export default function DashboardHomePage() {
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-inset ring-white/20 text-brass-100">
              <TrendingUp className="h-3.5 w-3.5" />
              Member Since March 2024
            </span>
            <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold leading-tight">
              Welcome back, Dr. Chen 👋
            </h2>
            <p className="mt-2 text-forum-100/80 max-w-xl">
              You have <strong className="text-brass-100">3 unread messages</strong> from the CRO office and{' '}
              <strong className="text-brass-100">1 project under review</strong>.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button as="link" to="/dashboard/projects/upload" size="lg" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
              <Upload className="h-4.5 w-4.5" />
              Upload Project
            </Button>
            <Button as="link" to="/dashboard/messages" size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 bg-transparent">
              <MessageSquare className="h-4.5 w-4.5" />
              View Messages
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          const cls = colorMap[s.color as keyof typeof colorMap];
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${cls.icon}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls.change}`}>
                    {s.change}
                  </span>
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-forum-900">{s.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900">
                My Recent Projects
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Latest status across your research portfolio</p>
            </div>
            <Button as="link" to="/dashboard/projects" variant="ghost" size="sm">
              View All
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="overflow-x-auto -mx-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-paper-border text-left">
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Project</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Support</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Date</th>
                    <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentProjects.map((p) => (
                    <tr key={p.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                      <td className="py-3.5 px-2">
                        <p className="font-medium text-forum-900 truncate max-w-xs">{p.title}</p>
                      </td>
                      <td className="py-3.5 px-2">
                        <Badge variant={p.statusColor}>
                          {p.status === 'Published' ? <CheckCircle2 className="h-3 w-3 mr-1" /> :
                           p.status === 'Under Review' ? <Clock className="h-3 w-3 mr-1" /> :
                           p.status === 'Submitted' ? <AlertCircle className="h-3 w-3 mr-1" /> : null}
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          {p.support === 'Funding' ? <DollarSign className="h-3.5 w-3.5 text-brass-700" /> :
                           p.support === 'Official' ? <ShieldCheck className="h-3.5 w-3.5 text-forum-700" /> :
                           <HeartHandshake className="h-3.5 w-3.5 text-slateteal-700" />}
                          {p.support}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-ink-subtle hidden md:table-cell">{p.date}</td>
                      <td className="py-3.5 px-2 text-right">
                        <Link
                          to={`/dashboard/projects/${p.id}`}
                          className="text-xs font-semibold text-forum-700 hover:text-forum-900"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900">
              Upcoming Events
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">IFSMHP gatherings & deadlines</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {upcomingEvents.map((e) => (
              <div key={e.title} className="flex items-center gap-3 p-3 rounded-lg hover:bg-forum-50/60 transition-colors">
                <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-forum-50 border border-forum-100">
                  <span className="text-[10px] uppercase tracking-wider text-forum-700 font-medium leading-none">
                    {e.date.split(' ')[0]}
                  </span>
                  <span className="font-display text-lg font-bold text-forum-900 leading-none mt-0.5">
                    {e.date.split(' ')[1]}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-forum-900 text-sm truncate">{e.title}</p>
                  <Badge variant="info" className="mt-1">
                    <Calendar className="h-2.5 w-2.5 mr-1" />
                    {e.type}
                  </Badge>
                </div>
              </div>
            ))}
            <Button as="link" to="/events" variant="ghost" size="sm" className="w-full justify-center mt-2">
              Browse All Events
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900">
                Messages from CRO
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Direct communication with Chief Research Officer</p>
            </div>
            <Button as="link" to="/dashboard/messages" variant="ghost" size="sm">
              View Inbox
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {recentMessages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-3 p-3.5 rounded-lg transition-colors ${
                  m.unread ? 'bg-brass-100/30 border border-brass-500/20' : 'hover:bg-forum-50/40'
                }`}
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  m.unread ? 'bg-brass-500 text-white' : 'bg-forum-100 text-forum-700'
                }`}>
                  {m.unread ? <MessageSquare className="h-4 w-4" /> : <BookOpenCheck className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium text-sm ${m.unread ? 'text-forum-900' : 'text-ink-muted'}`}>
                      {m.from}
                    </p>
                    <Badge variant={m.unread ? 'brass' : 'default'}>{m.type}</Badge>
                    {m.unread && <span className="text-[10px] font-semibold text-brass-700 uppercase tracking-wider">New</span>}
                  </div>
                  <p className={`text-sm mt-0.5 truncate ${m.unread ? 'text-forum-900 font-medium' : 'text-ink-muted'}`}>
                    {m.subject}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-subtle whitespace-nowrap">{m.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900">
              Quick Actions
            </h3>
          </CardHeader>
          <CardContent className="pt-0 grid grid-cols-2 gap-2">
            {[
              { to: '/dashboard/projects/upload', icon: Upload, label: 'Upload Project', color: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white' },
              { to: '/dashboard/support', icon: ShieldCheck, label: 'Request Support', color: 'bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white' },
              { to: '/dashboard/publications', icon: FileText, label: 'My Publications', color: 'bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white' },
              { to: '/dashboard/documents', icon: MessageSquare, label: 'Send to CRO', color: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white' },
            ].map((a) => {
              const Icon = a.icon;
              return (
                <Link
                  key={a.label}
                  to={a.to}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-paper-border transition-colors hover:border-transparent ${a.color}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs font-medium text-center leading-tight">{a.label}</span>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
