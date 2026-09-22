import { Prisma, type AuditSeverity } from '@prisma/client';
import { prisma } from '../config/database';
import { classifyAction, eventSeverity } from '../domain/audit';
import { auditContext } from './audit-context';
import { logger } from '../utils/logger';

export interface AuditInput {
  actorId?: string | null; actorLabel?: string; actorRole?: string; action: string; entity: string;
  entityType?: string; entityId?: string; module?: string; source?: string;
  severity?: AuditSeverity; description?: string; changes?: unknown; metadata?: unknown;
  outcome?: 'SUCCEEDED' | 'DENIED' | 'FAILED' | 'ACCESS_GRANTED';
  ipAddress?: string; userAgent?: string; deduplicationKey?: string;
}
// Explicit allowlists prevent credentials, arbitrary payloads and private content from becoming permanent logs.
const changeKeys = new Set(['status', 'role', 'visibility', 'isHidden', 'isPinned', 'isLocked', 'displayOrder', 'albumId', 'categoryId', 'assignedAdminId', 'assignedToId', 'deletedAt', 'removedAt', 'publishedAt', 'scheduledPublishAt', 'featured', 'sendReminder', 'reminderDays', 'emailEnabled', 'read', 'revision', 'userRole', 'memberId', 'category', 'priority']);
const metadataKeys = new Set(['count', 'rows', 'fileId', 'attachmentId', 'reportId', 'communityId', 'conversationId', 'applicationId', 'jobId', 'channel', 'purpose', 'reasonCode', 'changedFields', 'from', 'to', 'cutoff', 'module', 'action', 'actorRole', 'severity', 'sort', 'searchApplied']);
function scalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean') return value as number | boolean;
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value.slice(0, 500) : null;
}
export function safeChanges(value: unknown): Prisma.InputJsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const result: Record<string, Prisma.InputJsonValue> = {};
  for (const [key, pair] of Object.entries(value)) {
    if (!changeKeys.has(key) || !pair || typeof pair !== 'object' || !('before' in pair) || !('after' in pair)) continue;
    const supported = (v: unknown) => v == null || typeof v === 'string' || typeof v === 'boolean' || typeof v === 'number' && Number.isFinite(v) || v instanceof Date && !Number.isNaN(+v);
    if (!supported(pair.before) || !supported(pair.after)) continue;
    const before = scalar(pair.before), after = scalar(pair.after);
    if (before !== after) result[key] = { before, after };
  }
  return Object.keys(result).length ? result : undefined;
}
export function changesBetween(before: object | null, after: object | null) {
  return Object.fromEntries([...changeKeys].filter(key => key in (before ?? {}) || key in (after ?? {})).map(key => [key, { before: (before as Record<string, unknown> | null)?.[key], after: (after as Record<string, unknown> | null)?.[key] }]));
}
export function safeMetadata(value: unknown): Prisma.InputJsonObject | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value).filter(([key]) => metadataKeys.has(key)).map(([key, v]) => [key, Array.isArray(v) ? v.slice(0, 100).map(scalar) : scalar(v)]));
}
function registrySeverity(action: string, changes: Prisma.InputJsonObject | undefined): AuditSeverity {
  const status = changes?.status as { after?: string } | undefined;
  if (['REJECTED', 'BLOCKED'].includes(status?.after ?? '')) return 'DANGER';
  if (['SUSPENDED', 'DEACTIVATED'].includes(status?.after ?? '')) return 'WARNING';
  if (['APPROVED', 'PUBLISHED', 'COMPLETED', 'RESOLVED', 'SENT'].includes(status?.after ?? '')) return 'SUCCESS';
  const defined = eventSeverity(action);
  return defined;
}
export function safeLegacyDetails(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = Object.fromEntries(Object.entries(value).filter(([key, v]) => (changeKeys.has(key) || metadataKeys.has(key)) && (v === null || ['string', 'number', 'boolean'].includes(typeof v))).map(([key, v]) => [key, scalar(v)]));
  return Object.keys(result).length ? result : null;
}
export async function writeAudit(input: AuditInput, db: Prisma.TransactionClient = prisma): Promise<void> {
  const context = auditContext.getStore();
  const actor = input.actorId ? await db.user.findUnique({ where: { id: input.actorId }, select: { id: true, fullName: true, email: true, role: true, memberProfile: { select: { memberId: true } } } }) : null;
  const role = actor?.role ?? input.actorRole ?? 'SYSTEM';
  const entityParts = input.entity.match(/^([A-Za-z]+)\s+([^ /]+)/);
  const changes = safeChanges(input.changes);
  const data: Prisma.AuditLogUncheckedCreateInput = {
    eventVersion: 1, actorId: actor?.id ?? null, actorLabel: actor?.fullName ?? input.actorLabel ?? (role === 'UNAUTHENTICATED' ? 'Unauthenticated' : 'System'), actorRole: role,
    actorEmail: actor?.email, actorMemberId: actor?.memberProfile?.memberId,
    source: input.source ?? (actor ? role === 'ADMIN' ? 'ADMINISTRATOR' : 'USER' : role === 'UNAUTHENTICATED' ? 'UNAUTHENTICATED' : 'SYSTEM'),
    action: input.action, module: input.module ?? classifyAction(input.action), entity: input.entity.slice(0, 191), entityType: input.entityType ?? entityParts?.[1] ?? input.entity.split(' ')[0], entityId: input.entityId ?? entityParts?.[2],
    severity: input.outcome === 'DENIED' || input.outcome === 'FAILED' ? 'DANGER' : input.outcome === 'ACCESS_GRANTED' ? 'WARNING' : registrySeverity(input.action, changes), outcome: input.outcome ?? 'SUCCEEDED',
    // Descriptions are generated from event names and identities, never free-form request notes.
    description: `${input.action.replace(/([a-z])([A-Z])/g, '$1 $2')} · ${input.entity.slice(0, 191)}`,
    changes, metadata: safeMetadata(input.metadata), requestId: context?.requestId,
    ipAddress: (input.ipAddress ?? context?.request.ip)?.slice(0, 191), userAgent: (input.userAgent ?? context?.request.get('user-agent'))?.slice(0, 512), deduplicationKey: input.deduplicationKey,
  };
  if (input.deduplicationKey) await db.auditLog.upsert({ where: { deduplicationKey: input.deduplicationKey }, create: data, update: {} });
  else await db.auditLog.create({ data });
}
export async function securityAudit(input: AuditInput) {
  try { await writeAudit(input); }
  catch { logger.error('Security audit persistence failed', { requestId: auditContext.getStore()?.requestId, action: input.action }); }
}
