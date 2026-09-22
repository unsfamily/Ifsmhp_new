import { appendFile } from 'node:fs/promises';
/** Optional full-suite audit contract checks: AUDIT_CAPTURE_CHECKS=1 npm test. */
import { afterEach, beforeEach, expect } from 'vitest';
import { prisma } from '../config/database';
import { classifyAction, eventRegistry } from '../domain/audit';
import { safeChanges, safeMetadata } from '../services/audit.service';

if (process.env.AUDIT_CAPTURE_CHECKS === '1') {
  let since = new Date();
  beforeEach(() => { since = new Date(); });
  afterEach(async () => {
    const rows = await prisma.auditLog.findMany({ where: { eventVersion: 1, createdAt: { gte: since } } });
    if (process.env.AUDIT_CAPTURE_REPORT && rows.length) await appendFile(process.env.AUDIT_CAPTURE_REPORT, JSON.stringify([...new Set(rows.map(row => row.action))]) + '\n');
    for (const row of rows) {
      expect(eventRegistry.some(event => event.action === row.action), `Unregistered event: ${row.action}`).toBe(true);
      expect(row.module, row.action).toBe(classifyAction(row.action));
      expect(['SUCCEEDED', 'DENIED', 'FAILED', 'ACCESS_GRANTED']).toContain(row.outcome);
      expect(row.actorLabel.length).toBeGreaterThan(0);
      expect(row.actorRole.length).toBeGreaterThan(0);
      expect(row.entity.length).toBeGreaterThan(0);
      expect(row.source?.length).toBeGreaterThan(0);
      expect(+row.createdAt).toBeLessThanOrEqual(Date.now());
      if (row.actorId) expect(row.actorEmail).toBeTruthy();
      if (row.changes !== null) expect(row.changes).toEqual(safeChanges(row.changes));
      if (row.metadata !== null) expect(row.metadata).toEqual(safeMetadata(row.metadata));
      expect(row.userAgent?.length ?? 0).toBeLessThanOrEqual(512);
    }
  });
}
