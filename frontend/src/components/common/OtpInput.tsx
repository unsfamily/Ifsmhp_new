import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the last digit lands, so the caller can submit immediately. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string;
  label?: string;
  autoFocus?: boolean;
}

/**
 * Six single-character boxes backed by one string value.
 *
 * The boxes are real inputs rather than a styled single field so that password
 * managers and mobile keyboards behave, and so each digit is individually
 * focusable. Paste is handled explicitly because pasting a 6-digit code into
 * the first box is how most people use these.
 */
export default function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  error,
  label = 'Verification code',
  autoFocus = false,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const setDigit = (index: number, digit: string) => {
    const chars = value.split('');
    chars[index] = digit;
    // Trim trailing holes so `value.length` stays a truthful "how many entered".
    const next = chars.join('').replace(/\s/g, '').slice(0, length);
    commit(next);
    if (digit && index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) {
        setDigit(index, '');
        return;
      }
      // Already empty: step back and clear the previous box.
      if (index > 0) {
        refs.current[index - 1]?.focus();
        const chars = value.split('');
        chars[index - 1] = '';
        commit(chars.join('').slice(0, length));
      }
      return;
    }
    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    commit(pasted);
    refs.current[Math.min(pasted.length, length - 1)]?.focus();
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <div className="flex gap-2" role="group" aria-label={label}>
        {digits.map((digit, index) => (
          <input
            // Fixed-length control with no reordering, so the index is a stable key.
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            disabled={disabled}
            value={digit}
            aria-label={`Digit ${index + 1} of ${length}`}
            aria-invalid={Boolean(error)}
            onChange={(e) => {
              const next = e.target.value.replace(/\D/g, '').slice(-1);
              setDigit(index, next);
            }}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste}
            onFocus={(e) => e.target.select()}
            className={`h-12 w-full min-w-0 rounded-md border text-center font-display text-lg font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper disabled:bg-paper disabled:text-ink-subtle ${
              error
                ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
                : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
            }`}
          />
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}
