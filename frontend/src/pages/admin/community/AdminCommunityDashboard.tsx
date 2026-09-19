import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Building2, Clock, Mail, MessageSquare, ShieldAlert, UserX, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { normalizeError } from '../../../api/client';
import CommunityPageSkeleton from '../../../components/community/CommunityPageSkeleton';
import EmptyCommunityState from '../../../components/community/EmptyCommunityState';
import CommunityStatusBadge from '../../../components/community/CommunityStatusBadge';
import MembershipStatusBadge from '../../../components/community/MembershipStatusBadge';
import { PageHeading, formatDate, panelClass } from '../../../components/community/AdminCommunityUi';
import { communityAdminService } from '../../../services/communityAdminService';
import type { CommunityDashboardData } from '../../../types/community';

export default function AdminCommunityDashboard() {
  const [data, setData] = useState<CommunityDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await communityAdminService.getDashboardStats()); } catch (failure) { setError(normalizeError(failure).message); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const stats = data?.stats;
  const tiles = [
    [Building2, stats?.totalCommunities ?? 0, 'Total communities'], [Building2, stats?.activeCommunities ?? 0, 'Active communities'],
    [Users, stats?.totalMembers ?? 0, 'Total members'], [Clock, stats?.pendingRequests ?? 0, 'Pending requests'],
    [MessageSquare, stats?.totalMessages ?? 0, 'Total messages'], [Mail, stats?.unreadMessages ?? 0, 'Unread admin messages'],
    [ShieldAlert, stats?.openReports ?? 0, 'Open reports'], [UserX, stats?.suspendedMembers ?? 0, 'Suspended / blocked'],
  ] as const;
  return <div className="space-y-6"><PageHeading title="Community Dashboard" description="A live overview of communities, membership, conversations, and moderation." />
    {error && !data ? <EmptyCommunityState title="" error={error} retry={() => void load()} /> : <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{tiles.map(([Icon, value, label]) => <div key={label} className={`${panelClass} p-5`}><div className="flex items-start justify-between"><div><p className="text-sm text-ink-muted">{label}</p><p className="mt-2 text-2xl font-semibold text-forum-900">{loading ? '—' : value.toLocaleString()}</p></div><span className="rounded-lg bg-brass-50 p-2 text-brass-700"><Icon className="h-5 w-5" /></span></div></div>)}</div>
      {loading ? <CommunityPageSkeleton rows={4} /> : <div className="grid gap-6 xl:grid-cols-2">
        <DashboardSection title="Recently created communities" to="/admin/community/communities" empty="No communities have been created.">{data?.recentCommunities.map((community) => <Row key={community.id} title={community.name} subtitle={`${community.memberCount} members · ${formatDate(community.createdAt)}`} trailing={<CommunityStatusBadge status={community.status} />} />)}</DashboardSection>
        <DashboardSection title="Pending membership requests" to="/admin/community/members" empty="No membership requests are pending.">{data?.pendingMembers.map((member) => <Row key={member.id} title={member.fullName} subtitle={`${member.communityName} · ${formatDate(member.requestedAt)}`} trailing={<MembershipStatusBadge status={member.status} />} />)}</DashboardSection>
        <DashboardSection title="Recent conversations" to="/admin/community/chats" empty="No conversations are available.">{data?.recentConversations.map((conversation) => <Row key={conversation.id} title={conversation.title} subtitle={`${conversation.communityName} · ${formatDate(conversation.updatedAt)}`} trailing={conversation.unreadCount ? <span className="rounded-full bg-brass-500 px-2 py-0.5 text-xs font-semibold text-white">{conversation.unreadCount}</span> : null} />)}</DashboardSection>
        <DashboardSection title="Reports requiring review" to="/admin/community/moderation" empty="No reports require review.">{data?.reports.map((report) => <Row key={report.id} title={report.reason} subtitle={`${report.communityName} · ${formatDate(report.createdAt)}`} trailing={<CommunityStatusBadge status={report.status} />} />)}</DashboardSection>
      </div>}
      {error && data && <div role="alert" className="flex items-center gap-2 rounded-lg bg-warning-50 p-3 text-sm text-warning-700"><AlertTriangle className="h-4 w-4" />Refresh failed: {error}</div>}
    </>}
  </div>;
}

function DashboardSection({ title, to, empty, children }: { title: string; to: string; empty: string; children?: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className={panelClass}><header className="flex items-center justify-between border-b border-paper-border px-5 py-4"><h2 className="font-display text-lg font-semibold text-forum-900">{title}</h2><Link to={to} className="text-sm font-medium text-forum-700 hover:text-brass-700">View All</Link></header><div className="divide-y divide-paper-border">{hasChildren ? children : <p className="px-5 py-8 text-center text-sm text-ink-muted">{empty}</p>}</div></section>;
}
function Row({ title, subtitle, trailing }: { title: string; subtitle: string; trailing?: React.ReactNode }) { return <div className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate font-medium text-forum-900">{title}</p><p className="mt-0.5 truncate text-xs text-ink-muted">{subtitle}</p></div>{trailing}</div>; }
