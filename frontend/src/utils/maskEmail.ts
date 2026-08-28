/**
 * Partially hides an address for OTP confirmation screens — enough for the
 * reader to recognise their own inbox, without reprinting the whole address on
 * a shared or shoulder-surfed screen.
 */
export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${'•'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}
