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
import { memberApi } from '../../api/member';
import { useApiData } from '../../hooks/useApiData';

interface DashboardData {
  member: { name: string; memberSince: string | Date };
  stats: {
    projects: { total: number; inReview: number };
    publications: { published: number; inReview: number };
    supportTickets: { open: number };
    unreadMessages: number;
  };
  recentProjects: Array<{ id: string; title: string; status: string; support: string[]; updated: string | Date }>;
  recentMessages: Array<{ id: string; senderName: string; body: string; createdAt: string | Date }>;
  upcomingEvents: Array<{ id: string; slug?: string; title: string; date: string | Date; format?: string }>;
}

const colorMap = {
  forum: { icon: 'bg-forum-50 text-forum-700', change: 'text-forum-700 bg-forum-50' },
  slateteal: { icon: 'bg-slateteal-100 text-slateteal-700', change: 'text-slateteal-700 bg-slateteal-100' },
  brass: { icon: 'bg-brass-100 text-brass-700', change: 'text-brass-700 bg-brass-100' },
};

export default function DashboardHomePage() {
  const { data, loading, error } = useApiData<DashboardData>(() => memberApi.dashboard() as Promise<DashboardData>, []);
  const stats = [
    { label: 'Projects', value: String(data?.stats.projects.total ?? 0), change: `${data?.stats.projects.inReview ?? 0} in review`, icon: FolderKanban, color: 'forum' },
    { label: 'Published Papers', value: String(data?.stats.publications.published ?? 0), change: `${data?.stats.publications.inReview ?? 0} in review`, icon: FileText, color: 'slateteal' },
    { label: 'Support Requests', value: String(data?.stats.supportTickets.open ?? 0), change: 'Active', icon: ShieldCheck, color: 'brass' },
    { label: 'Unread Messages', value: String(data?.stats.unreadMessages ?? 0), change: 'Inbox', icon: Eye, color: 'forum' },
  ];
  const recentProjects = data?.recentProjects ?? [];
  const recentMessages = data?.recentMessages ?? [];
  const upcomingEvents = data?.upcomingEvents ?? [];

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
              {loading ? 'Loading dashboard...' : `Member Since ${data?.member.memberSince ? new Date(data.member.memberSince).toLocaleDateString() : 'Approval Pending'}`}
            </span>
            <h2 className="mt-4 font-display text-2xl sm:text-3xl font-semibold leading-tight text-white">
              Welcome back, {data?.member.name ?? 'Member'} 👋
            </h2>
            <p className="mt-2 text-forum-100/80 max-w-xl">
              You have <strong className="text-brass-100">{data?.stats.unreadMessages ?? 0} unread messages</strong> from the CRO office and{' '}
              <strong className="text-brass-100">{data?.stats.projects.inReview ?? 0} projects under review</strong>.
              {error ? <span className="block text-brass-100">{error}</span> : null}
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
                        <Badge variant={p.status === 'Published' ? 'success' : p.status === 'Under Review' ? 'warning' : p.status === 'Submitted' ? 'info' : 'default'}>
                          {p.status === 'Published' ? <CheckCircle2 className="h-3 w-3 mr-1" /> :
                           p.status === 'Under Review' ? <Clock className="h-3 w-3 mr-1" /> :
                           p.status === 'Submitted' ? <AlertCircle className="h-3 w-3 mr-1" /> : null}
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 hidden sm:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          {p.support[0] === 'Funding' ? <DollarSign className="h-3.5 w-3.5 text-brass-700" /> :
                           p.support[0] === 'Official' ? <ShieldCheck className="h-3.5 w-3.5 text-forum-700" /> :
                           <HeartHandshake className="h-3.5 w-3.5 text-slateteal-700" />}
                          {p.support[0] ?? 'None'}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-ink-subtle hidden md:table-cell">{new Date(p.updated).toLocaleDateString()}</td>
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
                    {new Date(e.date).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                  <span className="font-display text-lg font-bold text-forum-900 leading-none mt-0.5">
                    {new Date(e.date).getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-forum-900 text-sm truncate">{e.title}</p>
                  <Badge variant="info" className="mt-1">
                    <Calendar className="h-2.5 w-2.5 mr-1" />
                    {e.format ?? 'Event'}
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
                  'hover:bg-forum-50/40'
                }`}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forum-100 text-forum-700">
                  <BookOpenCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm text-ink-muted">
                      {m.senderName}
                    </p>
                    <Badge variant="default">Message</Badge>
                  </div>
                  <p className="text-sm mt-0.5 truncate text-ink-muted">
                    {m.body}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ink-subtle whitespace-nowrap">{new Date(m.createdAt).toLocaleDateString()}</span>
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
          <CardContent className="pt-0 grid grid-cols-2 gap-2 mt-4">
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
