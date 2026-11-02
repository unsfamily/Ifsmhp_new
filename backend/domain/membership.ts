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
/** Shown to applicants when the application fee is enabled. Admins may edit this in Settings. */
export const DEFAULT_APPLICATION_PAYMENT_INSTRUCTIONS = `Pay the IFSMHP application registration fee (INR 100) by UPI or bank transfer.

Account name: IFSMHP
Account number: 50200123978890
IFSC: HDFC0000111
Bank: HDFC Bank

In the payment remark / UPI note, enter: IFSMHP-<your application ID>
After paying, submit your UTR / UPI reference on the application status page. An administrator will verify the payment against the bank statement, then review your documents and approve membership separately. Recording payment does not approve membership.

Students: no application fee.`;
export const legacyMembershipPolicy: MembershipPolicy = {
  pendingDays: 5, reviewDays: 5, idIssuance: 'AUTOMATIC', idPrefix: 'IFSMHP', idPadding: 6,
  requireProfile: true, requireCredential: true, applicationFeeEnabled: true, applicationFee: '100.00',
  annualDuesEnabled: false, annualDues: '0.00', currency: 'INR', paymentInstructions: DEFAULT_APPLICATION_PAYMENT_INSTRUCTIONS, waiversEnabled: false,
  referralCount: 0, referenceLetterCount: 0, autoArchive: false, archiveAfterDays: 90,
};
export const referralSchema = z.object({ name: z.string().trim().min(2).max(191), email: z.string().trim().email().max(191).transform(v => v.toLowerCase()), organization: z.string().trim().max(200).default('') }).strict();
export const fileClaimSchema = z.object({ fileId: z.string().min(1), claimToken: z.string().min(20) }).strict();
export const waiverReason = z.string().trim().min(10, 'Explain the request in at least 10 characters.').max(2000);
export const paymentReference = z.string().trim().min(4, 'Enter a UTR or UPI reference of at least 4 characters.').max(191)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_.\- ]{2,189}[A-Za-z0-9]$/, 'Use letters, digits, spaces, or / _ . - only.');
export const manualMemberId = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_/-]{2,99}$/, 'Use 3–100 letters, digits, hyphens, underscores or slashes.');
/** Professional type that skips the application registration fee. Exact register-form value. */
export const APPLICATION_FEE_EXEMPT_TYPE = 'Student';
export const isApplicationFeeExempt = (professionalType: string) => professionalType.trim() === APPLICATION_FEE_EXEMPT_TYPE;
export interface MembershipPolicySnapshot { revision: number; values: MembershipPolicy }
