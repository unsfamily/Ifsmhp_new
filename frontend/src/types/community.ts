export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';
export type CommunityStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type MembershipStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED' | 'BLOCKED';
export type CommunityRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';
export type ReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface Community {
  id: string; name: string; slug: string; description: string; category: string;
  imageUrl?: string; bannerUrl?: string; visibility: CommunityVisibility;
  status: CommunityStatus; createdById: string; createdByName?: string;
  memberCount: number; conversationCount?: number; messageCount?: number;
  createdAt: string; updatedAt: string;
  membershipStatus?: MembershipStatus;
  membershipId?: string;
}

export interface CommunityMember {
  id: string; userId: string; communityId: string; fullName: string; email: string;
  profileImageUrl?: string; role: CommunityRole; status: MembershipStatus;
  communityName: string; communitiesJoined?: number; messageCount?: number;
  reportCount?: number; joinedAt?: string; requestedAt?: string; lastActiveAt?: string;
}

export interface CommunityConversation {
  id: string; communityId: string; communityName: string; title: string;
  description?: string; isLocked: boolean; unreadCount: number; messageCount: number;
  lastMessage?: CommunityMessage; createdAt: string; updatedAt: string;
}

export interface CommunityMessage {
  id: string; conversationId: string; senderId: string; senderName: string;
  senderImageUrl?: string; senderRole: CommunityRole; content: string;
  replyTo?: CommunityMessage | null; attachments?: MessageAttachment[];
  isPinned: boolean; isHidden: boolean; isDeleted: boolean; isRead?: boolean;
  createdAt: string; updatedAt?: string;
}

export interface MessageAttachment {
  id: string; fileName: string; fileUrl: string; fileType: string; fileSize?: number;
}

export interface CommunityReport {
  id: string; communityId: string; communityName: string; reporterId: string;
  reporterName: string; reportedMemberId?: string; reportedMemberName?: string;
  reportedMessage?: CommunityMessage; reason: string; notes?: string;
  status: ReportStatus; assignedAdminName?: string; resolutionNotes?: string;
  createdAt: string; updatedAt: string;
  actionHistory?: ModerationHistoryItem[];
}

export interface ModerationHistoryItem {
  id: string; action: string; notes: string; adminName?: string; createdAt: string;
}

export interface CommunityDashboardStats {
  totalCommunities: number; activeCommunities: number; totalMembers: number;
  pendingRequests: number; totalMessages: number; unreadMessages: number;
  openReports: number; suspendedMembers: number;
  // Detail and trend fields proposed for GET /admin/community/dashboard;
  // renderers must tolerate their absence.
  inactiveCommunities?: number; archivedCommunities?: number;
  newMembersThisMonth?: number; newMessagesThisWeek?: number;
  suspendedChange?: number; suspendedInCommunities?: number; suspensionReviewers?: number;
}

/** One bar/point of the conversation-activity chart. */
export interface CommunityActivityPoint { label: string; value: number; }

/** A selectable window over the activity chart (14 days, 90 days, 12 months). */
export interface CommunityActivitySeries {
  range: string; label: string; subtitle: string;
  unitLabel: string; highlightLabel: string;
  total: number; changePercent: number; comparison: string;
  points: CommunityActivityPoint[];
}

export interface TopCommunity {
  id: string; name: string; memberCount: number; messageCount: number;
  /** 0-100 meter strength shown as the mini bar. */
  activityScore: number;
}

export interface CommunityKpiTrends { members: number[]; messages: number[]; }

export interface PaginationMeta { page: number; limit: number; total: number; pages: number; }
export interface PaginatedCommunityResult<T> { items: T[]; pagination: PaginationMeta; }
export interface CommunityDashboardData {
  stats: CommunityDashboardStats;
  recentCommunities: Community[];
  pendingMembers: CommunityMember[];
  recentConversations: CommunityConversation[];
  reports: CommunityReport[];
  activity?: CommunityActivitySeries[];
  topCommunities?: TopCommunity[];
  kpiTrends?: CommunityKpiTrends;
}

/** Shape of the local sample dataset that powers the admin community pages until the /admin/community/* routes exist. */
export interface CommunityAdminSampleData {
  communities: Community[];
  members: CommunityMember[];
  conversations: CommunityConversation[];
  /** Keyed by conversation id. */
  messages: Record<string, CommunityMessage[]>;
  reports: CommunityReport[];
}

/** Shape of the local sample dataset that powers the member community page until the /community/* routes exist. */
export interface CommunityMemberSampleData {
  identity: { id: string; fullName: string; email: string };
  communities: Community[];
  /** Keyed by community id; includes the signed-in member's own directory row for active communities. */
  membersByCommunity: Record<string, CommunityMember[]>;
  /** Keyed by community id. */
  conversationsByCommunity: Record<string, CommunityConversation[]>;
  /** Keyed by conversation id; includes the signed-in member's own posts. */
  messagesByConversation: Record<string, CommunityMessage[]>;
}

export interface CommunityPayload {
  name: string; slug: string; description: string; category: string;
  visibility: CommunityVisibility; status: CommunityStatus;
  image?: File; banner?: File;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;
