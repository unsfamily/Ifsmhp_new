import { useCallback, useEffect, useState } from 'react';

function remainingSeconds(deadline: number | null): number {
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}

/**
 * Counts down to the instant the backend will accept a resend.
 *
 * Two deliberate choices:
 *
 * 1. It tracks an absolute deadline and recomputes the remaining time from the
 *    clock on every tick, rather than decrementing a counter. A counter drifts,
 *    stalls while the tab is backgrounded, and cannot be restored after a page
 *    refresh — which is how the number on screen came to disagree with the
 *    cooldown the server was actually enforcing.
 *
 * 2. The interval is owned by an effect keyed on the deadline, so the ticking is
 *    derived from state rather than started imperatively. An interval created
 *    inside some other one-shot effect gets cleared by React's remount in
 *    StrictMode and is never recreated, which left the restored countdown
 *    frozen at its initial value and the resend button disabled forever.
 *
 * The backend remains the authority; this only decides when the button is offered.
 */
export function useResendCountdown() {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!deadline) {
      setSeconds(0);
      return;
    }

    setSeconds(remainingSeconds(deadline));
    const id = setInterval(() => {
      const left = remainingSeconds(deadline);
      setSeconds(left);
      if (left === 0) clearInterval(id);
    }, 500);

    return () => clearInterval(id);
  }, [deadline]);

  /** Accepts the absolute instant the cooldown ends (ISO string, Date, or ms). */
  const startAt = useCallback((until: string | number | Date | null) => {
    setDeadline(until ? new Date(until).getTime() : null);
  }, []);

  /** Convenience for a duration the server expressed in seconds. */
  const start = useCallback(
    (fromSeconds: number) => startAt(Date.now() + Math.max(0, fromSeconds) * 1000),
    [startAt],
  );

  return { seconds, start, startAt, canResend: seconds === 0 };
}
