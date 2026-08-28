import { Prisma, type AuditSeverity } from '@prisma/client';
import { prisma } from '../config/database';

export interface AuditInput {
  actorId?: string | null;
  actorLabel: string;
  actorRole: string;
  action: string;
  entity: string;
  severity?: AuditSeverity;
  description: string;
  changes?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      actorLabel: input.actorLabel,
      actorRole: input.actorRole,
      action: input.action,
      entity: input.entity,
      severity: input.severity ?? 'INFO',
      description: input.description,
      changes: input.changes === undefined ? undefined : (input.changes as Prisma.InputJsonValue),
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    },
  });
}
