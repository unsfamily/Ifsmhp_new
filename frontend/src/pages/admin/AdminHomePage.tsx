import {
  Users,
  FolderKanban,
  FileText,
  ShieldCheck,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  Bell,
  UserCircle2,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Eye,
  ArrowRight,
  UserPlus,
  FileCheck,
  Send,
  MessageSquare,
  Sparkles,
  History,
  Minus,
  Award,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

const DEMO_LABEL = '[DEMO DATA — API pending]';

const formatCurrentDate = () => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return new Date().toLocaleDateString('en-US', options);
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

interface KpiItem {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'flat';
  trendText: string;
  icon: typeof Users;
  color: 'forum' | 'slateteal' | 'brass';
  linkTo: string;
}

const kpis: KpiItem[] = [
  {
    label: 'Total Members',
    value: '277',
    trend: 'up',
    trendText: '+14 this week',
    icon: Users,
    color: 'forum',
    linkTo: '/admin/members',
  },
  {
    label: 'Pending Applications',
    value: '6',
    trend: 'up',
    trendText: '+2 new today',
    icon: Clock,
    color: 'brass',
    linkTo: '/admin/members/pending',
  },
  {
    label: 'Active Research Projects',
    value: '142',
    trend: 'up',
    trendText: '+8 submitted',
    icon: FolderKanban,
    color: 'slateteal',
    linkTo: '/admin/projects',
  },
  {
    label: 'Publications Awaiting Review',
    value: '12',
    trend: 'down',
    trendText: '-3 approved',
    icon: FileText,
    color: 'brass',
    linkTo: '/admin/publications',
  },
  {
    label: 'Open Support Requests',
    value: '23',
    trend: 'up',
    trendText: '+2 urgent',
    icon: ShieldCheck,
    color: 'forum',
    linkTo: '/admin/support',
  },
  {
    label: 'Upcoming Events',
    value: '5',
    trend: 'flat',
    trendText: '1 this week',
    icon: Calendar,
    color: 'slateteal',
    linkTo: '/admin/events',
  },
];

type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';

interface ActionItem {
  id: string;
  category:
    | 'Membership'
    | 'Project'
    | 'Support'
    | 'Publication'
    | 'Event';
  priority: Priority;
  title: string;
  member: string;
  date: string;
  status: string;
  statusVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass';
  reviewLink: string;
  icon: typeof Users;
}

const actionItems: ActionItem[] = [
  {
    id: 'a1',
    category: 'Support',
    priority: 'Urgent',
    title: 'Critical: Account access locked — password recovery escalation',
    member: 'Dr. N. Hargrove',
    date: '1 hour ago',
    status: 'Awaiting Response',
    statusVariant: 'danger',
    reviewLink: '/admin/support/sr-0412',
    icon: ShieldCheck,
  },
  {
    id: 'a2',
    category: 'Project',
    priority: 'Urgent',
    title: 'Funding deadline: Sleep intervention RCT in refugee populations',
    member: 'Prof. H. Lindberg',
    date: 'Due in 48h',
    status: 'Awaiting CRO Decision',
    statusVariant: 'danger',
    reviewLink: '/admin/projects/prj-0087',
    icon: FolderKanban,
  },
  {
    id: 'a3',
    category: 'Membership',
    priority: 'High',
    title: 'New application — credential verification pending',
    member: 'Dr. Maya Fernández',
    date: '1 day ago',
    status: 'Under Review',
    statusVariant: 'warning',
    reviewLink: '/admin/members/mr3',
    icon: UserPlus,
  },
  {
    id: 'a4',
    category: 'Publication',
    priority: 'High',
    title: 'Manuscript: Prevalence of adolescent anxiety in post-conflict zones',
    member: 'Dr. Theo Mbeki',
    date: 'Submitted 2 days ago',
    status: 'Awaiting Reviewer Assign',
    statusVariant: 'warning',
    reviewLink: '/admin/publications/pub-0319',
    icon: FileCheck,
  },
  {
    id: 'a5',
    category: 'Project',
    priority: 'High',
    title: 'AI-driven suicide risk assessment — funding request',
    member: 'Dr. N. Hargrove',
    date: 'Pending 2 days',
    status: 'Awaiting Approval',
    statusVariant: 'warning',
    reviewLink: '/admin/projects/prj-0092',
    icon: FolderKanban,
  },
  {
    id: 'a6',
    category: 'Membership',
    priority: 'Normal',
    title: 'New application — standard review queue',
    member: 'Prof. Henrik Lindberg',
    date: '2 days ago',
    status: 'Pending',
    statusVariant: 'info',
    reviewLink: '/admin/members/mr2',
    icon: UserPlus,
  },
  {
    id: 'a7',
    category: 'Publication',
    priority: 'Normal',
    title: 'Revision resubmission: Cultural adaptation of CBT manual',
    member: 'Dr. Siti Wijaya',
    date: '3 days ago',
    status: 'Review In Progress',
    statusVariant: 'info',
    reviewLink: '/admin/publications/pub-0304',
    icon: FileText,
  },
  {
    id: 'a8',
    category: 'Event',
    priority: 'Normal',
    title: 'Symposium proposal deadline — Global Mental Health Forum',
    member: 'Events Committee',
    date: 'Due Friday',
    status: 'Proposal Review',
    statusVariant: 'brass',
    reviewLink: '/admin/events/ev-0056',
    icon: Calendar,
  },
  {
    id: 'a9',
    category: 'Support',
    priority: 'Low',
    title: 'Profile photo update — moderation review',
    member: 'Dr. Ana Pereira',
    date: '4 days ago',
    status: 'Pending',
    statusVariant: 'default',
    reviewLink: '/admin/support/sr-0403',
    icon: MessageSquare,
  },
  {
    id: 'a10',
    category: 'Event',
    priority: 'Low',
    title: 'Workshop room booking request — Annual Retreat',
    member: 'Admin Team',
    date: 'Scheduled Oct 2026',
    status: 'Awaiting Confirmation',
    statusVariant: 'default',
    reviewLink: '/admin/events/ev-0051',
    icon: Calendar,
  },
];

type ActivityType =
  | 'application_submitted'
  | 'application_approved'
  | 'project_submitted'
  | 'support_updated'
  | 'publication_submitted'
  | 'publication_approved'
  | 'event_created'
  | 'admin_action';

interface ActivityItem {
  id: string;
  type: ActivityType;
  activity: string;
  user: string;
  timestamp: string;
  status: string;
  statusVariant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass';
  icon: typeof Users;
  iconTone: string;
}

const activityFeed: ActivityItem[] = [
  {
    id: 'act1',
    type: 'application_submitted',
    activity: 'New membership application submitted',
    user: 'Dr. Anika Kapoor',
    timestamp: '15 minutes ago',
    status: 'Pending Review',
    statusVariant: 'warning',
    icon: UserPlus,
    iconTone: 'bg-forum-100 text-forum-700',
  },
  {
    id: 'act2',
    type: 'admin_action',
    activity: 'Admin action — Batch issued 5 member IDs',
    user: 'Chief Research Officer',
    timestamp: '1 hour ago',
    status: 'Completed',
    statusVariant: 'success',
    icon: Award,
    iconTone: 'bg-brass-100 text-brass-700',
  },
  {
    id: 'act3',
    type: 'publication_approved',
    activity: 'Publication approved: "Trauma-informed care in pediatric settings"',
    user: 'Dr. Emma Thompson',
    timestamp: '2 hours ago',
    status: 'Published',
    statusVariant: 'success',
    icon: FileCheck,
    iconTone: 'bg-success-100 text-success-600',
  },
  {
    id: 'act4',
    type: 'support_updated',
    activity: 'Support request updated — escalated to urgent',
    user: 'Dr. N. Hargrove',
    timestamp: '3 hours ago',
    status: 'Urgent',
    statusVariant: 'danger',
    icon: ShieldCheck,
    iconTone: 'bg-danger-100 text-danger-600',
  },
  {
    id: 'act5',
    type: 'project_submitted',
    activity: 'Research project submitted for review',
    user: 'Prof. Yuki Tanaka',
    timestamp: '5 hours ago',
    status: 'Under Review',
    statusVariant: 'info',
    icon: FolderKanban,
    iconTone: 'bg-slateteal-100 text-slateteal-700',
  },
  {
    id: 'act6',
    type: 'application_approved',
    activity: 'Membership application approved — ID assigned',
    user: 'Dr. Sarah Chen',
    timestamp: '6 hours ago',
    status: 'Active',
    statusVariant: 'success',
    icon: CheckCircle2,
    iconTone: 'bg-success-100 text-success-600',
  },
  {
    id: 'act7',
    type: 'publication_submitted',
    activity: 'Manuscript submitted: "Validation of Bahasa depression screening"',
    user: 'Dr. Siti Wijaya',
    timestamp: 'Yesterday, 4:30 PM',
    status: 'Awaiting Review',
    statusVariant: 'warning',
    icon: Send,
    iconTone: 'bg-brass-100 text-brass-700',
  },
  {
    id: 'act8',
    type: 'event_created',
    activity: 'Event created: Annual Research Symposium 2026',
    user: 'Events Committee',
    timestamp: 'Yesterday, 2:15 PM',
    status: 'Scheduled',
    statusVariant: 'brass',
    icon: Calendar,
    iconTone: 'bg-brass-100 text-brass-700',
  },
  {
    id: 'act9',
    type: 'support_updated',
    activity: 'Support request: Document exchange access granted',
    user: 'Dr. Michael Brown',
    timestamp: 'Yesterday, 11:00 AM',
    status: 'Resolved',
    statusVariant: 'success',
    icon: MessageSquare,
    iconTone: 'bg-forum-100 text-forum-700',
  },
  {
    id: 'act10',
    type: 'admin_action',
    activity: 'Admin action — Announcement posted: Q3 review cycle open',
    user: 'Chief Research Officer',
    timestamp: '2 days ago',
    status: 'Sent',
    statusVariant: 'info',
    icon: Sparkles,
    iconTone: 'bg-slateteal-100 text-slateteal-700',
  },
];

const priorityBadge: Record<Priority, 'danger' | 'warning' | 'info' | 'default'> = {
  Urgent: 'danger',
  High: 'warning',
  Normal: 'info',
  Low: 'default',
};

const priorityIcon: Record<Priority, typeof AlertTriangle> = {
  Urgent: AlertCircle,
  High: AlertTriangle,
  Normal: Clock,
  Low: Minus,
};

const trendClasses = {
  up: 'text-success-600 bg-success-100',
  down: 'text-danger-600 bg-danger-100',
  flat: 'text-ink-muted bg-forum-100',
};

const colorBg = {
  forum: 'bg-forum-50 text-forum-700',
  slateteal: 'bg-slateteal-100 text-slateteal-700',
  brass: 'bg-brass-100 text-brass-700',
};

export default function AdminHomePage() {
  const greeting = getGreeting();
  const currentDate = formatCurrentDate();

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {currentDate}
                </span>
                <span className="text-paper-border">·</span>
                <Badge variant="brass">
                  <Sparkles className="h-2.5 w-2.5 mr-1" />
                  {DEMO_LABEL}
                </Badge>
              </div>
              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
                {greeting}, Chief Research Officer
              </h2>
              <p className="mt-2 text-ink-muted text-base leading-relaxed">
                Review platform activity, member applications, research and publication workflows.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/admin/announcements"
                className="relative inline-flex items-center justify-center rounded-lg h-10 w-10 text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors border border-paper-border bg-paper"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-brass-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-paper-raised">
                  3
                </span>
              </Link>
              <Link
                to="/admin/profile"
                className="inline-flex items-center gap-3 rounded-lg border border-paper-border bg-paper px-3 py-2 hover:bg-forum-50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-sm font-bold">
                  CRO
                </div>
                <div className="hidden sm:block leading-tight text-left">
                  <p className="text-sm font-semibold text-forum-900">Admin</p>
                  <p className="text-xs text-ink-subtle">Chief Research Office</p>
                </div>
                <UserCircle2 className="h-4.5 w-4.5 text-ink-subtle hidden sm:block" />
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== KPI CARDS ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => {
          const Icon = k.icon;
          const TrendIcon = k.trend === 'up' ? TrendingUp : k.trend === 'down' ? TrendingDown : Minus;
          return (
            <Link
              key={k.label}
              to={k.linkTo}
              className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 focus-visible:ring-offset-2 rounded-lg"
            >
              <Card className="h-full transition-all duration-150 group-hover:shadow-md group-hover:-translate-y-0.5 group-hover:border-forum-300">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${colorBg[k.color]}`}>
                      <Icon className="h-5.5 w-5.5" />
                    </div>
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${trendClasses[k.trend]}`}>
                      <TrendIcon className="h-3 w-3" />
                      {k.trendText}
                    </span>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <p className="font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                    <ChevronRight className="h-5 w-5 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-forum-700" />
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ===== DASHBOARD ACTION CENTER ===== */}
      <Card>
        <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-danger-100 text-danger-600 shrink-0">
              <AlertTriangle className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                Requires Your Attention
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">
                Priority-queued items across the platform that need administrative review
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['Urgent', 'High', 'Normal', 'Low'] as Priority[]).map((p) => {
              const count = actionItems.filter((i) => i.priority === p).length;
              const PIcon = priorityIcon[p];
              return (
                <Badge key={p} variant={priorityBadge[p]} className="gap-1">
                  <PIcon className="h-2.5 w-2.5" />
                  {p} · {count}
                </Badge>
              );
            })}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-paper-border">
            {actionItems.map((item) => {
              const PriIcon = priorityIcon[item.priority];
              const ItemIcon = item.icon;
              return (
                <li
                  key={item.id}
                  className="py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-forum-50/40 -mx-2 px-2 rounded-md transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <Badge variant={priorityBadge[item.priority]} className="gap-1 py-1">
                        <PriIcon className="h-3 w-3" />
                        {item.priority}
                      </Badge>
                      <div className={`h-9 w-9 flex items-center justify-center rounded-lg ${colorBg.brass} hidden sm:flex`}>
                        <ItemIcon className="h-4.5 w-4.5" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="default" className="text-[10px] uppercase tracking-wider font-semibold">
                          {item.category}
                        </Badge>
                        <Badge variant={item.statusVariant}>
                          {item.status}
                        </Badge>
                      </div>
                      <p className="font-medium text-forum-900 leading-snug">
                        {item.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.member}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {item.date}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 sm:ml-4 w-full sm:w-auto">
                    <Button as="link" to={item.reviewLink} variant="outline" size="sm" className="w-full sm:w-auto">
                      <Eye className="h-3.5 w-3.5" />
                      {item.category === 'Support' ? 'Respond' : 'Review'}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex justify-end pt-2 border-t border-paper-border">
            <Badge variant="default">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {DEMO_LABEL}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ===== RECENT ACTIVITY FEED ===== */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700 shrink-0">
                <History className="h-5.5 w-5.5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900">
                  Recent Activity
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Chronological platform events and administrative actions
                </p>
              </div>
            </div>
            <Button as="link" to="/admin/audit-log" variant="ghost" size="sm">
              Full Audit Log
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            <ol className="relative border-l border-paper-border ml-4 space-y-5">
              {activityFeed.map((a, idx) => {
                const AIcon = a.icon;
                const isLast = idx === activityFeed.length - 1;
                return (
                  <li key={a.id} className={`pl-5 relative ${isLast ? '' : 'pb-1'}`}>
                    <span className={`absolute -left-[17px] top-0.5 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-paper-raised ${a.iconTone}`}>
                      <AIcon className="h-4 w-4" />
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-sm font-medium text-forum-900 leading-snug">
                        {a.activity}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <UserCircle2 className="h-3 w-3" />
                          {a.user}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                          <Clock className="h-3 w-3" />
                          {a.timestamp}
                        </span>
                        <Badge variant={a.statusVariant}>
                          {a.status}
                        </Badge>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex justify-end pt-2 border-t border-paper-border">
              <Badge variant="default">
                <Sparkles className="h-2.5 w-2.5 mr-1" />
                {DEMO_LABEL}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ===== QUICK ACTIONS / SIDE PANEL ===== */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brass-700" />
                Quick Actions
              </h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2.5">
              {[
                { to: '/admin/members/pending', icon: UserPlus, label: 'Review Applications', tone: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white border-forum-200' },
                { to: '/admin/projects', icon: FolderKanban, label: 'Grant Decisions', tone: 'bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white border-brass-200' },
                { to: '/admin/publications', icon: FileText, label: 'Paper Approvals', tone: 'bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white border-slateteal-200' },
                { to: '/admin/support', icon: ShieldCheck, label: 'Support Queue', tone: 'bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white border-forum-200' },
                { to: '/admin/events', icon: Calendar, label: 'Manage Events', tone: 'bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white border-slateteal-200' },
                { to: '/admin/announcements', icon: Send, label: 'Post Announcement', tone: 'bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white border-brass-200' },
              ].map((q, i) => {
                const QIcon = q.icon;
                return (
                  <Link
                    key={i}
                    to={q.to}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${q.tone}`}
                  >
                    <QIcon className="h-5 w-5" />
                    <span className="text-xs font-medium text-center leading-tight">{q.label}</span>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-danger-600" />
                Priority Alerts
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {[
                { level: 'Urgent', icon: AlertCircle, text: '2 funding deadlines in next 72 hours', tone: 'danger' },
                { level: 'High', icon: Clock, text: '5 approvals past 48-hour SLA target', tone: 'warning' },
                { level: 'Info', icon: Award, text: '12 Member IDs ready to be issued', tone: 'info' },
                { level: 'Info', icon: Calendar, text: '3 symposium proposals due Friday', tone: 'default' },
              ].map((alert, i) => {
                const AIcon = alert.icon;
                const toneCls = {
                  danger: 'bg-danger-100 text-danger-600 border-danger-600/20',
                  warning: 'bg-warning-100 text-warning-600 border-warning-600/20',
                  info: 'bg-slateteal-100 text-slateteal-700 border-slateteal-500/20',
                  default: 'bg-forum-50 text-forum-700 border-forum-200',
                }[alert.tone];
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${toneCls}`}>
                    <AIcon className="h-5 w-5 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">{alert.level}</p>
                      <p className="text-sm font-medium mt-0.5">{alert.text}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
