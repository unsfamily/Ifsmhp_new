import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config';
import { settingsDefaults, settingsSchemas, sections, type SettingsSection, type SettingsValues } from '../domain/settings';
import { ApiError } from '../utils/ApiError';
import { writeAudit } from './audit.service';
type DB = Prisma.TransactionClient;
export async function effectiveSettings(db: DB = prisma): Promise<SettingsValues> {
  const values = structuredClone(settingsDefaults);
  const rows = await db.platformSetting.findMany();
  const legacySla = rows.find(r => r.section === 'membership' && r.key === 'approval_sla_days');
  if (legacySla && settingsSchemas.membership.shape.pendingDays.safeParse(legacySla.value).success) values.membership = { pendingDays: Number(legacySla.value), reviewDays: Number(legacySla.value) };
  const legacyZone = rows.find(r => r.section === 'events' && r.key === 'default_timezone');
  if (legacyZone && settingsSchemas.general.shape.timezone.safeParse(legacyZone.value).success) values.general.timezone = String(legacyZone.value);
  for (const row of rows) {
    if (!sections.includes(row.section as SettingsSection)) continue;
    const section = row.section as SettingsSection;
    const schema = settingsSchemas[section].shape as Record<string, { parse: (v: unknown) => unknown }>;
    if (Object.hasOwn(schema, row.key)) (values[section] as Record<string, unknown>)[row.key] = schema[row.key]!.parse(row.value);
  }
  return values;
}
export async function getSettings() {
  return prisma.$transaction(async tx => {
    const values = await effectiveSettings(tx);
    const revisions = await tx.settingRevision.findMany();
    const auditCount = await tx.auditLog.count();
    return { values, defaults: settingsDefaults, sections: Object.fromEntries(sections.map(section => {
      const r = revisions.find(row => row.section === section);
      return [section, { revision: r?.revision ?? 0, updatedAt: r?.updatedAt ?? null, updatedBy: r?.updatedBy ?? null, editable: Object.keys(settingsSchemas[section].shape).length > 0 }];
    })), deployment: { mailConfigured: env.mailConfigured, senderAddress: env.mailConfigured ? env.mailFrom : '', accessMinutes: env.ACCESS_TOKEN_TTL_MINUTES, refreshDays: env.REFRESH_TOKEN_TTL_DAYS, storage: 'Disk storage', auditCount, retention: 'Indefinite' } };
  });
}
export async function updateSettings(actorId: string, section: SettingsSection, revision: number, raw: Record<string, unknown>) {
  const patch = settingsSchemas[section].partial().parse(raw) as Record<string, Prisma.InputJsonValue>;
  if (!Object.keys(settingsSchemas[section].shape).length) throw ApiError.unprocessable('This section has no editable settings.');
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO SettingRevision (section, revision) VALUES (${section}, 0) ON DUPLICATE KEY UPDATE section = section`;
    const claimed = await tx.settingRevision.updateMany({ where: { section, revision }, data: { revision: { increment: 1 } } });
    if (!claimed.count) throw ApiError.conflict('This section changed. Refresh and review the latest values before saving.');
    const before = (await effectiveSettings(tx))[section] as Record<string, unknown>;
    const next = settingsSchemas[section].parse({ ...before, ...patch }) as Record<string, Prisma.InputJsonValue>;
    if (section === 'general' && next.maintenance && !next.maintenanceMessage) throw ApiError.unprocessable('Enter a notice message.', [{ field: 'maintenanceMessage', message: 'Required when the notice is enabled.' }]);
    const keys = Object.keys(patch).filter(key => before[key] !== next[key]);
    if (!keys.length) { await tx.settingRevision.update({ where: { section }, data: { revision } }); return; }
    for (const key of keys) await tx.platformSetting.upsert({ where: { section_key: { section, key } }, create: { section, key, value: next[key]!, updatedBy: actorId }, update: { value: next[key]!, updatedBy: actorId } });
    await tx.settingRevision.update({ where: { section }, data: { updatedBy: actorId, updatedAt: new Date() } });
    const changes = Object.fromEntries(keys.filter(k => !['signature', 'maintenanceMessage', 'address'].includes(k)).map(k => [k, { before: before[k], after: next[k] }]));
    await writeAudit({ actorId, action: 'PlatformSettingsUpdated', entity: `PlatformSetting ${section}`, entityType: 'PlatformSetting', entityId: section, changes, metadata: { changedFields: keys }, description: `Updated ${section} settings.` }, tx);
  });
  return getSettings();
}
export async function publicSettings() { const v = await effectiveSettings(); return { ...v.general, privacyEmail: v.security.privacyEmail }; }

/** Stage-aware ageing; legacy missing review history must remain unknown. */
export async function membershipAge(apps: { id: string; status: string; submittedAt: Date }[], db: DB = prisma) {
  const { membership } = await effectiveSettings(db);
  const history = await db.applicationStatusHistory.findMany({ where: { applicationId: { in: apps.map(a => a.id) }, toStatus: 'UNDER_REVIEW', OR: [{ fromStatus: null }, { fromStatus: { not: 'UNDER_REVIEW' } }] }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  return new Map(apps.map(app => {
    const start = app.status === 'PENDING' ? app.submittedAt : app.status === 'UNDER_REVIEW' ? history.find(h => h.applicationId === app.id)?.createdAt : null;
    const days = start ? Math.max(0, (Date.now() - +start) / 86400000) : null;
    const target = app.status === 'UNDER_REVIEW' ? membership.reviewDays : membership.pendingDays;
    return [app.id, { stageSlaDays: days === null ? null : Math.floor(days), stageSlaTarget: target, stageSlaBreached: days !== null && days >= target }];
  }));
}
