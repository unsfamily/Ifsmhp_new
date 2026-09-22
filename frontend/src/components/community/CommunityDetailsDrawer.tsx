import { CommunityImage } from './CommunityMedia';
import type { Community } from '../../types/community';
import CommunityAvatar from './CommunityAvatar';
import CommunityStatusBadge from './CommunityStatusBadge';
import { Drawer, formatDate } from './AdminCommunityUi';

export default function CommunityDetailsDrawer({ community, close }: { community: Community; close: () => void }) {
  return <Drawer title="Community details" close={close}><div className="flex items-center gap-3"><CommunityAvatar name={community.name} src={community.imageUrl} className="h-16 w-16" /><div><h3 className="text-lg font-semibold text-forum-900">{community.name}</h3><p className="text-sm text-ink-muted">/{community.slug}</p></div></div>{community.bannerUrl && <CommunityImage src={community.bannerUrl} alt="" className="mt-5 h-40 w-full rounded-lg object-cover" />}<dl className="mt-6 grid grid-cols-2 gap-4 text-sm"><Detail label="Status"><CommunityStatusBadge status={community.status} /></Detail><Detail label="Visibility">{community.visibility}</Detail><Detail label="Category">{community.category}</Detail><Detail label="Members">{community.memberCount.toLocaleString()}</Detail><Detail label="Conversations">{community.conversationCount?.toLocaleString() ?? '—'}</Detail><Detail label="Messages">{community.messageCount?.toLocaleString() ?? '—'}</Detail><Detail label="Created by">{community.createdByName ?? community.createdById}</Detail><Detail label="Created">{formatDate(community.createdAt)}</Detail></dl><div className="mt-6"><h4 className="font-semibold text-forum-900">Description</h4><p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{community.description}</p></div></Drawer>;
}
function Detail({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt className="text-xs uppercase tracking-wide text-ink-subtle">{label}</dt><dd className="mt-1 text-forum-900">{children}</dd></div>; }
