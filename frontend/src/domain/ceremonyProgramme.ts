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
  divisions: CeremonyDivision[];
  divisionNote?: string;
  totalLabel?: string;
  attribution?: CeremonyAttribution;
};

/** Filled in when the official commemorative list is ready to publish. */
export const ceremonyProgramme: CeremonyProgramme = {
  groups: [],
  divisions: [],
};
