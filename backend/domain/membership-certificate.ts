/**
 * Wording and field formatting for the membership certificate.
 *
 * The printed letterhead carries the Forum's name, address, and the
 * membership card, including the Chief Research Officer's signature.
 * This module supplies only the holder-specific lines: the certificate
 * prose, the designation, and the card details that replace the sample.
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

export const CERTIFICATE_AUTHORITY = 'International Forum for Scientists and Mental Health Professionals';

/**
 * Citation in the form used by international learned societies.
 * It records admission to IFSMHP. It does not confer a prize the Forum has not awarded.
 */
export function certificateParagraphs(person: CertificatePerson): string[] {
  const valid = validThroughLabel(person.approvedAt);
  return [
    'has been duly elected and admitted as a Member of the International Forum for Scientists and Mental Health Professionals (IFSMHP).',
    "In keeping with the practice of learned societies throughout the world, this membership is conferred in recognition of the holder's professional standing and distinguished contribution to scientific inquiry and the practice of mental health, together with an undertaking to observe standards of ethics, scientific integrity, collegiality, and evidence-informed care.",
    `IFSMHP is a global forum seated at Tambaram, Chennai, India, uniting research scholars, scientists, and mental health professionals in support of rigorous research and its benefit to humanity. Membership number ${person.memberId} remains valid through ${valid} while the holder continues in good standing.`,
    'Issued under the authority of the Chief Research Officer.',
  ];
}

export function certificateFacts(person: CertificatePerson): string[] {
  return [
    `Membership No.  ${person.memberId}`,
    `Date of admission  ${admissionLabel(person.approvedAt)}`,
    `Valid through  ${validThroughLabel(person.approvedAt)}`,
    `Branch  ${branchLabel(person.country)}`,
  ];
}

export function certificateFilename(memberId: string): string {
  const safe = certificateText(memberId).replace(/[^A-Za-z0-9.-]+/g, '-').replace(/^-+|-+$/g, '') || 'member';
  return `IFSMHP-Membership-Certificate-${safe}.pdf`;
}
