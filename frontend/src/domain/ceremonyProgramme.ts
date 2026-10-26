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
  level?: string;
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

export type CeremonyAttribution = {
  name: string;
  role: string;
  organisation: string;
};

export type CeremonyProgramme = {
  kicker?: string;
  title?: string;
  date?: string;
  groups: CeremonyAwardGroup[];
  medals?: CeremonyMedal[];
  divisions: CeremonyDivision[];
  allocation?: AwardAllocationRow[];
  divisionNote?: string;
  totalLabel?: string;
  attribution?: CeremonyAttribution;
};

export const CEREMONY_EVENT_DATE = '26 December 2026';
export const CEREMONY_VENUE = 'A.R. Shaikh Assembly Hall (Azam Campus)';
export const CEREMONY_ADDRESS = 'Azam Campus, 2390 K.B. Hidayatullah Road, New Modikhana, Camp, Pune, Maharashtra 411001';

export const ceremonyProgramme: CeremonyProgramme = {
  kicker: 'Official list',
  title: 'Official list of commemorative award names',
  date: CEREMONY_EVENT_DATE,
  groups: [
    {
      label: 'A',
      title: 'Scientific & technological sciences',
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
        { name: 'Dr. Har Gobind Khorana Award', discipline: 'New Biology' },
        { name: 'Sir C. V. Raman Award', discipline: 'Physical Sciences' },
        { name: 'Prof. Birbal Sahni Award', discipline: 'Plant Sciences' },
      ],
    },
    {
      label: 'B',
      title: 'Economics, literature & architecture',
      awards: [
        { name: 'Dr. Amartya Sen Award', discipline: 'Economics' },
        { name: 'Dr. Manmohan Singh Award', discipline: 'Economic Policy & Development' },
        { name: 'Rabindranath Tagore Award', discipline: 'Literature' },
        { name: 'Subramania Bharati Award', discipline: 'Languages & Literary Scholarship' },
        { name: 'Balkrishna Doshi Award', discipline: 'Architecture & Design' },
      ],
    },
    {
      label: 'C',
      title: 'Psychology, sociology & human rights',
      awards: [
        { name: 'Dr. Girindrasekhar Bose Award', discipline: 'Psychology' },
        { name: 'Prof. M. N. Srinivas Award', discipline: 'Sociology & Anthropology' },
        { name: 'Dr. B. R. Ambedkar Award', discipline: 'Human Rights & Social Justice' },
      ],
    },
    {
      label: 'D',
      title: 'Journalism, education & law',
      awards: [
        { name: 'Ganesh Shankar Vidyarthi Award', discipline: 'Journalism & Media' },
        { name: 'Dr. Sarvepalli Radhakrishnan Award', discipline: 'Education' },
        { name: 'Justice V. R. Krishna Iyer Award', discipline: 'Law & Constitutional Studies' },
      ],
    },
  ],
  medals: [
    { name: 'Dr. Vikram Sarabhai Gold Medal' },
    { name: 'Dr. Homi Jehangir Bhabha Gold Medal' },
    { name: 'Dr. A. P. J. Abdul Kalam Gold Medal' },
  ],
  divisions: [
    { level: 'Senior', title: 'Distinguished Lifetime Contribution Awards', detail: '25', description: 'Distinguished Fellows Awards' },
    { level: 'Mid-career', title: 'Distinguished Excellence Awards', detail: '25', description: 'Excellence Awards' },
    { level: 'Young', title: 'Emerging Excellence Awards', detail: '25', description: 'Rising Achievers Awards' },
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
  divisionNote: 'Each commemorative award is presented under three recognition divisions. The three special lifetime achievement gold medals are separate honours.',
  totalLabel: '25 disciplinary award categories × 3 recipient levels (Senior, Mid-career, Young) = 75 recipients',
  attribution: {
    name: 'Dr. Hemachandran Ravikumar',
    role: 'Chief Advisor',
    organisation: 'International Forum for Scientists and Mental Health Professionals (IFSMHP)',
  },
};
