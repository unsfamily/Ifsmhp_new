import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';

/** Public ceremonies that accept interest registration. */
export const CEREMONY_SLUGS = ['second-international'] as const;
export type CeremonySlug = (typeof CEREMONY_SLUGS)[number];

export const PARTICIPATION_TYPES = ['DELEGATE', 'STUDENT_POSTER', 'AWARD_NOMINATION'] as const;
export type ParticipationType = (typeof PARTICIPATION_TYPES)[number];

export const PARTICIPATION_LABELS: Record<ParticipationType, string> = {
  DELEGATE: 'Delegate',
  STUDENT_POSTER: 'Interested in presenting a student poster',
  AWARD_NOMINATION: 'Interested in award nomination',
};

export const CEREMONY_MESSAGE_LIMIT = 1000;
export const CEREMONY_REGISTRATION_RATE_LIMIT = 8;
export const CEREMONY_REGISTRATION_RATE_WINDOW_MS = 60 * 60 * 1000;

const phoneMessage = 'Enter a phone number that includes the country code, for example +44 7700 900123.';

/** A country code is required, so the number must start with + and a non-zero digit. */
export function phoneHasCountryCode(value: string): boolean {
  const compact = value.trim();
  if (!/^\+[1-9][\d\s().-]{7,28}$/.test(compact)) return false;
  const digits = compact.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

const optionalText = (max: number, message: string) => z.string().trim().max(max, message).optional().transform((value) => value || undefined);

const requiredText = (missing: string) => z.string({ required_error: missing, invalid_type_error: missing });

export const ceremonyRegistrationBody = z.object({
  fullName: requiredText('Enter your full name.').trim().min(2, 'Enter your full name.').max(120, 'Use 120 characters or fewer for your full name.'),
  email: requiredText('Enter your email address.').trim().min(1, 'Enter your email address.').max(191, 'Use 191 characters or fewer for your email address.').email('Enter a valid email address.'),
  phone: requiredText(phoneMessage).trim().min(1, phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  institution: requiredText('Enter your institution or organisation.').trim().min(2, 'Enter your institution or organisation.').max(200, 'Use 200 characters or fewer for your institution or organisation.'),
  designation: optionalText(120, 'Use 120 characters or fewer for your designation.'),
  participationType: z.enum(PARTICIPATION_TYPES, { errorMap: () => ({ message: 'Select how you would like to take part.' }) }),
  message: optionalText(CEREMONY_MESSAGE_LIMIT, 'Keep the additional message within 1,000 characters.'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Acknowledge the privacy policy and consent to be contacted about this ceremony.' }) }),
}).strict();

export type CeremonyRegistrationInput = z.infer<typeof ceremonyRegistrationBody>;

export const ceremonyRegistrationListQuery = paginationQuerySchema.extend({
  ceremony: z.enum(CEREMONY_SLUGS).default('second-international'),
}).strict();

export function isCeremonySlug(value: string): value is CeremonySlug {
  return (CEREMONY_SLUGS as readonly string[]).includes(value);
}
