import { z } from 'zod';
import { IANAZone } from 'luxon';
export const preferenceDefaults = { appNewMember: true, supportUrgent: true, supportAll: false, inquiryNew: false };
export const preferenceSchema = z.object({ appNewMember: z.boolean(), supportUrgent: z.boolean(), supportAll: z.boolean(), inquiryNew: z.boolean() }).strict();
export const designations = ['CRO Lead', 'CRO Administrator', 'SAB Member', 'Grants Officer', 'Communications', 'Wellness Committee', 'Auditor (Read-only)'] as const;
const optionalText = (max: number) => z.string().trim().max(max);
export function validOrcid(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value)) return false;
  const digits = value.replaceAll('-', '');
  let total = 0;
  for (const digit of digits.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - total % 11) % 11;
  return digits[15] === (check === 10 ? 'X' : String(check));
}
export const profileFields = z.object({
  firstName: z.string().trim().min(1).max(60), lastName: optionalText(60), displayName: optionalText(120),
  designation: z.union([z.enum(designations), z.literal('')]), jobTitle: optionalText(200),
  workEmail: z.union([z.string().trim().email().max(191), z.literal('')]), phone: optionalText(40), institution: optionalText(200), country: optionalText(120),
  timezone: z.string().max(100).refine(v => v === 'UTC' || IANAZone.isValidZone(v), 'Choose a valid IANA timezone.'),
  orcid: optionalText(19).refine(validOrcid, 'Enter a valid ORCID iD, including its check digit.'),
  website: z.union([z.literal(''), z.string().trim().max(2048).url().refine(v => /^https?:\/\//i.test(v), 'Use an HTTP or HTTPS URL.')]), bio: optionalText(600),
}).strict();
export const updateProfileBody = z.object({ expectedRevision: z.number().int().min(0), profile: profileFields.optional(), preferences: preferenceSchema.optional() }).strict().refine(v => v.profile || v.preferences, 'Provide profile information or preferences.');
export const newAdminPassword = z.string().refine(v => [...v].length >= 14, 'Use at least 14 characters.').refine(v => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be no more than 72 UTF-8 bytes.');
export const passwordBody = z.object({ currentPassword: z.string().min(1).max(1024), password: newAdminPassword, confirmation: z.string().max(1024) }).strict().refine(v => v.password === v.confirmation, { path: ['confirmation'], message: 'Passwords do not match.' });
