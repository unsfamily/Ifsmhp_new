import type { SessionUser } from '../api/auth';
import type {
  Community,
  CommunityAdminSampleData,
  CommunityConversation,
  CommunityMember,
  CommunityMemberSampleData,
  CommunityMessage,
  MembershipStatus,
} from '../types/community';
import raw from './community-admin-data.json';

const sample = raw as unknown as CommunityAdminSampleData;

/** Safety net for the first render before the session user resolves; member routes always render inside the authenticated layout. */
const FALLBACK_IDENTITY = { id: 'usr_member_demo', fullName: 'Aru UNS', email: 'aru.uns@example.org' };

/** Communities the signed-in member already belongs to in the sample data. Every other browsable community is joinable. */
const SAMPLE_MEMBERSHIPS: Record<string, MembershipStatus> = {
  'c-01': 'ACTIVE',
  'c-02': 'ACTIVE',
  'c-03': 'ACTIVE',
  'c-05': 'ACTIVE',
  'c-06': 'ACTIVE',
  'c-14': 'PENDING',
};

/** Posts the signed-in member has already made, appended to the sample threads. */
const SAMPLE_SELF_POSTS: Record<string, { content: string; createdAt: string }[]> = {
  'conv-01': [
    {
      content: 'Thanks both — I will draft the authorship checklist from this thread and bring it to the next methods call.',
      createdAt: '2026-09-21T06:40:00.000Z',
    },
  ],
  'conv-02': [
    {
      content: 'This is really useful. Our service restructures supervision next quarter — could I sit in on one of the early-career sessions to compare notes?',
      createdAt: '2026-09-21T05:15:00.000Z',
    },
  ],
  'conv-04': [
    {
      content: 'Sharing here too: our outreach team adapted the consent template for under-16s and it is working well. Happy to post the redacted version for anyone who wants it.',
      createdAt: '2026-09-20T07:55:00.000Z',
    },
  ],
  'conv-06': [
    {
      content: 'We tried the written-reflection format with our team last month and it landed well. I can share the prompt sheet if that helps.',
      createdAt: '2026-09-20T20:10:00.000Z',
    },
  ],
};

/** Browsable communities: archived and deactivated groups stay hidden from the member view. */
const BROWSABLE = sample.communities.filter((community) => community.status === 'ACTIVE');

/** Directory row representing the signed-in member, used for active memberships. */
export function selfMemberRow(community: Community, identity: CommunityMemberSampleData['identity']): CommunityMember {
  return {
    id: `mem-self-${community.id}`,
    userId: identity.id,
    communityId: community.id,
    fullName: identity.fullName,
    email: identity.email,
    role: 'MEMBER',
    status: 'ACTIVE',
    communityName: community.name,
    communitiesJoined: Object.values(SAMPLE_MEMBERSHIPS).filter((status) => status === 'ACTIVE').length,
    joinedAt: '2026-06-14T10:20:00.000Z',
    lastActiveAt: '2026-09-21T06:40:00.000Z',
  };
}

/**
 * Builds the member-facing sample dataset on top of the shared admin sample data:
 * the signed-in member's memberships, their directory rows, and their posts in the threads.
 * Replace these reads with communityService calls once the /community/* routes exist.
 */
export function buildMemberSample(user: SessionUser | null): CommunityMemberSampleData {
  const identity: CommunityMemberSampleData['identity'] = user
    ? { id: user.id, fullName: user.fullName, email: user.email }
    : { ...FALLBACK_IDENTITY };

  const communities = BROWSABLE.map((community) => {
    const membershipStatus = SAMPLE_MEMBERSHIPS[community.id];
    return membershipStatus ? { ...community, membershipStatus, membershipId: `memb-${community.id}` } : { ...community };
  });

  const messagesByConversation: Record<string, CommunityMessage[]> = {};
  const conversations: CommunityConversation[] = [];
  sample.conversations.forEach((conversation) => {
    const thread = [...(sample.messages[conversation.id] ?? [])];
    SAMPLE_SELF_POSTS[conversation.id]?.forEach((post, index) => {
      thread.push({
        id: `msg-self-${conversation.id}-${index + 1}`,
        conversationId: conversation.id,
        senderId: identity.id,
        senderName: identity.fullName,
        senderRole: 'MEMBER',
        content: post.content,
        isPinned: false,
        isHidden: false,
        isDeleted: false,
        isRead: true,
        createdAt: post.createdAt,
        updatedAt: post.createdAt,
      });
    });
    messagesByConversation[conversation.id] = thread;
    const last = thread[thread.length - 1];
    conversations.push(last ? { ...conversation, messageCount: thread.length, lastMessage: last, updatedAt: last.createdAt } : { ...conversation });
  });

  const membersByCommunity: Record<string, CommunityMember[]> = {};
  const conversationsByCommunity: Record<string, CommunityConversation[]> = {};
  communities.forEach((community) => {
    const directory = sample.members.filter((member) => member.communityId === community.id);
    membersByCommunity[community.id] = community.membershipStatus === 'ACTIVE'
      ? [...directory, selfMemberRow(community, identity)]
      : directory;
    conversationsByCommunity[community.id] = conversations.filter((conversation) => conversation.communityId === community.id);
  });

  return { identity, communities, membersByCommunity, conversationsByCommunity, messagesByConversation };
}
