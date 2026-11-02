export type OrgTreeTier = 'leadership' | 'executive' | 'divisional' | 'district' | 'institutional';

export type OrgTreeRole = {
  id: string;
  title: string;
  detail?: string;
  seats?: number;
  tier: OrgTreeTier;
  /** Named appointee when confirmed; omitted while the seat is proposed/open. */
  name?: string;
};

export type CommitteeDirectoryEntry = {
  id: string;
  name: string;
  role: string;
  chapter: string;
  status: 'confirmed' | 'proposed';
  searchText: string;
};

export const MAHARASHTRA_CHAPTER_TERM = '2026 – 2028';

export const MAHARASHTRA_CHAPTER_MOTTO = 'Science · Mental Health · Global Collaboration';

export const maharashtraLeadership: OrgTreeRole[] = [
  {
    id: 'cro',
    title: 'Chief Research Officer (CRO)',
    detail: 'International / Central Leadership',
    tier: 'leadership',
  },
  {
    id: 'chief-advisor',
    title: 'Chief Advisor',
    detail: 'Strategic & Scientific Guidance',
    tier: 'leadership',
    name: 'Dr. Hemachandran Ravikumar',
  },
  {
    id: 'state-general-secretary',
    title: 'Maharashtra State General Secretary',
    detail: 'State Administration & Coordination',
    tier: 'leadership',
  },
];

export const maharashtraExecutives: OrgTreeRole[] = [
  { id: 'joint-secretary', title: 'State Joint Secretary', seats: 2, tier: 'executive' },
  { id: 'research-secretary', title: 'State Research Secretary', tier: 'executive' },
  { id: 'membership-secretary', title: 'State Membership Secretary', tier: 'executive' },
  { id: 'programme-secretary', title: 'State Programme Secretary', tier: 'executive' },
  { id: 'academic-coordinator', title: 'State Academic Coordinator', tier: 'executive' },
  { id: 'mental-health-coordinator', title: 'State Mental Health Coordinator', tier: 'executive' },
  { id: 'scientific-coordinator', title: 'State Scientific Coordinator', tier: 'executive' },
  { id: 'communications-secretary', title: 'State Communications Secretary', tier: 'executive' },
  { id: 'finance-coordinator', title: 'State Finance Coordinator', tier: 'executive' },
  { id: 'women-youth-coordinator', title: 'Women & Youth Development Coordinator', tier: 'executive' },
];

export const maharashtraDivisions: OrgTreeRole[] = [
  { id: 'div-konkan', title: 'Konkan Divisional Coordinator', tier: 'divisional' },
  { id: 'div-pune', title: 'Pune Divisional Coordinator', tier: 'divisional' },
  { id: 'div-nashik', title: 'Nashik Divisional Coordinator', tier: 'divisional' },
  { id: 'div-sambhajinagar', title: 'Chhatrapati Sambhajinagar Divisional Coordinator', tier: 'divisional' },
  { id: 'div-amravati', title: 'Amravati Divisional Coordinator', tier: 'divisional' },
  { id: 'div-nagpur', title: 'Nagpur Divisional Coordinator', tier: 'divisional' },
];

export const maharashtraDistrictLayer: OrgTreeRole = {
  id: 'district-coordinators',
  title: 'District Coordinators / District Secretaries',
  detail: '36 Districts',
  seats: 36,
  tier: 'district',
};

export const maharashtraInstitutionalLayer: OrgTreeRole = {
  id: 'institutional',
  title: 'Institutional Coordinators / Members / Volunteers',
  detail: 'Universities · Colleges · Hospitals · Research Institutions',
  tier: 'institutional',
};

export const maharashtraAppointmentTotals = {
  stateExecutives: 12,
  divisionalCoordinators: 6,
  districtCoordinators: 36,
  total: 54,
} as const;

function seatLabels(role: OrgTreeRole): string[] {
  if (!role.seats || role.seats <= 1) return [role.title];
  if (role.tier === 'district') return [role.title];
  return Array.from({ length: role.seats }, (_, index) => `${role.title} (${index + 1})`);
}

function toDirectoryEntries(roles: OrgTreeRole[], chapter: string): CommitteeDirectoryEntry[] {
  return roles.flatMap((role) =>
    seatLabels(role).map((label, index) => {
      const name = role.name ?? '';
      const status: CommitteeDirectoryEntry['status'] = role.name ? 'confirmed' : 'proposed';
      const displayName = name || 'Appointment pending';
      return {
        id: `${role.id}-${index + 1}`,
        name: displayName,
        role: label,
        chapter,
        status,
        searchText: [displayName, label, role.detail, chapter, role.name ? 'listed confirmed' : 'proposed pending']
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      };
    }),
  );
}

const CHAPTER = 'IFSMHP Maharashtra State Chapter';

/** Named awards organising committee plus Maharashtra chapter seats for public lookup. */
export function buildCommitteeDirectory(
  organisingCommittee: Array<{ name: string; role: string; organisation?: string }> = [],
): CommitteeDirectoryEntry[] {
  const organising = organisingCommittee.map((member, index) => ({
    id: `organising-${index + 1}`,
    name: member.name,
    role: member.role,
    chapter: member.organisation || 'IFSMHP Awards Organising Committee',
    status: 'confirmed' as const,
    searchText: [member.name, member.role, member.organisation, 'listed confirmed organising committee']
      .filter(Boolean)
      .join(' ')
      .toLowerCase(),
  }));

  const chapterRoles = [
    ...toDirectoryEntries(maharashtraLeadership, CHAPTER),
    ...toDirectoryEntries(maharashtraExecutives, CHAPTER),
    ...toDirectoryEntries(maharashtraDivisions, CHAPTER),
    ...toDirectoryEntries([maharashtraDistrictLayer], CHAPTER),
  ];

  // Merge the same person across organising-committee and chapter seats.
  const byKey = new Map<string, CommitteeDirectoryEntry>();
  for (const entry of [...organising, ...chapterRoles]) {
    const key = entry.name === 'Appointment pending' ? entry.id : entry.name.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, entry);
      continue;
    }
    const roles = [...new Set(
      [...existing.role.split('; '), ...entry.role.split('; ')].map((part) => part.trim()).filter(Boolean),
    )];
    byKey.set(key, {
      ...existing,
      role: roles.join('; '),
      chapter: existing.status === 'confirmed' ? existing.chapter : entry.chapter,
      status: existing.status === 'confirmed' || entry.status === 'confirmed' ? 'confirmed' : 'proposed',
      searchText: `${existing.searchText} ${entry.role} ${entry.chapter} ${entry.name}`.toLowerCase(),
    });
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'confirmed' ? -1 : 1;
    return a.name.localeCompare(b.name) || a.role.localeCompare(b.role);
  });
}

export function filterCommitteeDirectory(entries: CommitteeDirectoryEntry[], query: string): CommitteeDirectoryEntry[] {
  const needle = query.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle) return entries;
  return entries.filter((entry) => entry.searchText.includes(needle) || entry.name.toLowerCase().includes(needle) || entry.role.toLowerCase().includes(needle));
}
