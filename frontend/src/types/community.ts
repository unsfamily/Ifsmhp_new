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
}

export interface PaginationMeta { page: number; limit: number; total: number; pages: number; }
export interface PaginatedCommunityResult<T> { items: T[]; pagination: PaginationMeta; }
export interface CommunityDashboardData {
  stats: CommunityDashboardStats;
  recentCommunities: Community[];
  pendingMembers: CommunityMember[];
  recentConversations: CommunityConversation[];
  reports: CommunityReport[];
}

export interface CommunityPayload {
  name: string; slug: string; description: string; category: string;
  visibility: CommunityVisibility; status: CommunityStatus;
  image?: File; banner?: File;
}

export type QueryParams = Record<string, string | number | boolean | undefined>;
