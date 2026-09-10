import { apiClient } from './client';
import type { ConversationMessage, MessageExtras } from './messaging';

export type SupportKind = 'Moral' | 'Official' | 'Funding';
export type SupportPriority = 'Standard' | 'High' | 'Urgent' | 'Low';
export type SupportStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed' | 'Open' | 'In Review' | 'Closed';
export interface SupportRow {
  id: string; subject: string; project: string; projectId: string | null; type: SupportKind[];
  supportType: `${SupportKind} Support` | null; submitted: string; lastUpdate: string;
  status: SupportStatus; statusCode: string; priority: SupportPriority; messages: number;
  queueDays: number; member: string; memberId: string | null; requesterId?: string;
  assignedAdminId?: string | null; assignedAdmin?: string; conversationId: string | null; lastMessage: string;
}
export interface SupportStats {
  total: number; open: number; urgent: number; overSla: number; approved: number; funding: number;
  approvedWeek: number; triagedWeek: number; closedMonth: number;
  avgResolutionDays: number | null; avgResponseDays: number | null;
}
export interface SupportList {
  items: SupportRow[]; pagination: { page: number; limit: number; total: number; pages: number }; stats: SupportStats;
}
export interface SupportDetail extends Omit<SupportRow, 'messages' | 'lastMessage'> {
  description: string; requiredBy: string | null; adminResponse: string | null; institution: string | null;
  messages: ConversationMessage[];
  attachments: Array<{ id: string; name: string; size: number; type: string; internal: boolean }>;
  history: Array<{ id: string; at: string; by?: string; from: string | null; to: SupportStatus; note: string | null; internal?: boolean }>;
  linked: Array<{ label: string; id: string; name: string }>;
  memberSummary?: { previous: number; approved: number; rejected: number };
}
export interface NewSupport {
  projectId: string | null; subject: string; description: string; priority: 'Standard' | 'High' | 'Urgent';
  types: string[]; requiredBy: string | null;
}
const path = (admin: boolean) => admin ? '/admin/support' : '/members/me/support';
interface Envelope<T> { data: T }
export const supportApi = {
  list: async (admin: boolean, params: Record<string, string | number> = {}) =>
    (await apiClient.get<Envelope<SupportList>>(path(admin), { params })).data.data,
  detail: async (admin: boolean, id: string) => (await apiClient.get<Envelope<SupportDetail>>(`${path(admin)}/${id}`)).data.data,
  create: async (payload: NewSupport) => (await apiClient.post<Envelope<SupportDetail>>(path(false), payload)).data.data,
  reply: async (admin: boolean, id: string, body: string, extras: MessageExtras = {}) =>
    apiClient.post(`${path(admin)}/${id}/messages`, { body, ...extras }),
  decide: async (id: string, action: 'review' | 'approve' | 'reject' | 'complete', response: string, expectedUpdatedAt: string) =>
    apiClient.post(`${path(true)}/${id}/${action}`, { response, expectedUpdatedAt }),
  update: async (id: string, data: { assignedAdminId?: string | null; priority?: SupportPriority; expectedUpdatedAt: string }) =>
    (await apiClient.patch<Envelope<SupportDetail>>(`${path(true)}/${id}`, data)).data.data,
  assignees: async () => (await apiClient.get<Envelope<Array<{ id: string; fullName: string }>>>(`${path(true)}/assignees`)).data.data,
};
export const supportDays = (value: number | null | undefined) => value == null ? 'Not available' : `${value.toFixed(1)} days`;
export const supportDate = (value: string | null | undefined) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleDateString() : 'Not provided';
