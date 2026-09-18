import { apiClient } from './client';
import type { MemberDocument } from './member';
import type { ConversationRow } from './messaging';
import type { MemberAnnouncement } from './memberAnnouncements';
export { exchangeSendSchema, documentKind } from '../../../backend/domain/document-exchange';
import type { ExchangeSend } from '../../../backend/domain/document-exchange';
export type { ExchangeSend };
export type ExchangeView = 'messages' | 'documents' | 'videos' | 'announcements';
export interface ExchangeSummary {
  conversationId: string | null;
  counts: Record<ExchangeView, number>;
  unreadDocuments: number;
  upload: { maxBytes: number; maxFiles: number; mimeTypes: string[]; extensions: string[] };
}
export interface ExchangeDocument extends MemberDocument { attachmentId: string; conversationId: string; opened: boolean; openedAt: string | null }
export interface ExchangeVideo { id: string; url: string; label: string | null; sender: string; date: string; direction: 'incoming' | 'outgoing'; conversationId: string }
/**
 * `items?type=announcements` delegates to the member announcements reader
 * (`document-exchange.service.ts`), so a row is exactly a `MemberAnnouncement`.
 * Aliased rather than redeclared so the two cannot drift apart.
 */
export type ExchangeAnnouncement = MemberAnnouncement;
export type ExchangeConversation = Pick<ConversationRow, 'id' | 'subject' | 'status' | 'lastActivity' | 'lastPreview' | 'totalMessages' | 'unreadCount'>;
export interface ExchangeResult<T> { items: T[]; pagination: { page: number; limit: number; total: number; pages: number } }
interface Envelope<T> { data: T }
const base = '/members/me/document-exchange';
export const exchangeApi = {
  summary: async () => (await apiClient.get<Envelope<ExchangeSummary>>(base)).data.data,
  documents: async (params: Record<string, string | number>) => (await apiClient.get<Envelope<ExchangeResult<ExchangeDocument>>>('/members/me/documents', { params })).data.data,
  items: async <T extends ExchangeConversation | ExchangeVideo | ExchangeAnnouncement>(type: Exclude<ExchangeView, 'documents'>, page: number, limit: number) =>
    (await apiClient.get<Envelope<ExchangeResult<T>>>(`${base}/items`, { params: { type, page, limit } })).data.data,
  send: async (input: ExchangeSend) => (await apiClient.post<Envelope<{ conversationId: string; messageId: string }>>(`${base}/items`, input)).data.data,
  upload: async (file: File, progress: (percent: number) => void) => {
    const data = new FormData(); data.append('file', file);
    return (await apiClient.post<Envelope<{ id: string }>>('/files/upload', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000,
      onUploadProgress: e => progress(e.total ? Math.round(e.loaded / e.total * 100) : 0) })).data.data;
  },
};
