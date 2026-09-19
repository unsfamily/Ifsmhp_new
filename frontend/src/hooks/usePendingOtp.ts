import { useCallback, useState } from 'react';

export type OtpPurpose = 'REGISTER' | 'LOGIN';

export interface PendingOtp {
  email: string;
  purpose: OtpPurpose;
  /** ISO instant the code stops working. */
  expiresAt: string;
  /** ISO instant a resend becomes acceptable to the backend. */
  resendAfterAt: string;
  /**
   * Optional demo code hint. Only populated when the request was answered by
   * the frontend mock backend (no real email pipeline), so the UI can reveal
   * the expected code explicitly instead of looking like delivery failed.
   */
  demoCodeHint?: string;
}

const KEY = 'ifsmhp.pendingOtp';

/**
 * Remembers that a code is outstanding, so refreshing the page does not throw
 * the attempt away.
 *
 * Deliberately stores only the address and the two server timestamps. The
 * registration application itself is NOT kept here — it already lives
 * server-side on the OTP row, so no personal data is written to the browser and
 * the resend endpoint can recover it from the address alone.
 *
 * `sessionStorage` rather than `localStorage`: an outstanding code belongs to
 * this tab's attempt, not to the browser profile indefinitely.
 */
function read(): PendingOtp | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingOtp;
    if (!parsed?.email || !parsed?.purpose || !parsed?.expiresAt) return null;
    // A code that has already lapsed is not worth restoring a step for.
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    // Private mode, disabled storage, or corrupt JSON — behave as if nothing
    // was pending rather than breaking the page.
    return null;
  }
}

export function usePendingOtp(purpose: OtpPurpose) {
  const [pending, setPending] = useState<PendingOtp | null>(() => {
    const stored = read();
    return stored && stored.purpose === purpose ? stored : null;
  });

  const save = useCallback((next: PendingOtp) => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable: the flow still works, it just will not survive a
      // refresh. Not worth failing the request the user just made.
    }
    setPending(next);
  }, []);

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* nothing to clean up */
    }
    setPending(null);
  }, []);

  return { pending, save, clear };
}
