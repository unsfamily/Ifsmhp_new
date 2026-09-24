import { z } from 'zod';
import { IANAZone } from 'luxon';
export const sections = ['general', 'membership', 'events', 'communications', 'review', 'security', 'integrations', 'billing', 'backup'] as const;
export type SettingsSection = typeof sections[number];
const line = (max: number) => z.string().trim().max(max).refine(v => !/[\r\n]/.test(v) && !v.includes(String.fromCharCode(0)), 'Use a single line.');
const email = line(191).refine(v => !v || z.string().email().safeParse(v).success, 'Enter a valid email address.');
const url = line(2048).refine(v => !v || (z.string().url().safeParse(v).success && /^https?:\/\//i.test(v)), 'Use an HTTP or HTTPS URL.');
const days = z.number().int().min(1).max(365);
export const settingsSchemas = {
  general: z.object({ fullName: line(200), shortName: line(60), legalName: line(200), registrationNumber: line(100), address: z.string().trim().max(1000), contactEmail: email, contactPhone: line(60), homepageUrl: url, communityUrl: url, locale: z.enum(['en-GB', 'en-US', 'es', 'fr', 'de', 'ja', 'zh-CN', 'hi', 'ar']), timezone: line(100).refine(v => v === 'UTC' || IANAZone.isValidZone(v), 'Choose a valid IANA timezone.'), dateFormat: z.enum(['long', 'MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']), maintenance: z.boolean(), maintenanceMessage: z.string().trim().max(1000) }).strict(),
  membership: z.object({ pendingDays: days, reviewDays: days }).strict(),
  events: z.object({ capacity: z.number().int().min(0).max(100000), registrationRequired: z.boolean(), reminderDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]) }).strict(),
  communications: z.object({ senderName: line(150), replyTo: email, signature: z.string().trim().max(2000), announcementSignoff: z.boolean() }).strict(),
  review: z.object({ publicationDays: days, projectDays: days, supportDays: days }).strict(),
  security: z.object({ privacyEmail: email }).strict(), integrations: z.object({}).strict(), billing: z.object({}).strict(), backup: z.object({}).strict(),
};
export type SettingsValues = { [K in SettingsSection]: z.infer<typeof settingsSchemas[K]> };
export const settingsDefaults: SettingsValues = {
  general: { fullName: 'International Forum of Scientists and Mental Health Professionals', shortName: 'IFSMHP', legalName: '', registrationNumber: '', address: '', contactEmail: '', contactPhone: '', homepageUrl: '', communityUrl: '', locale: 'en-GB', timezone: 'UTC', dateFormat: 'long', maintenance: false, maintenanceMessage: '' },
  membership: { pendingDays: 5, reviewDays: 5 }, events: { capacity: 0, registrationRequired: true, reminderDays: 1 },
  communications: { senderName: '', replyTo: '', signature: '', announcementSignoff: false }, review: { publicationDays: 10, projectDays: 7, supportDays: 5 }, security: { privacyEmail: '' }, integrations: {}, billing: {}, backup: {},
};
export interface SettingsSnapshot { values: SettingsValues; defaults: SettingsValues; sections: Record<SettingsSection, { revision: number; updatedAt: string | null; updatedBy: string | null; editable: boolean }>; deployment: { mailConfigured: boolean; senderAddress: string; accessMinutes: number; refreshDays: number; storage: string; auditCount: number; retention: string }; }
export type PublicSettings = SettingsValues['general'] & SettingsValues['security'];
export const settingsPatch = z.object({ expectedRevision: z.number().int().min(0), values: z.record(z.unknown()) }).strict();
