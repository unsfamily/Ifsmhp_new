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

export const COMMEMORATIVE_AWARD_LABELS = [
  'Dr. M. S. Swaminathan Award — Agricultural & Forestry Sciences',
  'Dr. Salim Ali Award — Animal, Veterinary & Fishery Sciences',
  'Prof. N. K. Bose Award — Anthropological & Behavioural Sciences',
  'Acharya P. C. Ray Award — Chemical Sciences',
  'Dr. D. N. Wadia Award — Earth System Sciences',
  'Sir M. Visvesvaraya Award — Engineering Sciences',
  'Prof. Madhav Gadgil Award — Environmental Sciences',
  'Dr. Raj Reddy Award — Information & Communication Science & Technology',
  'Prof. C. N. R. Rao Award — Materials Science',
  'Srinivasa Ramanujan Award — Mathematical Sciences',
  'Dr. Upendranath Brahmachari Award — Medical Sciences',
  'Dr. Har Gobind Khorana Award — New Biology (including Biochemistry, Biophysics & Molecular Biology)',
  'Sir C. V. Raman Award — Physical Sciences',
  'Prof. Birbal Sahni Award — Plant Sciences',
  'Dr. Amartya Sen Award — Economics',
  'Dr. Manmohan Singh Award — Economic Policy & Development',
  'Rabindranath Tagore Award — Literature',
  'Subramania Bharati Award — Languages & Literary Scholarship',
  'Balkrishna Doshi Award — Architecture & Design',
  'Dr. Girindrasekhar Bose Award — Psychology',
  'Prof. M. N. Srinivas Award — Sociology & Anthropology',
  'Dr. B. R. Ambedkar Award — Human Rights & Social Justice',
  'Ganesh Shankar Vidyarthi Award — Journalism & Media',
  'Dr. Sarvepalli Radhakrishnan Award — Education',
  'Justice V. R. Krishna Iyer Award — Law & Constitutional Studies',
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
const optionalText = (max: number) => z.string().trim().max(max).optional().default('');
const fileClaim = z.object({ fileId: z.string().min(1), claimToken: z.string().min(20) }).strict();

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
  specialisation: optionalText(200),
  yearsOfContribution: required('Enter the years of professional contribution.').max(40, 'Use 40 characters or fewer.'),
  countryOfResidence: required('Enter the country of residence.').max(80, 'Use 80 characters or fewer for the country.'),
  nomineeEmail: required("Enter the nominee's email address.").max(191).email('Enter a valid email address for the nominee.'),
  nomineePhone: required(phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  orcid: z.string().trim().max(200, 'Use 200 characters or fewer for the ORCID or profile.').optional().transform((value) => value || undefined),
  careerOverview: longText('Describe the professional career.'),
  principalContributions: longText('Describe the principal contributions.'),
  impact: optionalText(4000),
  leadership: optionalText(4000),
  majorAwards: longText('List the major awards and distinctions.'),
  publications: longText('Record the research publications or books.'),
  patents: optionalText(4000),
  projects: longText('Record the research projects or initiatives.'),
  institutionsEstablished: optionalText(4000),
  societalImpact: optionalText(4000),
  statement: required('Enter the nomination statement.').max(12000, 'Keep the nomination statement within 1,000 words.').refine((value) => wordCount(value) <= 1000, 'Keep the nomination statement within 1,000 words.'),
  nominationType: z.enum(NOMINATION_TYPES, { errorMap: () => ({ message: 'Select the nomination type.' }) }),
  nominatorName: required("Enter the nominator's full name.").max(160),
  nominatorDesignation: required("Enter the nominator's designation.").max(160),
  nominatorInstitution: required("Enter the nominator's institution or organisation.").max(200),
  nominatorEmail: required("Enter the nominator's email address.").max(191).email('Enter a valid email address for the nominator.'),
  nominatorPhone: required(phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  relationship: required('Describe the relationship to the nominee.').max(200),
  cv: fileClaim,
  photo: fileClaim,
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

export const awardNominationExportQuery = z.object({
  ceremony: z.enum(CEREMONY_SLUGS).default('second-international'),
  format: z.enum(['csv', 'xlsx']).default('xlsx'),
}).strict();

function isAwardDivision(value: string): value is (typeof AWARD_DIVISIONS)[number] {
  return (AWARD_DIVISIONS as readonly string[]).includes(value);
}

function isNominationType(value: string): value is (typeof NOMINATION_TYPES)[number] {
  return (NOMINATION_TYPES as readonly string[]).includes(value);
}

export function awardDivisionLabel(division: string | null): string {
  if (division === null || !isAwardDivision(division)) return division ?? '';
  switch (division) {
    case 'DISTINGUISHED_FELLOWS':
      return 'Senior — Distinguished Fellows (Lifetime Contribution)';
    case 'EXCELLENCE':
      return 'Mid-career — Excellence (Established Contribution)';
    case 'RISING_ACHIEVERS':
      return 'Young — Rising Achievers (Emerging Contribution)';
    default: {
      const unknown: never = division;
      return unknown;
    }
  }
}

export function nominationTypeLabel(nominationType: string): string {
  if (!isNominationType(nominationType)) return nominationType;
  switch (nominationType) {
    case 'SELF':
      return 'Self nomination';
    case 'INSTITUTIONAL':
      return 'Institutional nomination';
    case 'COLLEAGUE':
      return 'Colleague nomination';
    default: {
      const unknown: never = nominationType;
      return unknown;
    }
  }
}

export const AWARD_NOMINATION_RATE_LIMIT = 5;
export const AWARD_NOMINATION_RATE_WINDOW_MS = 60 * 60 * 1000;
