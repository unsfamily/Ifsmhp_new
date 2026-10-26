import { z } from 'zod';

export const CEREMONY_SLUG = 'second-international';
export const CEREMONY_PAGE_PATH = '/awards/second-international';
export const CEREMONY_REGISTER_PATH = '/awards/second-international/register';
export const CEREMONY_MESSAGE_LIMIT = 1000;

export const PARTICIPATION_OPTIONS = [
  { value: 'DELEGATE', label: 'Delegate' },
  { value: 'STUDENT_POSTER', label: 'Interested in presenting a student poster' },
  { value: 'AWARD_NOMINATION', label: 'Interested in award nomination' },
] as const;

export type ParticipationValue = (typeof PARTICIPATION_OPTIONS)[number]['value'];

const phoneMessage = 'Enter a phone number that includes the country code, for example +44 7700 900123.';

export function phoneHasCountryCode(value: string): boolean {
  const compact = value.trim();
  if (!/^\+[1-9][\d\s().-]{7,28}$/.test(compact)) return false;
  const digits = compact.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

export const ceremonyRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(120, 'Use 120 characters or fewer for your full name.'),
  email: z.string().trim().min(1, 'Enter your email address.').max(191, 'Use 191 characters or fewer for your email address.').email('Enter a valid email address.'),
  phone: z.string().trim().min(1, phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  institution: z.string().trim().min(2, 'Enter your institution or organisation.').max(200, 'Use 200 characters or fewer for your institution or organisation.'),
  designation: z.string().trim().max(120, 'Use 120 characters or fewer for your designation.'),
  participationType: z.enum(['DELEGATE', 'STUDENT_POSTER', 'AWARD_NOMINATION'], { errorMap: () => ({ message: 'Select how you would like to take part.' }) }),
  message: z.string().trim().max(CEREMONY_MESSAGE_LIMIT, 'Keep the additional message within 1,000 characters.'),
  consent: z.literal(true, { errorMap: () => ({ message: 'Acknowledge the privacy policy and consent to be contacted about this ceremony.' }) }),
});

export const CEREMONY_DATE_NOTICE = 'Event date and venue are being finalised. Register your interest to receive ceremony updates.';
export const CEREMONY_INTEREST_NOTICE = 'Registering records your interest in attending. It does not guarantee an award, acceptance of a poster, or reserved admission. Award nomination and poster submission requirements will be communicated separately.';
export const CEREMONY_SUCCESS_MESSAGE = 'Your registration of interest has been received.';

export const emptyCeremonyRegistration = {
  fullName: '',
  email: '',
  phone: '',
  institution: '',
  designation: '',
  participationType: '' as '' | ParticipationValue,
  message: '',
  consent: false,
};
