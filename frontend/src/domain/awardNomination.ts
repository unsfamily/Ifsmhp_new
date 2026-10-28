import { z } from 'zod';
import { phoneHasCountryCode } from './ceremonyRegistration';

export const NOMINATION_SUCCESS = 'Your nomination has been received.';
export const NOMINATION_EMAIL_NOTICE = 'An acknowledgement email has been sent to the nominator.';

export const DISCIPLINARY_AWARD_OPTIONS = [
  ['SWAMINATHAN', 'Dr. M. S. Swaminathan Award — Agricultural & Forestry Sciences'],
  ['SALIM_ALI', 'Dr. Salim Ali Award — Animal, Veterinary & Fishery Sciences'],
  ['NK_BOSE', 'Prof. N. K. Bose Award — Anthropological & Behavioural Sciences'],
  ['PC_RAY', 'Acharya P. C. Ray Award — Chemical Sciences'],
  ['DN_WADIA', 'Dr. D. N. Wadia Award — Earth System Sciences'],
  ['VISVESVARAYA', 'Sir M. Visvesvaraya Award — Engineering Sciences'],
  ['GADGIL', 'Prof. Madhav Gadgil Award — Environmental Sciences'],
  ['RAJ_REDDY', 'Dr. Raj Reddy Award — Information & Communication Science & Technology'],
  ['CNR_RAO', 'Prof. C. N. R. Rao Award — Materials Science'],
  ['RAMANUJAN', 'Srinivasa Ramanujan Award — Mathematical Sciences'],
  ['BRAHMACHARI', 'Dr. Upendranath Brahmachari Award — Medical Sciences'],
  ['KHORANA', 'Dr. Har Gobind Khorana Award — New Biology (including Biochemistry, Biophysics & Molecular Biology)'],
  ['CV_RAMAN', 'Sir C. V. Raman Award — Physical Sciences'],
  ['BIRBAL_SAHNI', 'Prof. Birbal Sahni Award — Plant Sciences'],
  ['AMARTYA_SEN', 'Dr. Amartya Sen Award — Economics'],
  ['MANMOHAN_SINGH', 'Dr. Manmohan Singh Award — Economic Policy & Development'],
  ['TAGORE', 'Rabindranath Tagore Award — Literature'],
  ['BHARATI', 'Subramania Bharati Award — Languages & Literary Scholarship'],
  ['DOSHI', 'Balkrishna Doshi Award — Architecture & Design'],
  ['GIRINDRASHEKHAR', 'Dr. Girindrasekhar Bose Award — Psychology'],
  ['MN_SRINIVAS', 'Prof. M. N. Srinivas Award — Sociology & Anthropology'],
  ['AMBEDKAR', 'Dr. B. R. Ambedkar Award — Human Rights & Social Justice'],
  ['VIDYARTHI', 'Ganesh Shankar Vidyarthi Award — Journalism & Media'],
  ['RADHAKRISHNAN', 'Dr. Sarvepalli Radhakrishnan Award — Education'],
  ['KRISHNA_IYER', 'Justice V. R. Krishna Iyer Award — Law & Constitutional Studies'],
] as const;

export const MEDAL_OPTIONS = [
  ['SARABHAI', 'Dr. Vikram Sarabhai Gold Medal'],
  ['BHABHA', 'Dr. Homi Jehangir Bhabha Gold Medal'],
  ['KALAM', 'Dr. A. P. J. Abdul Kalam Gold Medal'],
] as const;

export const DIVISION_OPTIONS = [
  ['DISTINGUISHED_FELLOWS', 'Senior — Distinguished Fellows Awards (Lifetime Contribution)'],
  ['EXCELLENCE', 'Mid-career — Excellence Awards (Established Contribution)'],
  ['RISING_ACHIEVERS', 'Young — Rising Achievers Awards (Emerging Contribution)'],
] as const;

const medalCodes = MEDAL_OPTIONS.map(([code]) => code);
const phoneMessage = 'Enter a phone number that includes the country code, for example +44 7700 900123.';
const required = (message: string) => z.string().trim().min(1, message);
const longText = (message: string) => required(message).max(4000, 'Use 4,000 characters or fewer.');
const confirmed = (message: string) => z.literal(true, { errorMap: () => ({ message }) });

export function nominationWordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export const awardNominationSchema = z.object({
  awardKind: z.enum(['DISCIPLINARY', 'MEDAL'], { errorMap: () => ({ message: 'Select a disciplinary award or a special gold medal.' }) }),
  awardCode: z.string().trim().min(1, 'Select one award.'),
  division: z.string(),
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
  orcid: z.string().trim().max(200, 'Use 200 characters or fewer for the ORCID or profile.'),
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
  statement: required('Enter the nomination statement.').max(12000, 'Keep the nomination statement within 1,000 words.').refine((value) => nominationWordCount(value) <= 1000, 'Keep the nomination statement within 1,000 words.'),
  nominationType: z.enum(['SELF', 'INSTITUTIONAL', 'COLLEAGUE'], { errorMap: () => ({ message: 'Select the nomination type.' }) }),
  nominatorName: required("Enter the nominator's full name.").max(160),
  nominatorDesignation: required("Enter the nominator's designation.").max(160),
  nominatorInstitution: required("Enter the nominator's institution or organisation.").max(200),
  nominatorEmail: required("Enter the nominator's email address.").max(191).email('Enter a valid email address for the nominator.'),
  nominatorPhone: required(phoneMessage).max(30, phoneMessage).refine(phoneHasCountryCode, phoneMessage),
  relationship: required('Describe the relationship to the nominee.').max(200),
  checklistCv: confirmed('Confirm that a curriculum vitae is included.'),
  checklistStatement: confirmed('Confirm that the nomination statement is included.'),
  checklistEvidence: confirmed('Confirm that supporting evidence is included.'),
  checklistHonours: z.boolean(),
  checklistRecommendation: z.boolean(),
  checklistPhotograph: confirmed('Confirm that a recent photograph is included.'),
  checklistConsent: confirmed('Confirm that the nominee has consented.'),
  declaration: confirmed('Confirm the declaration. Nomination does not guarantee selection.'),
}).superRefine((value, context) => {
  const codes = value.awardKind === 'MEDAL' ? medalCodes : DISCIPLINARY_AWARD_OPTIONS.map(([code]) => code);
  if (!codes.includes(value.awardCode as never)) context.addIssue({ code: 'custom', path: ['awardCode'], message: 'Select one award.' });
  if (value.awardKind === 'DISCIPLINARY' && !DIVISION_OPTIONS.some(([code]) => code === value.division)) {
    context.addIssue({ code: 'custom', path: ['division'], message: 'Select a recognition division.' });
  }
});

export const emptyAwardNomination = {
  awardKind: '' as '' | 'DISCIPLINARY' | 'MEDAL',
  awardCode: '',
  division: '',
  nomineeName: '',
  dateOfBirth: '',
  nationality: '',
  qualification: '',
  designation: '',
  institution: '',
  specialisation: '',
  yearsOfContribution: '',
  countryOfResidence: '',
  nomineeEmail: '',
  nomineePhone: '',
  orcid: '',
  careerOverview: '',
  principalContributions: '',
  impact: '',
  leadership: '',
  majorAwards: '',
  publications: '',
  patents: '',
  projects: '',
  institutionsEstablished: '',
  societalImpact: '',
  statement: '',
  nominationType: '' as '' | 'SELF' | 'INSTITUTIONAL' | 'COLLEAGUE',
  nominatorName: '',
  nominatorDesignation: '',
  nominatorInstitution: '',
  nominatorEmail: '',
  nominatorPhone: '',
  relationship: '',
  checklistCv: false,
  checklistStatement: false,
  checklistEvidence: false,
  checklistHonours: false,
  checklistRecommendation: false,
  checklistPhotograph: false,
  checklistConsent: false,
  declaration: false,
};
