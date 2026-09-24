import { Prisma, type AuditLog } from '@prisma/client';
import type { Response } from 'express';
import { prisma } from '../config/database';
import { auditModules, auditQuery, classifyAction, eventRegistry, type AuditQuery } from '../domain/audit';
import { buildPaginatedResult, toSkipTake } from '../utils/pagination';
import { toCsv } from '../utils/csv';
import { safeChanges, safeLegacyDetails, writeAudit } from './audit.service';

async function scope(q: AuditQuery): Promise<Prisma.AuditLogWhereInput> {
  const where: Prisma.AuditLogWhereInput = {
    ...(q.actorRole ? { actorRole: q.actorRole } : {}), ...(q.action ? { action: q.action } : {}), ...(q.severity ? { severity: q.severity } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: new Date(`${q.from}T00:00:00.000Z`) } : {}), ...(q.to ? { lt: new Date(Date.parse(`${q.to}T00:00:00.000Z`) + 86400000) } : {}) } } : {}),
  };
  const conditions: Prisma.AuditLogWhereInput[] = [];
  if (q.module) {
    const legacy = await prisma.auditLog.groupBy({ by: ['action'], where: { module: null } });
    conditions.push({ OR: [{ module: q.module }, { module: null, action: { in: legacy.filter(row => classifyAction(row.action) === q.module).map(row => row.action) } }] });
  }
  if (q.actorId) conditions.push({ actorId: q.actorId });
  if (q.search) conditions.push({ OR: ['actorLabel', 'actorEmail', 'actorMemberId', 'actorId', 'action', 'entity', 'description'].map(field => ({ [field]: { contains: q.search } })) });
  if (conditions.length) where.AND = conditions;
  return where;
}
const actorInclude = { actor: { select: { fullName: true, email: true, memberProfile: { select: { memberId: true } } } } } satisfies Prisma.AuditLogInclude;
type Row = Prisma.AuditLogGetPayload<{ include: typeof actorInclude }>;
export function auditDto(row: Row) {
  const changes = safeChanges(row.changes);
  return { id: row.id, createdAt: row.createdAt, eventVersion: row.eventVersion, actorId: row.actorId, actorLabel: row.actorLabel, actorRole: row.actorRole, actorEmail: row.actorEmail, actorMemberId: row.actorMemberId,
    actorSnapshotAvailable: row.eventVersion > 0, currentActor: row.eventVersion === 0 && row.actor ? { name: row.actor.fullName, email: row.actor.email, memberId: row.actor.memberProfile?.memberId } : null,
    action: row.action, module: row.module ?? classifyAction(row.action), entity: row.entity, entityType: row.entityType, entityId: row.entityId,
    severity: row.severity, outcome: row.outcome, source: row.source, description: row.description, changes: changes ?? null,
    legacyDetails: row.eventVersion === 0 ? safeLegacyDetails(row.changes) : null,
    legacyDetailsAvailable: row.eventVersion === 0 && row.changes !== null && !changes,
    metadata: row.eventVersion > 0 ? row.metadata : null, ipAddress: row.ipAddress, userAgent: row.userAgent, requestId: row.requestId };
}
export async function auditList(raw: unknown) {
  const q = auditQuery.parse(raw), where = await scope(q);
  return prisma.$transaction(async db => {
    const total = await db.auditLog.count({ where });
    q.page = Math.min(q.page, Math.max(1, Math.ceil(total / q.limit)));
    const direction = q.sort === 'oldest' ? 'asc' : 'desc';
    const items = await db.auditLog.findMany({ where, include: actorInclude, orderBy: [{ createdAt: direction }, { id: direction }], ...toSkipTake(q) });
    return buildPaginatedResult(items.map(auditDto), total, q);
  });
}
export async function auditSummary() {
  const now = new Date();
  const [admin24h, warnings7d, danger7d, total] = await prisma.$transaction([
    prisma.auditLog.count({ where: { actorRole: 'ADMIN', createdAt: { gte: new Date(+now - 86400000), lte: now } } }),
    prisma.auditLog.count({ where: { severity: 'WARNING', createdAt: { gte: new Date(+now - 7 * 86400000), lte: now } } }),
    prisma.auditLog.count({ where: { severity: 'DANGER', createdAt: { gte: new Date(+now - 7 * 86400000), lte: now } } }), prisma.auditLog.count(),
  ]);
  return { admin24h, warnings7d, danger7d, total, retention: 'INDEFINITE', asOf: now };
}
export async function auditOptions() {
  const rows = await prisma.auditLog.groupBy({ by: ['action', 'module', 'actorRole'] });
  return { modules: [...new Set([...auditModules, ...rows.map(r => r.module ?? classifyAction(r.action))])].sort(), actions: [...new Set([...eventRegistry.map(r => r.action), ...rows.map(r => r.action)])].sort(), actorRoles: [...new Set(['ADMIN', 'MEMBER', 'APPLICANT', 'SYSTEM', 'UNAUTHENTICATED', ...rows.map(r => r.actorRole)])].sort(), severities: ['INFO', 'SUCCESS', 'WARNING', 'DANGER'] };
}
const csvKeys = ['id', 'createdAt', 'actorLabel', 'actorEmail', 'actorMemberId', 'actorRole', 'source', 'module', 'action', 'outcome', 'severity', 'entityType', 'entityId', 'entity', 'description', 'changes', 'legacyDetails', 'actorSnapshotAvailable', 'metadata', 'requestId', 'ipAddress', 'userAgent', 'eventVersion'] as const;
export async function auditExport(actorId: string, raw: unknown, res: Response) {
  const q = auditQuery.parse(raw), filter = await scope(q);
  // Server-generated dates are immutable. A strict cutoff excludes this export and later appends.
  const cutoff = new Date();
  const where: Prisma.AuditLogWhereInput = { AND: [filter, { createdAt: { lt: cutoff } }] };
  const count = await prisma.auditLog.count({ where });
  await writeAudit({ actorId, action: 'AuditLogExported', entity: 'AuditLog', entityType: 'AuditLog', outcome: 'ACCESS_GRANTED', metadata: { rows: count, cutoff, actorId: q.actorId, module: q.module, action: q.action, actorRole: q.actorRole, severity: q.severity, sort: q.sort, from: q.from, to: q.to, searchApplied: !!q.search } });
  res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audit-log-${cutoff.toISOString().slice(0, 10)}.csv"`);
  const columns = csvKeys.map(key => ({ key, label: key }));
  res.write(toCsv(columns, []));
  let cursor: Pick<AuditLog, 'id' | 'createdAt'> | undefined;
  const direction = q.sort === 'oldest' ? 'asc' : 'desc', comparison = direction === 'asc' ? 'gt' : 'lt';
  try {
    while (!res.destroyed) {
      const rows = await prisma.auditLog.findMany({ where: { AND: [where, ...(cursor ? [{ OR: [{ createdAt: { [comparison]: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { [comparison]: cursor.id } }] }] : [])] }, include: actorInclude, orderBy: [{ createdAt: direction }, { id: direction }], take: 500 });
      if (!rows.length) break;
      const data = rows.map(row => { const dto = auditDto(row); return { ...dto, changes: dto.changes ? JSON.stringify(dto.changes) : '', legacyDetails: dto.legacyDetails ? JSON.stringify(dto.legacyDetails) : '', metadata: dto.metadata ? JSON.stringify(dto.metadata) : '' }; });
      const batch = toCsv(columns, data).split('\r\n').slice(1).join('\r\n');
      if (!res.write(`\r\n${batch}`)) await new Promise<void>(resolve => { const done = () => { res.off('drain', done); res.off('close', done); resolve(); }; res.once('drain', done); res.once('close', done); });
      cursor = rows.at(-1)!;
    }
    res.end();
  } catch { res.destroy(); }
}
