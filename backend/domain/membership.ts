import { z } from 'zod';
const money = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/, 'Enter an amount with up to two decimal places.').transform(v => Number(v).toFixed(2));
export const membershipSettings = z.object({
  pendingDays: z.number().int().min(1).max(365), reviewDays: z.number().int().min(1).max(365),
  idIssuance: z.enum(['AUTOMATIC', 'MANUAL']), idPrefix: z.string().trim().regex(/^[A-Z0-9][A-Z0-9_-]{0,29}$/, 'Use 1–30 uppercase letters, digits, hyphens or underscores.'),
  idPadding: z.number().int().min(4).max(10), requireProfile: z.boolean(), requireCredential: z.boolean(),
  applicationFeeEnabled: z.boolean(), applicationFee: money, annualDuesEnabled: z.boolean(), annualDues: money,
  currency: z.enum(['INR', 'USD', 'GBP']), paymentInstructions: z.string().trim().max(4000), waiversEnabled: z.boolean(),
  referralCount: z.number().int().min(0).max(5), referenceLetterCount: z.number().int().min(0).max(5),
  autoArchive: z.boolean(), archiveAfterDays: z.number().int().min(1).max(3650),
}).strict();
export type MembershipPolicy = z.infer<typeof membershipSettings>;
export const legacyMembershipPolicy: MembershipPolicy = {
  pendingDays: 5, reviewDays: 5, idIssuance: 'AUTOMATIC', idPrefix: 'IFSMHP', idPadding: 6,
  requireProfile: true, requireCredential: true, applicationFeeEnabled: false, applicationFee: '0.00',
  annualDuesEnabled: false, annualDues: '0.00', currency: 'INR', paymentInstructions: '', waiversEnabled: false,
  referralCount: 0, referenceLetterCount: 0, autoArchive: false, archiveAfterDays: 90,
};
export const referralSchema = z.object({ name: z.string().trim().min(2).max(191), email: z.string().trim().email().max(191).transform(v => v.toLowerCase()), organization: z.string().trim().max(200).default('') }).strict();
export const fileClaimSchema = z.object({ fileId: z.string().min(1), claimToken: z.string().min(20) }).strict();
export const waiverReason = z.string().trim().min(10, 'Explain the request in at least 10 characters.').max(2000);
export const manualMemberId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_/-]{2,99}$/, 'Use 3–100 letters, digits, hyphens, underscores or slashes.');
export interface MembershipPolicySnapshot { revision: number; values: MembershipPolicy }
