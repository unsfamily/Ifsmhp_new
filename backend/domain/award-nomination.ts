import { z } from 'zod';
import { paginationQuerySchema } from '../utils/pagination';
import { phoneHasCountryCode } from './ceremony-registration';
import { CEREMONY_SLUGS } from './ceremony-registration';

export const AWARD_DIVISIONS = ['DISTINGUISHED_FELLOWS', 'EXCELLENCE', 'RISING_ACHIEVERS'] as const;
export const NOMINATION_TYPES = ['SELF', 'INSTITUTIONAL', 'COLLEAGUE'] as const;

export const DISCIPLINARY_AWARDS = [
  ['SWAMINATHAN', 'Dr. M. S. Swaminathan Award'],
  ['SALIM_ALI', 'Dr. Salim Ali Award'],
  ['NK_BOSE', 'Prof. N. K. Bose Award'],
  ['PC_RAY', 'Acharya P. C. Ray Award'],
  ['DN_WADIA', 'Dr. D. N. Wadia Award'],
  ['VISVESVARAYA', 'Sir M. Visvesvaraya Award'],
  ['GADGIL', 'Prof. Madhav Gadgil Award'],
  ['RAJ_REDDY', 'Dr. Raj Reddy Award'],
  ['CNR_RAO', 'Prof. C. N. R. Rao Award'],
  ['RAMANUJAN', 'Srinivasa Ramanujan Award'],
  ['BRAHMACHARI', 'Dr. Upendranath Brahmachari Award'],
  ['KHORANA', 'Dr. Har Gobind Khorana Award'],
  ['CV_RAMAN', 'Sir C. V. Raman Award'],
  ['BIRBAL_SAHNI', 'Prof. Birbal Sahni Award'],
  ['AMARTYA_SEN', 'Dr. Amartya Sen Award'],
  ['MANMOHAN_SINGH', 'Dr. Manmohan Singh Award'],
  ['TAGORE', 'Rabindranath Tagore Award'],
  ['BHARATI', 'Subramania Bharati Award'],
  ['DOSHI', 'Balkrishna Doshi Award'],
  ['GIRINDRASHEKHAR', 'Dr. Girindrasekhar Bose Award'],
  ['MN_SRINIVAS', 'Prof. M. N. Srinivas Award'],
  ['AMBEDKAR', 'Dr. B. R. Ambedkar Award'],
  ['VIDYARTHI', 'Ganesh Shankar Vidyarthi Award'],
  ['RADHAKRISHNAN', 'Dr. Sarvepalli Radhakrishnan Award'],
  ['KRISHNA_IYER', 'Justice V. R. Krishna Iyer Award'],
] as const;

export const SPECIAL_MEDALS = [
  ['SARABHAI', 'Dr. Vikram Sarabhai Gold Medal'],
  ['BHABHA', 'Dr. Homi Jehangir Bhabha Gold Medal'],
  ['KALAM', 'Dr. A. P. J. Abdul Kalam Gold Medal'],
] as const;

const awardNames = Object.fromEntries([...DISCIPLINARY_AWARDS, ...SPECIAL_MEDALS]);
const disciplinaryCodes = DISCIPLINARY_AWARDS.map(([code]) => code);
const medalCodes = SPECIAL_MEDALS.map(([code]) => code);

export function awardLabel(code: string) {
  return awardNames[code] ?? code;
}

export function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

const phoneMessage = 'Enter a phone number that includes the country code, for example +44 7700 900123.';
const required = (message: string) => z.string({ required_error: message, invalid_type_error: message }).trim().min(1, message);
const longText = (message: string) => required(message).max(4000, 'Use 4,000 characters or fewer.');

const confirmed = (message: string) => z.literal(true, { errorMap: () => ({ message }) });

export const awardNominationBody = z.object({
  awardCode: z.enum([...disciplinaryCodes, ...medalCodes] as [string, ...string[]], { errorMap: () => ({ message: 'Select one award.' }) }),
  division: z.enum(AWARD_DIVISIONS).optional(),
  nomineeName: required("Enter the nominee's full name.").max(160, 'Use 160 characters or fewer for the nominee name.'),
  dateOfBirth: required('Enter the date of birth.').max(40, 'Use 40 characters or fewer for the date of birth.'),
  nationality: required('Enter the nationality.').max(80, 'Use 80 characters or fewer for the nationality.'),
  qualification: required('Enter the highest qualification.').max(200, 'Use 200 characters or fewer for the qualification.'),
  designation: required('Enter the current designation.').max(160, 'Use 160 characters or fewer for the designation.'),
  institution: required('Enter the institution or organisation.').max(200, 'Use 200 characters or fewer for the institution.'),
  specialisation: required('Enter the primary discipline or specialisation.').max(200, 'Use 200 characters or fewer for the specialisation.'),
  yearsOfContribution: required('Enter the years of professional contribution.').max(40, 'Use 40 characters or fewer.'),
  countryOfResidence: required('Enter the country of residence.').max(80, 'Use 80 characters or fewer for the country.'),
  nomineeEmail: required("Enter the nominee's email address.").max(191).email('Enter a valid email address for the nominee.'),
  nomineePhone: required(phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  orcid: z.string().trim().max(200, 'Use 200 characters or fewer for the ORCID or profile.').optional().transform((value) => value || undefined),
  careerOverview: longText('Describe the professional career.'),
  principalContributions: longText('Describe the principal contributions.'),
  impact: longText('Describe the national or international impact.'),
  leadership: longText('Describe the leadership and mentoring contributions.'),
  majorAwards: longText('List the major awards and distinctions.'),
  publications: longText('Record the research publications or books.'),
  patents: longText('Record the patents, technologies, or creative works.'),
  projects: longText('Record the research projects or initiatives.'),
  institutionsEstablished: longText('Record the institutions or programmes established.'),
  societalImpact: longText('Record the documented societal or professional impact.'),
  statement: required('Enter the nomination statement.').max(12000, 'Keep the nomination statement within 1,000 words.').refine((value) => wordCount(value) <= 1000, 'Keep the nomination statement within 1,000 words.'),
  nominationType: z.enum(NOMINATION_TYPES, { errorMap: () => ({ message: 'Select the nomination type.' }) }),
  nominatorName: required("Enter the nominator's full name.").max(160),
  nominatorDesignation: required("Enter the nominator's designation.").max(160),
  nominatorInstitution: required("Enter the nominator's institution or organisation.").max(200),
  nominatorEmail: required("Enter the nominator's email address.").max(191).email('Enter a valid email address for the nominator.'),
  nominatorPhone: required(phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  relationship: required('Describe the relationship to the nominee.').max(200),
  checklistCv: confirmed('Confirm that a curriculum vitae is included.'),
  checklistStatement: confirmed('Confirm that the nomination statement is included.'),
  checklistEvidence: confirmed('Confirm that supporting evidence is included.'),
  checklistHonours: z.boolean().optional().default(false),
  checklistRecommendation: z.boolean().optional().default(false),
  checklistPhotograph: confirmed('Confirm that a recent photograph is included.'),
  checklistConsent: confirmed('Confirm that the nominee has consented.'),
  declaration: confirmed('Confirm the declaration before submitting the nomination.'),
}).strict().superRefine((value, context) => {
  const medal = (medalCodes as readonly string[]).includes(value.awardCode);
  if (medal && value.division) context.addIssue({ code: 'custom', path: ['division'], message: 'A special gold medal does not use a recognition division.' });
  if (!medal && !value.division) context.addIssue({ code: 'custom', path: ['division'], message: 'Select a recognition division.' });
});

export type AwardNominationInput = z.infer<typeof awardNominationBody>;

export const awardNominationListQuery = paginationQuerySchema.extend({
  ceremony: z.enum(CEREMONY_SLUGS).default('second-international'),
}).strict();

export const AWARD_NOMINATION_RATE_LIMIT = 5;
export const AWARD_NOMINATION_RATE_WINDOW_MS = 60 * 60 * 1000;
