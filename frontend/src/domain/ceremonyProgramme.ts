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
  divisionNote?: string;
  totalLabel?: string;
  attribution?: CeremonyAttribution;
};

export const CEREMONY_EVENT_DATE = '26 December 2026';
export const CEREMONY_VENUE = 'A.R. Shaikh Assembly Hall (Azam Campus)';
export const CEREMONY_ADDRESS = 'Azam Campus, 2390 K.B. Hidayatullah Road, New Modikhana, Camp, Pune, Maharashtra 411001';

export const ceremonyProgramme: CeremonyProgramme = {
  kicker: 'Official list',
  title: 'Commemorative awards',
  date: CEREMONY_EVENT_DATE,
  groups: [
    {
      label: 'A',
      title: 'Scientific and technological sciences',
      awards: [
        { name: 'Dr. M. S. Swaminathan Award', discipline: 'Agricultural and Forestry Sciences' },
        { name: 'Dr. Salim Ali Award', discipline: 'Animal, Veterinary and Fishery Sciences' },
        { name: 'Prof. N. K. Bose Award', discipline: 'Anthropological and Behavioural Sciences' },
        { name: 'Acharya P. C. Ray Award', discipline: 'Chemical Sciences' },
        { name: 'Dr. D. N. Wadia Award', discipline: 'Earth System Sciences' },
        { name: 'Sir M. Visvesvaraya Award', discipline: 'Engineering Sciences' },
        { name: 'Prof. Madhav Gadgil Award', discipline: 'Environmental Sciences' },
        { name: 'Dr. Raj Reddy Award', discipline: 'Information and Communication Science and Technology' },
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
      title: 'Economics, literature and architecture',
      awards: [
        { name: 'Dr. Amartya Sen Award', discipline: 'Economics' },
        { name: 'Dr. Manmohan Singh Award', discipline: 'Economic Policy and Development' },
        { name: 'Rabindranath Tagore Award', discipline: 'Literature' },
        { name: 'Subramania Bharati Award', discipline: 'Languages and Literary Scholarship' },
        { name: 'Balkrishna Doshi Award', discipline: 'Architecture and Design' },
      ],
    },
    {
      label: 'C',
      title: 'Psychology, sociology and human rights',
      awards: [
        { name: 'Dr. Girindrasekhar Bose Award', discipline: 'Psychology' },
        { name: 'Prof. M. N. Srinivas Award', discipline: 'Sociology and Anthropology' },
        { name: 'Dr. B. R. Ambedkar Award', discipline: 'Human Rights and Social Justice' },
      ],
    },
    {
      label: 'D',
      title: 'Journalism, education and law',
      awards: [
        { name: 'Ganesh Shankar Vidyarthi Award', discipline: 'Journalism and Media' },
        { name: 'Dr. Sarvepalli Radhakrishnan Award', discipline: 'Education' },
        { name: 'Justice V. R. Krishna Iyer Award', discipline: 'Law and Constitutional Studies' },
      ],
    },
  ],
  medals: [
    { name: 'Dr. Vikram Sarabhai Gold Medal' },
    { name: 'Dr. Homi Jehangir Bhabha Gold Medal' },
    { name: 'Dr. A. P. J. Abdul Kalam Gold Medal' },
  ],
  divisions: [
    { title: 'Distinguished Fellows Awards', detail: '25', description: 'Lifetime contribution' },
    { title: 'Excellence Awards', detail: '25', description: 'Established contribution' },
    { title: 'Rising Achievers Awards', detail: '25', description: 'Emerging contribution' },
  ],
  divisionNote: 'Each commemorative award is presented under three recognition divisions. The three special lifetime achievement gold medals are separate honours.',
  totalLabel: '75 disciplinary awards across 25 disciplines, plus 3 special gold medals',
  attribution: {
    name: 'Dr. Hemachandran Ravikumar',
    role: 'Chief Advisor',
    organisation: 'International Forum for Scientists and Mental Health Professionals (IFSMHP)',
  },
};
