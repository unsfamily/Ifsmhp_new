import { z } from 'zod';

export const memberAddressSchema = z.string().trim()
  .max(1000, 'Address must be 1,000 characters or fewer.')
  .refine(value => !value || value.length >= 5, 'Enter at least 5 characters for the address.')
  .transform(value => value || null).nullable().optional();

export const memberNameSchema = z.string().trim().min(1, 'Enter a name.').max(59, 'Name must be 59 characters or fewer.');

export function validateRegistrationNames(value: { fullName: string; firstName?: string; lastName?: string }, ctx: z.RefinementCtx) {
  if (value.firstName === undefined && value.lastName === undefined) return;
  if (value.firstName === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['firstName'], message: 'First name is required with last name.' });
  if (value.lastName === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lastName'], message: 'Last name is required with first name.' });
  if (value.firstName !== undefined && value.lastName !== undefined && value.fullName.trim() !== `${value.firstName} ${value.lastName}`) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fullName'], message: 'Full name must match first name and last name.' });
  }
}

export const memberPhoneMessage = 'Enter exactly 10 digits, without spaces or a country code.';

// Keep phone numbers as strings: leading zeros are significant. Do not trim or
// normalize historical values or accept JavaScript's trailing-newline match.
export const memberPhoneSchema = z.string({
  required_error: memberPhoneMessage,
  invalid_type_error: memberPhoneMessage,
}).length(10, memberPhoneMessage).refine(value => !/[^0-9]/.test(value), memberPhoneMessage);
