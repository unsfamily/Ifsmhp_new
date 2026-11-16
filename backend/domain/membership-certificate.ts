/**
 * Wording and field formatting for the membership certificate.
 *
 * The letterhead already carries the Forum's name, address, and the Chief
 * Research Officer's signature. This module supplies only the holder-specific
 * lines: the certificate prose, the designation, and the card details.
 */

export interface CertificatePerson {
  fullName: string;
  professionalTitle: string | null;
  professionalType: string;
  institution: string;
  country: string | null;
  memberId: string;
  approvedAt: Date;
  issuedAt: Date;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** Latin text the certificate fonts can draw. Diacritics fold; other scripts are dropped. */
export function certificateText(value: string): string {
  const folded = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  return folded.replace(/[^\x20-\x7E]/g, '').replace(/\s+/g, ' ').trim();
}

export function designationLine(person: Pick<CertificatePerson, 'professionalTitle' | 'professionalType' | 'institution'>): string {
  const title = certificateText(person.professionalTitle || person.professionalType);
  const institution = certificateText(person.institution);
  if (title && institution && title.toLowerCase() !== institution.toLowerCase()) return `${title}, ${institution}`;
  return title || institution || 'Member';
}

export function holderName(fullName: string): string {
  return certificateText(fullName) || 'Member';
}

const HONORIFICS = new Set(['dr', 'prof', 'mr', 'mrs', 'ms', 'miss', 'shri', 'smt']);

/** Two initials for a card that has no portrait yet. A leading honorific is not used. */
export function cardInitials(fullName: string): string {
  const words = holderName(fullName).split(' ').filter((word) => {
    const bare = word.replace(/[^A-Za-z]/g, '').toLowerCase();
    return Boolean(bare) && !HONORIFICS.has(bare);
  });
  const letters = words.slice(0, 2).map((word) => word.match(/[A-Za-z]/)?.[0] ?? '');
  return (letters.join('') || 'M').toUpperCase();
}

function dated(date: Date): { day: number; month: string; year: number } {
  return { day: date.getUTCDate(), month: MONTHS[date.getUTCMonth()] ?? 'January', year: date.getUTCFullYear() };
}

export function admissionLabel(approvedAt: Date): string {
  const { day, month, year } = dated(approvedAt);
  return `${day} ${month} ${year}`;
}

/** Membership runs for twelve months from admission. The card prints the expiry month, as on the letterhead. */
export function validThroughLabel(approvedAt: Date): string {
  const expiry = new Date(Date.UTC(approvedAt.getUTCFullYear() + 1, approvedAt.getUTCMonth(), 1));
  const { month, year } = dated(expiry);
  return `${month} ${year}`;
}

export function branchLabel(country: string | null): string {
  return certificateText(country ?? '') || 'International';
}

export const CERTIFICATE_TITLE = 'Certificate of Membership';

/**
 * Formal admission text. It recognises professional standing without inventing
 * a prize the Forum has not conferred.
 */
export function certificateParagraphs(person: CertificatePerson): string[] {
  const valid = validThroughLabel(person.approvedAt);
  return [
    'has been duly admitted as a Member of the International Forum for Scientists and Mental Health Professionals.',
    "The Forum confers this membership in recognition of the holder's professional standing and contribution to scientific inquiry and mental health practice, and in witness of their undertaking to observe the Forum's standards of ethics, collegiality, and evidence-informed care.",
    `The membership card below identifies the holder by photograph, name, and membership number. It remains valid through ${valid} while membership continues in good standing, and it is issued under the authority of the Chief Research Officer.`,
  ];
}

export function certificateFacts(person: CertificatePerson): string[] {
  return [
    `Membership number  ${person.memberId}`,
    `Date of admission  ${admissionLabel(person.approvedAt)}`,
    `Valid through  ${validThroughLabel(person.approvedAt)}`,
    `Branch  ${branchLabel(person.country)}`,
  ];
}

export function certificateFilename(memberId: string): string {
  const safe = certificateText(memberId).replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'member';
  return `IFSMHP-Membership-Certificate-${safe}.pdf`;
}
