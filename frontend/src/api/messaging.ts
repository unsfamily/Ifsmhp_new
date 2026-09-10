/**
 * Conversation shapes shared by the CRO inbox and the member's "Messages from
 * CRO" screen. Both sides read the same serializer on the server, so the types
 * live here rather than being declared twice.
 */
import { apiClient } from './client';

/** Lowercased `senderRole`. 'system' has no server equivalent yet. */
export type MessageWho = 'member' | 'admin' | 'system';

export interface ConversationMessage {
  id: string;
  who: MessageWho;
  name: string;
  /** ISO timestamp. */
  at: string;
  text: string;
  /** Admin-only note; never present in a member's payload. */
  internal: boolean;
  attachments: { id: string; name: string; size: number; type: string }[];
  links: { id: string; url: string; label: string | null }[];
}

export interface ConversationRow {
  id: string;
  subject: string;
  /** The member's name, or 'CRO Office' for a thread with no member. */
  from: string;
  memberId: string;
  category: string;
  /** ISO timestamp of the last activity. */
  lastActivity: string;
  unreadCount: number;
  participantCount: number;
  totalMessages: number;
  lastPreview: string;
  status: string;
  priority: string;
}

export interface ConversationsResult {
  items: ConversationRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface ConversationAnalytics {
  /** Minutes to the first reply from the other side; null until someone answers. */
  firstResponseMinutes: number | null;
  avgResponseMinutes: number | null;
  responseCount: number;
  participantCount: number;
  linkedRecordCount: number;
  lastActivityAt: string;
}

export interface ConversationDetail extends ConversationRow {
  fromName?: string;
  fromEmail?: string;
  fromMemberId?: string | null;
  fromInstitution?: string | null;
  assignee: string | null;
  createdAt: string;
  participants: { name: string; role: string; joinedAt: string; email: string }[];
  messages: ConversationMessage[];
  linkedRecords: { id: string; label: string; recordId: string; name: string }[];
  analytics: ConversationAnalytics;
}

/** What a composer sends alongside the message body. */
export interface MessageExtras {
  fileIds?: string[];
  links?: { url: string; label?: string }[];
}

/**
 * Fetches an attachment as a blob. Downloads go through the API rather than a
 * plain href because the route is bearer-authenticated and access-logged.
 */
export async function fetchAttachment(fileId: string): Promise<Blob> {
  const res = await apiClient.get(`/files/${fileId}/download`, { responseType: 'blob' });
  return res.data as Blob;
}

/** Opens an attachment in a new tab. */
export async function openAttachmentInTab(fileId: string) {
  const url = URL.createObjectURL(await fetchAttachment(fileId));
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saves an attachment under its original name. */
export async function downloadAttachment(fileId: string, fileName: string) {
  const url = URL.createObjectURL(await fetchAttachment(fileId));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Renders a minute count as the UI shows turnaround ("2.1 h", "35 min"). */
export function formatResponseTime(minutes: number | null): string {
  if (minutes === null) return '—';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${(Math.round(hours * 10) / 10).toFixed(1)} h`;
  return `${Math.round(hours / 24)} d`;
}

/** Compact relative time for list rows ("15 minutes ago", "Yesterday"). */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
