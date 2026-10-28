export type CeremonyAward = {
  name: string;
  discipline: string;
};

export type CeremonyAwardGroup = {
  label: string;
  title: string;
  awards: CeremonyAward[];
};

export type CeremonyDivision = {
  title: string;
  detail?: string;
  description?: string;
  eligibility?: string;
  level?: string;
};

export type AwardEligibilityRule = {
  title: string;
  detail: string;
};

export type AwardContributionRule = {
  field: string;
  detail: string;
};

export type AwardEvaluationRow = {
  parameter: string;
  marks: number;
};

export type AwardAllocationRow = {
  division: string;
  categories: number;
  senior: number;
  midCareer: number;
  young: number;
  total: number;
};

export type CeremonyMedal = {
  name: string;
};

export type CeremonyCommitteeMember = {
  name: string;
  role: string;
  organisation: string;
  affiliation?: string;
  tagline?: string;
  photoKey?: 'yaseen-shaikh';
  summary?: string[];
  highlights?: { label: string; value: string }[];
  milestones?: { title: string; detail: string }[];
  identifiers?: { label: string; href?: string }[];
};

export type CeremonyProgramme = {
  kicker?: string;
  title?: string;
  date?: string;
  groups: CeremonyAwardGroup[];
  medals?: CeremonyMedal[];
  divisions: CeremonyDivision[];
  allocation?: AwardAllocationRow[];
  allocationNote?: string;
  divisionNote?: string;
  totalLabel?: string;
  reference?: string;
  notice?: string;
  eligibilityIntro?: string;
  eligibilityRules?: AwardEligibilityRule[];
  contributionRules?: AwardContributionRule[];
  nominationDocuments?: string[];
  evaluation?: AwardEvaluationRow[];
  qualifyingScores?: string;
  selectionNote?: string;
  committee?: CeremonyCommitteeMember[];
};

export const CEREMONY_EVENT_DATE = '26 December 2026';
/** ISO-8601 with Asia/Kolkata offset — required for Schema.org / Google Event rich results. */
export const CEREMONY_START_ISO = '2026-12-26T09:00:00+05:30';
export const CEREMONY_END_ISO = '2026-12-26T18:00:00+05:30';
export const CEREMONY_DATE_ISO = '2026-12-26';
export const CEREMONY_PAGE_TITLE = 'Second International IFSMHP Awards 2026';
export const CEREMONY_VENUE = 'A.R. Shaikh Assembly Hall (Azam Campus)';
export const CEREMONY_ADDRESS = 'Azam Campus, 2390 K.B. Hidayatullah Road, New Modikhana, Camp, Pune, Maharashtra 411001';

export const ceremonyProgramme: CeremonyProgramme = {
  kicker: 'Official notification',
  title: 'Proposed commemorative award names',
  date: CEREMONY_EVENT_DATE,
  reference: 'Ref. IFSMHP/AWARDS/2026/02 · 26 October 2026',
  notice: 'These titles are proposed IFSMHP honours. They do not imply endorsement by the namesakes, their families, associated institutions, or government authorities. Final adoption remains subject to the IFSMHP Awards Committee.',
  groups: [
    {
      label: '1',
      title: 'Scientific and Technological Sciences',
      awards: [
        { name: 'Dr. M. S. Swaminathan Award', discipline: 'Agricultural & Forestry Sciences' },
        { name: 'Dr. Salim Ali Award', discipline: 'Animal, Veterinary & Fishery Sciences' },
        { name: 'Prof. N. K. Bose Award', discipline: 'Anthropological & Behavioural Sciences' },
        { name: 'Acharya P. C. Ray Award', discipline: 'Chemical Sciences' },
        { name: 'Dr. D. N. Wadia Award', discipline: 'Earth System Sciences' },
        { name: 'Sir M. Visvesvaraya Award', discipline: 'Engineering Sciences' },
        { name: 'Prof. Madhav Gadgil Award', discipline: 'Environmental Sciences' },
        { name: 'Dr. Raj Reddy Award', discipline: 'Information & Communication Science & Technology' },
        { name: 'Prof. C. N. R. Rao Award', discipline: 'Materials Science' },
        { name: 'Srinivasa Ramanujan Award', discipline: 'Mathematical Sciences' },
        { name: 'Dr. Upendranath Brahmachari Award', discipline: 'Medical Sciences' },
        { name: 'Dr. Har Gobind Khorana Award', discipline: 'New Biology (including Biochemistry, Biophysics & Molecular Biology)' },
        { name: 'Sir C. V. Raman Award', discipline: 'Physical Sciences' },
        { name: 'Prof. Birbal Sahni Award', discipline: 'Plant Sciences' },
      ],
    },
    {
      label: '2',
      title: 'Economics, Literature and Architecture',
      awards: [
        { name: 'Dr. Amartya Sen Award', discipline: 'Economics' },
        { name: 'Dr. Manmohan Singh Award', discipline: 'Economic Policy & Development' },
        { name: 'Rabindranath Tagore Award', discipline: 'Literature' },
        { name: 'Subramania Bharati Award', discipline: 'Languages & Literary Scholarship' },
        { name: 'Balkrishna Doshi Award', discipline: 'Architecture & Design' },
      ],
    },
    {
      label: '3',
      title: 'Psychology, Sociology and Human Rights',
      awards: [
        { name: 'Dr. Girindrasekhar Bose Award', discipline: 'Psychology' },
        { name: 'Prof. M. N. Srinivas Award', discipline: 'Sociology & Anthropology' },
        { name: 'Dr. B. R. Ambedkar Award', discipline: 'Human Rights & Social Justice' },
      ],
    },
    {
      label: '4',
      title: 'Journalism, Education and Law',
      awards: [
        { name: 'Ganesh Shankar Vidyarthi Award', discipline: 'Journalism & Media' },
        { name: 'Dr. Sarvepalli Radhakrishnan Award', discipline: 'Education' },
        { name: 'Justice V. R. Krishna Iyer Award', discipline: 'Law & Constitutional Studies' },
      ],
    },
  ],
  divisions: [
    {
      level: 'Senior',
      title: 'Distinguished Fellows Awards',
      detail: '25',
      description: 'Lifetime Contribution',
      eligibility: 'Ordinarily 20 or more years of relevant work, with sustained exceptional achievement, leadership, and lasting influence on a discipline or society.',
    },
    {
      level: 'Mid-career',
      title: 'Excellence Awards',
      detail: '25',
      description: 'Established Contribution',
      eligibility: 'Ordinarily 8–19 years of relevant work, with significant established accomplishments and independently verifiable outcomes beyond routine responsibilities.',
    },
    {
      level: 'Young',
      title: 'Rising Achievers Awards',
      detail: '25',
      description: 'Emerging Contribution',
      eligibility: 'Ordinarily age 35 or below on 26 December 2026, with notable early achievement and demonstrated promise. Career stage and evidence take precedence over age alone.',
    },
  ],
  allocation: [
    { division: 'Scientific Disciplines (Indian Science Congress Framework)', categories: 14, senior: 14, midCareer: 14, young: 14, total: 42 },
    { division: 'Economics & Public Policy', categories: 2, senior: 2, midCareer: 2, young: 2, total: 6 },
    { division: 'Literature & Languages', categories: 2, senior: 2, midCareer: 2, young: 2, total: 6 },
    { division: 'Architecture & Design', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Psychology', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Sociology & Anthropology', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Human Rights & Social Justice', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Journalism & Media', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Education', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
    { division: 'Law & Constitutional Studies', categories: 1, senior: 1, midCareer: 1, young: 1, total: 3 },
  ],
  allocationNote: 'On the allocation chart, Senior is the Distinguished Fellows Award, Mid-career is the Excellence Award, and Young is the Rising Achievers Award.',
  divisionNote: 'Each of the 25 commemorative awards is presented once under each recognition division: 25 lifetime, 25 established, and 25 emerging contributions.',
  totalLabel: '25 disciplinary award categories × 3 recipient levels (Senior, Mid-career, Young) = 75 recipients',
  eligibilityIntro: 'Nominations are open to individuals from India and other countries. Nominees must provide credible evidence of significant contribution. Formal degrees need not be mandatory for suitable practice-based fields such as literature, journalism, and social service.',
  eligibilityRules: [
    { title: 'Who may be nominated', detail: 'Scientists, researchers, academicians, healthcare professionals, engineers, economists, architects, psychologists, sociologists, authors, journalists, social reformers, legal professionals, educators, and independent innovators.' },
  ],
  contributionRules: [
    { field: 'Scientific, medical, and engineering fields', detail: 'Original research, validated innovations, peer-reviewed scholarship, patents, clinical advances, or demonstrable technical impact.' },
    { field: 'Economics and public policy', detail: 'Economic scholarship, policy analysis, institutional reforms, or measurable development outcomes.' },
    { field: 'Literature and languages', detail: 'Original writing, translation, criticism, language preservation, or substantial literary scholarship.' },
    { field: 'Architecture and design', detail: 'Completed works, design innovation, sustainable construction, heritage conservation, or planning achievements.' },
    { field: 'Psychology and sociology', detail: 'Original research, evidence-based practice, behavioural scholarship, social interventions, or community impact.' },
    { field: 'Human rights and social justice', detail: 'Documented advocacy, protection of rights, social reform, humanitarian initiatives, or measurable community benefit.' },
    { field: 'Journalism and media', detail: 'Credible public-interest reporting, investigative work, editorial contributions, documentaries, or ethical media innovation.' },
    { field: 'Education and law', detail: 'Teaching innovation, educational research, legal scholarship, constitutional studies, access to justice, or legal reform.' },
  ],
  nominationDocuments: [
    'A completed nomination form',
    'A curriculum vitae or professional profile',
    'An achievement statement of up to 1,000 words',
    'Evidence of relevant qualification or experience',
    'Selected publications, projects, or documented outputs',
    'Professional references where required',
    'A declaration of authenticity and accuracy',
  ],
  evaluation: [
    { parameter: 'Originality and significance of contribution', marks: 30 },
    { parameter: 'Documented professional or societal impact', marks: 25 },
    { parameter: 'Quality and strength of supporting evidence', marks: 20 },
    { parameter: 'Leadership and sustained contribution', marks: 15 },
    { parameter: 'Ethics and professional integrity', marks: 10 },
  ],
  qualifyingScores: 'Recommended minimum qualifying scores: Distinguished Fellows 80, Excellence 75, and Rising Achievers 70.',
  selectionNote: 'Nominations are screened for eligibility, verified, and reviewed by independent assessors. The committee may request further evidence, reject an inaccurate submission, or withhold an award when the required standard is not met.',
  committee: [
    {
      name: 'Dr. Hemachandran Ravikumar',
      role: 'Chief Advisor',
      organisation: 'International Forum for Scientists and Mental Health Professionals (IFSMHP)',
    },
    {
      name: 'Lt. Dr. Yaseen Ismail Shaikh',
      role: 'Organising Committee Secretary',
      organisation: 'International Forum for Scientists and Mental Health Professionals (IFSMHP)',
      affiliation: "MCE's Abeda Inamdar Senior College (Autonomous), Azam Campus, Pune",
      tagline: 'Scientist | Researcher | Academician | NCC Officer | Mentor',
      photoKey: 'yaseen-shaikh',
      summary: [
        "Lt. Dr. Yaseen Ismail Shaikh is a distinguished academician, scientist and interdisciplinary researcher, and Assistant Professor in the Department of Chemistry at MCE's Abeda Inamdar Senior College (Autonomous), Azam Campus, Pune. He also serves as Associate NCC Officer with the Army Wing of the 59 Maharashtra Battalion NCC, Pune, and as In-charge Director of Physical Education at the institution.",
        'His research interests include nanomaterials, green and sustainable chemistry, bio-inspired nanoparticle synthesis, organic and heterocyclic chemistry, multicomponent reactions, computational chemistry, molecular docking, and biological applications of nanomaterials, including antimicrobial, environmental, veterinary and healthcare work.',
        'He holds a Ph.D. in Chemistry from Savitribai Phule Pune University (2018), with an M.Sc. and M.Phil. in Chemistry, a B.Ed. and an MBA. He qualified CSIR-NET in 2011, securing the 28th rank among 784 candidates. He has taught in higher education since 2010 and at Abeda Inamdar Senior College since July 2017.',
        'His scholarly record includes research publications, intellectual-property contributions, and the academic book Determination Potentiometric of Stability Constant Nicotinamide and Penicillamine (2024). Through teaching, research mentoring and NCC leadership, he works to connect scientific progress with education, sustainability and society.',
      ],
      highlights: [
        { label: 'Chemistry papers', value: '48' },
        { label: 'Papers beyond chemistry', value: '4' },
        { label: 'Intellectual-property contributions', value: '4' },
        { label: 'Conference abstracts', value: '37' },
      ],
      milestones: [
        {
          title: 'Republic Day Parade, New Delhi — January 2024',
          detail: 'Two NCC cadets under his mentorship were selected to participate in the Republic Day Parade in New Delhi.',
        },
        {
          title: "Prime Minister's Rally — January 2026",
          detail: "One NCC cadet was selected for the Republic Day-related national-level Prime Minister's Rally.",
        },
        {
          title: 'Youth Exchange Programme',
          detail: 'Two NCC cadets were selected for international Youth Exchange Programmes, in Mauritius and Bhutan.',
        },
      ],
      identifiers: [
        { label: 'ORCID 0000-0002-3760-548X', href: 'https://orcid.org/0000-0002-3760-548X' },
        { label: 'Scopus Author ID 37162213600' },
        { label: 'Web of Science AAN-4175-2021' },
      ],
    },
  ],
};
