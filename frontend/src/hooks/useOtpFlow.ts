import { useCallback, useEffect, useRef, useState } from 'react';
import { resendOtp, verifyOtp, type OtpRequestResult, type SessionUser } from '../api/auth';
import { normalizeError } from '../api/client';
import { usePendingOtp, type OtpPurpose } from './usePendingOtp';
import { useResendCountdown } from './useResendCountdown';

/**
 * Which blocking condition the flow is in, as reported by the backend. Kept as
 * a discrete state rather than inferred from message text so the UI can offer
 * the right recovery — a resend for an expired code, a restart for an
 * exhausted one.
 */
export type OtpStatus = 'idle' | 'expired' | 'attempt-limit' | 'resend-limit';

interface Options {
  /** Runs after a code verifies. Receives the now-signed-in user. */
  onVerified: (user: SessionUser) => void | Promise<void>;
}

/**
 * Drives the "enter your code" step for both registration and login.
 *
 * Shared because the two pages had identical defects: a countdown that could
 * not survive a refresh, and a resend that rebuilt a request the page no longer
 * had. Fixing one and not the other would leave them inconsistent.
 */
export function useOtpFlow(purpose: OtpPurpose, { onVerified }: Options) {
  const { pending, save, clear } = usePendingOtp(purpose);
  const { seconds, startAt, canResend } = useResendCountdown();

  const [active, setActive] = useState(Boolean(pending));
  const [email, setEmail] = useState(pending?.email ?? '');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<OtpStatus>('idle');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | undefined>(pending?.demoCodeHint);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Restore the countdown from the stored deadline after a refresh, so the
  // button reflects the cooldown the server is really enforcing.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !pending) return;
    restored.current = true;
    startAt(pending.resendAfterAt);
    setNotice('We already sent a code to your email. Enter it below.');
    setDemoHint(pending.demoCodeHint);
  }, [pending, startAt]);

  /** Maps a failure onto the specific state the UI should render. */
  const applyFailure = useCallback(
    (raw: unknown) => {
      const details = normalizeError(raw);
      setNotice(null);

      switch (details.reason) {
        case 'expired':
          setStatus('expired');
          setCodeError(null);
          return;
        case 'attempt-limit':
          setStatus('attempt-limit');
          setCodeError(null);
          return;
        case 'resend-limit':
          setStatus('resend-limit');
          setCodeError(null);
          return;
        case 'cooldown':
          // Re-sync to the server's real deadline. Without this the visible
          // timer and the refusal message disagree, which is what made the
          // countdown look invented.
          if (typeof details.meta?.resendAfterAt === 'string') {
            startAt(details.meta.resendAfterAt);
          } else if (typeof details.meta?.retryAfterSeconds === 'number') {
            startAt(Date.now() + details.meta.retryAfterSeconds * 1000);
          }
          setError(details.message);
          return;
        case 'delivery-failed':
          setError(details.message);
          return;
        default:
          setCodeError(details.message);
      }
    },
    [startAt],
  );

  /** Enters the code step after a code has actually been sent. */
  const begin = useCallback(
    (result: OtpRequestResult) => {
      save({
        email: result.email,
        purpose,
        expiresAt: result.expiresAt,
        resendAfterAt: result.resendAfterAt,
        demoCodeHint: result.demoCodeHint,
      });
      setEmail(result.email);
      startAt(result.resendAfterAt);
      setActive(true);
      setCode('');
      setStatus('idle');
      setCodeError(null);
      setError(null);
      setDemoHint(result.demoCodeHint);
      setNotice(
        result.demoCodeHint
          ? `A code was generated. Since no email service is connected, use this demo code instead: ${result.demoCodeHint}.`
          : 'We sent a 6-digit code to your email.',
      );
    },
    [purpose, save, startAt],
  );

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== 6 || verifying) return;
      setVerifying(true);
      setCodeError(null);
      setNotice(null);
      try {
        const user = await verifyOtp({ purpose, email, code: value });
        clear();
        await onVerified(user);
      } catch (failure) {
        applyFailure(failure);
        setCode('');
      } finally {
        setVerifying(false);
      }
    },
    [applyFailure, clear, email, onVerified, purpose, verifying],
  );

  const resend = useCallback(async () => {
    setResending(true);
    setCodeError(null);
    setError(null);
    try {
      const result = await resendOtp({ purpose, email });
      save({
        email: result.email,
        purpose,
        expiresAt: result.expiresAt,
        resendAfterAt: result.resendAfterAt,
        demoCodeHint: result.demoCodeHint,
      });
      // A successful send always restarts the cooldown.
      startAt(result.resendAfterAt);
      setStatus('idle');
      setCode('');
      setDemoHint(result.demoCodeHint);
      setNotice(
        result.demoCodeHint
          ? `A new demo code was generated. Use ${result.demoCodeHint} to continue.`
          : 'A new code is on its way.',
      );
    } catch (failure) {
      applyFailure(failure);
    } finally {
      setResending(false);
    }
  }, [applyFailure, email, purpose, save, startAt]);

  /** Abandons the attempt and returns to the previous step. */
  const reset = useCallback(() => {
    clear();
    setActive(false);
    setCode('');
    setStatus('idle');
    setCodeError(null);
    setError(null);
    setNotice(null);
    setDemoHint(undefined);
    startAt(null);
  }, [clear, startAt]);

  return {
    active,
    email,
    code,
    setCode,
    status,
    codeError,
    error,
    setError,
    notice,
    demoHint,
    verifying,
    resending,
    seconds,
    canResend,
    begin,
    submit,
    resend,
    reset,
  };
}
