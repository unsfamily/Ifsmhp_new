import axios from 'axios';
import { apiClient } from '../api/client';
export interface AuditEntry {
  id: string; createdAt: string; eventVersion: number; actorId: string | null; actorLabel: string; actorRole: string; actorEmail: string | null; actorMemberId: string | null;
  actorSnapshotAvailable: boolean; currentActor: { name: string; email: string; memberId?: string } | null;
  source: string | null; module: string; action: string; entity: string; entityType: string | null; entityId: string | null;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'DANGER'; outcome: string | null; description: string;
  changes: Record<string, { before: string | number | boolean | null; after: string | number | boolean | null }> | null;
  metadata: Record<string, unknown> | null; legacyDetailsAvailable: boolean; legacyDetails: Record<string, unknown> | null; ipAddress: string | null; userAgent: string | null; requestId: string | null;
}
export interface AuditFilters { search: string; actorRole: string; module: string; action: string; severity: string; from: string; to: string; sort: 'newest' | 'oldest'; }
export interface AuditPage { items: AuditEntry[]; pagination: { page: number; limit: number; total: number; pages: number }; }
export interface AuditSummary { admin24h: number; warnings7d: number; danger7d: number; total: number; retention: 'INDEFINITE'; asOf: string; }
export interface AuditOptions { modules: string[]; actions: string[]; actorRoles: string[]; severities: string[]; }
interface Envelope<T> { data: T; }
export const auditService = {
  async list(params: AuditFilters & { page: number; limit: number }, signal: AbortSignal) { return (await apiClient.get<Envelope<AuditPage>>('/admin/audit-log', { params, signal })).data.data; },
  async summary(signal: AbortSignal) { return (await apiClient.get<Envelope<AuditSummary>>('/admin/audit-log/summary', { signal })).data.data; },
  async options(signal: AbortSignal) { return (await apiClient.get<Envelope<AuditOptions>>('/admin/audit-log/options', { signal })).data.data; },
  async export(params: AuditFilters, signal: AbortSignal) {
    try { return (await apiClient.get<Blob>('/admin/audit-log/export', { params, signal, responseType: 'blob', timeout: 120000 })).data; }
    catch (error) {
      if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
        try { error.response.data = JSON.parse(await error.response.data.text()); } catch { /* Preserve the HTTP status if a proxy returned non-JSON. */ }
      }
      throw error;
    }
  },
};
