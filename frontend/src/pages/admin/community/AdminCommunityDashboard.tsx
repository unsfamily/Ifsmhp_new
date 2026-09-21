import { useState } from 'react';
import { ArrowRight, Building2, Clock, Mail, Plus, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../../../components/common/Button';
import CommunityStatusBadge from '../../../components/community/CommunityStatusBadge';
import MembershipStatusBadge from '../../../components/community/MembershipStatusBadge';
import { PageHeading, formatRelative, formatShortDate, panelClass } from '../../../components/community/AdminCommunityUi';
import dashboardJson from '../../../data/community-dashboard.json';
import type { CommunityDashboardData } from '../../../types/community';

// Sample data lives in src/data/community-dashboard.json so this screen works
// while GET /admin/community/dashboard is still unbuilt on the backend. Swap
// the import for communityAdminService.getDashboardStats() once that route ships.
const data = dashboardJson as CommunityDashboardData;

const attentionTone = {
  brass: { icon: 'bg-brass-50 text-brass-700', count: 'text-brass-700' },
  danger: { icon: 'bg-danger-50 text-danger-600', count: 'text-danger-600' },
  forum: { icon: 'bg-forum-50 text-forum-600', count: 'text-forum-600' },
} as const;

const avatarPalette = ['bg-forum-100 text-forum-700', 'bg-brass-100 text-brass-700', 'bg-success-100 text-success-600', 'bg-warning-100 text-warning-600'];

export default function AdminCommunityDashboard() {
  const { stats } = data;
  const [range, setRange] = useState(() => data.activity?.[0]?.range ?? '');
  const activity = data.activity ?? [];
  const series = activity.find((item) => item.range === range) ?? activity[0];
  const topCommunities = data.topCommunities ?? [];
  const kpiTrends = data.kpiTrends;

  const activeRatio = stats.totalCommunities > 0 ? Math.round((stats.activeCommunities / stats.totalCommunities) * 100) : 0;
  const communityBreakdown = [
    `${stats.activeCommunities.toLocaleString()} active`,
    stats.inactiveCommunities !== undefined ? `${stats.inactiveCommunities} inactive` : null,
    stats.archivedCommunities !== undefined ? `${stats.archivedCommunities} archived` : null,
  ].filter(Boolean).join(' · ');
  const suspendedSubline = [
    stats.suspendedInCommunities !== undefined ? `Across ${stats.suspendedInCommunities} communities` : null,
    stats.suspensionReviewers !== undefined ? `reviewed by ${stats.suspensionReviewers} moderators` : null,
  ].filter(Boolean).join(' · ');

  const attention = [
    { to: '/admin/community/members', icon: Clock, count: stats.pendingRequests, label: 'Pending membership requests', tone: 'brass' },
    { to: '/admin/community/moderation', icon: ShieldAlert, count: stats.openReports, label: 'Reports requiring review', tone: 'danger' },
    { to: '/admin/community/chats', icon: Mail, count: stats.unreadMessages, label: 'Unread admin messages', tone: 'forum' },
  ] as const;
  const maxPoint = series ? Math.max(...series.points.map((point) => point.value), 1) * 1.05 : 1;

  return <div className="space-y-6">
    <PageHeading title="Community Dashboard" description="A live overview of communities, membership, conversations, and moderation." actions={<>
      {activity.length > 1 && <div role="group" aria-label="Activity range" className="flex rounded-lg border border-paper-border bg-paper-raised p-0.5">{activity.map((item) => <button key={item.range} type="button" aria-pressed={item.range === range} onClick={() => setRange(item.range)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${item.range === range ? 'bg-forum-600 text-white' : 'text-ink-muted hover:bg-forum-50'}`}>{item.label}</button>)}</div>}
      <Button as="link" to="/admin/community/communities"><Plus className="h-4 w-4" />New community</Button>
    </>} />

    <section aria-label="Needs attention" className="grid gap-4 sm:grid-cols-3">
      {attention.map(({ to, icon: Icon, count, label, tone }) => <Link key={label} to={to} className="flex items-center gap-3.5 rounded-xl border border-paper-border bg-paper-raised p-4 shadow-sm transition hover:-translate-y-px hover:border-forum-200">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${attentionTone[tone].icon}`}><Icon className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1"><span className={`block text-xl font-semibold leading-tight tabular-nums ${attentionTone[tone].count}`}>{count.toLocaleString()}</span><span className="mt-0.5 block text-xs text-ink-muted">{label}</span></span>
        <ArrowRight className="h-4 w-4 shrink-0 text-ink-subtle" />
      </Link>)}
    </section>

    <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={`${panelClass} flex flex-col gap-4 p-5`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-ink-muted">Total communities</p><p className="mt-1 text-2xl font-semibold tabular-nums text-forum-900">{stats.totalCommunities.toLocaleString()}</p></div><span className="rounded-lg bg-brass-50 p-2 text-brass-700"><Building2 className="h-5 w-5" /></span></div>
        <div className="h-1.5 overflow-hidden rounded-full bg-forum-100" aria-hidden="true"><div className="h-full rounded-full bg-brass-500" style={{ width: `${activeRatio}%` }} /></div>
        <p className="text-xs text-ink-subtle">{communityBreakdown}</p>
      </div>
      <div className={`${panelClass} flex flex-col gap-4 p-5`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-ink-muted">Total members</p><p className="mt-1 text-2xl font-semibold tabular-nums text-forum-900">{stats.totalMembers.toLocaleString()}</p></div>{stats.newMembersThisMonth !== undefined && <DeltaChip value={stats.newMembersThisMonth} unit="this month" />}</div>
        {kpiTrends && kpiTrends.members.length > 1 && <Sparkline points={kpiTrends.members} className="text-forum-400" />}
      </div>
      <div className={`${panelClass} flex flex-col gap-4 p-5`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-ink-muted">Messages sent</p><p className="mt-1 text-2xl font-semibold tabular-nums text-forum-900">{stats.totalMessages.toLocaleString()}</p></div>{stats.newMessagesThisWeek !== undefined && <DeltaChip value={stats.newMessagesThisWeek} unit="this week" />}</div>
        {kpiTrends && kpiTrends.messages.length > 1 && <Sparkline points={kpiTrends.messages} className="text-brass-500" />}
      </div>
      <div className={`${panelClass} flex flex-col gap-4 p-5`}>
        <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-ink-muted">Suspended / blocked</p><p className="mt-1 text-2xl font-semibold tabular-nums text-forum-900">{stats.suspendedMembers.toLocaleString()}</p></div>{stats.suspendedChange !== undefined && <DeltaChip value={stats.suspendedChange} unit="vs last month" goodWhenDown />}</div>
        {suspendedSubline && <p className="mt-auto text-xs text-ink-subtle">{suspendedSubline}</p>}
      </div>
    </section>

    <section className="grid gap-6 xl:grid-cols-3">
      {series && <div className={`${panelClass} xl:col-span-2`}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-paper-border px-5 py-4">
          <h2 className="font-display text-lg font-semibold text-forum-900">Conversation activity</h2>
          <div className="flex items-center gap-3.5 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-forum-200" />{series.unitLabel}</span>
            <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-brass-500" />{series.highlightLabel}</span>
          </div>
        </header>
        <div className="px-5 pb-4 pt-4">
          <div className="flex flex-wrap items-baseline gap-2.5"><span className="text-[22px] font-semibold tabular-nums text-forum-900">{series.total.toLocaleString()}</span><span className="text-xs font-semibold text-success-600">▲ {series.changePercent}% vs {series.comparison}</span></div>
          <p className="mb-3.5 mt-1 text-xs text-ink-muted">{series.subtitle}</p>
          <div role="img" aria-label={`${series.unitLabel}, last ${series.label}`} className="relative h-[190px] border-b border-l border-paper-border" style={{ backgroundImage: 'repeating-linear-gradient(to top, transparent 0 46px, #D9E0F5 46px 47px)' }}>
            <div className="absolute inset-0 flex items-end gap-1.5 px-2.5">
              {series.points.map((point, index) => <div key={`${point.label}-${index}`} title={`${point.label}: ${point.value.toLocaleString()}`} className="flex h-full flex-1 flex-col justify-end">
                <span className={`block rounded-t ${index === series.points.length - 1 ? 'bg-brass-500' : 'bg-forum-200 transition-colors hover:bg-forum-400'}`} style={{ height: `${Math.round((point.value / maxPoint) * 100)}%` }} />
              </div>)}
            </div>
          </div>
          <div className="flex gap-1.5 px-2.5 pt-2" aria-hidden="true">{series.points.map((point, index) => <span key={`${point.label}-${index}`} className="min-w-0 flex-1 truncate text-center text-[10.5px] text-ink-subtle">{point.label}</span>)}</div>
        </div>
      </div>}
      {topCommunities.length > 0 && <DashboardSection title="Top communities" to="/admin/community/communities" empty="No community activity yet.">
        {topCommunities.map((community) => <Row key={community.id} title={community.name} subtitle={`${community.memberCount.toLocaleString()} members · ${community.messageCount.toLocaleString()} messages`} trailing={<span className="h-1.5 w-[72px] shrink-0 overflow-hidden rounded-full bg-forum-100"><span className="block h-full rounded-full bg-forum-400" style={{ width: `${community.activityScore}%` }} /></span>} />)}
      </DashboardSection>}
    </section>

    <section className="grid gap-6 xl:grid-cols-2">
      <DashboardSection title="Recently created communities" to="/admin/community/communities" empty="No communities have been created.">
        {data.recentCommunities.map((community) => <Row key={community.id} title={community.name} subtitle={`${community.memberCount} members · Created ${formatShortDate(community.createdAt)}`} trailing={<CommunityStatusBadge status={community.status} />} />)}
      </DashboardSection>
      <DashboardSection title="Pending membership requests" to="/admin/community/members" empty="No membership requests are pending.">
        {data.pendingMembers.map((member, index) => <Row key={member.id} leading={<MemberAvatar name={member.fullName} index={index} />} title={member.fullName} subtitle={`${member.communityName} · Requested ${formatShortDate(member.requestedAt)}`} trailing={<MembershipStatusBadge status={member.status} />} />)}
      </DashboardSection>
      <DashboardSection title="Recent conversations" to="/admin/community/chats" empty="No conversations are available.">
        {data.recentConversations.map((conversation) => <Row key={conversation.id} title={conversation.title} subtitle={`${conversation.communityName} · ${formatRelative(conversation.updatedAt)}`} trailing={conversation.unreadCount ? <span className="rounded-full bg-brass-500 px-2 py-0.5 text-xs font-semibold text-white">{conversation.unreadCount}</span> : null} />)}
      </DashboardSection>
      <DashboardSection title="Reports requiring review" to="/admin/community/moderation" empty="No reports require review.">
        {data.reports.map((report) => <Row key={report.id} title={report.reason} subtitle={`${report.communityName} · Reported ${formatShortDate(report.createdAt)}`} trailing={<CommunityStatusBadge status={report.status} />} />)}
      </DashboardSection>
    </section>
  </div>;
}

function DeltaChip({ value, unit, goodWhenDown = false }: { value: number; unit: string; goodWhenDown?: boolean }) {
  if (value === 0) return <span className="inline-flex items-center rounded-full bg-forum-100 px-2.5 py-0.5 text-[11px] font-semibold text-forum-700">No change</span>;
  const up = value > 0;
  const good = goodWhenDown ? !up : up;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${good ? 'bg-success-100 text-success-600' : 'bg-danger-100 text-danger-600'}`}>{up ? '▲' : '▼'} {Math.abs(value).toLocaleString()} {unit}</span>;
}

function Sparkline({ points, className }: { points: number[]; className: string }) {
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const step = points.length > 1 ? 160 / (points.length - 1) : 0;
  const coords = points.map((value, index) => `${(index * step).toFixed(1)},${(28 - ((value - min) / span) * 24).toFixed(1)}`).join(' ');
  return <svg className={`block h-8 w-full ${className}`} viewBox="0 0 160 30" preserveAspectRatio="none" aria-hidden="true"><polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function MemberAvatar({ name, index }: { name: string; index: number }) {
  const label = name.split(/\s+/).filter((part) => !part.endsWith('.')).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
  const tone = avatarPalette[index % avatarPalette.length] ?? 'bg-forum-100 text-forum-700';
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${tone}`}>{label}</span>;
}

function DashboardSection({ title, to, empty, children }: { title: string; to: string; empty: string; children?: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className={panelClass}><header className="flex items-center justify-between border-b border-paper-border px-5 py-4"><h2 className="font-display text-lg font-semibold text-forum-900">{title}</h2><Link to={to} className="text-sm font-medium text-forum-700 hover:text-brass-700">View All</Link></header><div className="divide-y divide-paper-border">{hasChildren ? children : <p className="px-5 py-8 text-center text-sm text-ink-muted">{empty}</p>}</div></section>;
}

function Row({ title, subtitle, leading, trailing }: { title: string; subtitle: string; leading?: React.ReactNode; trailing?: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3">{leading}<div className="min-w-0"><p className="truncate font-medium text-forum-900">{title}</p><p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p></div></div>{trailing}</div>;
}
