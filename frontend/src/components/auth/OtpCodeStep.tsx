import { ArrowLeft, ArrowRight, AlertCircle, Clock, Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import Button from '../common/Button';
import OtpInput from '../common/OtpInput';
import { maskEmail } from '../../utils/maskEmail';
import type { OtpStatus } from '../../hooks/useOtpFlow';

interface Props {
  email: string;
  code: string;
  onCodeChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onResend: () => void;
  onBack: () => void;
  backLabel: string;
  submitLabel: string;
  title: string;
  description: string;
  status: OtpStatus;
  codeError: string | null;
  error: string | null;
  notice: string | null;
  verifying: boolean;
  resending: boolean;
  seconds: number;
  canResend: boolean;
}

/**
 * The "enter your code" step, shared by registration and login.
 *
 * Every state below is driven by a real backend response — there are no
 * hard-coded codes, durations, or simulated outcomes. `status` distinguishes an
 * expired code (resend and continue) from an exhausted one (start over), so the
 * user is offered the recovery that will actually work.
 */
export default function OtpCodeStep({
  email,
  code,
  onCodeChange,
  onSubmit,
  onResend,
  onBack,
  backLabel,
  submitLabel,
  title,
  description,
  status,
  codeError,
  error,
  notice,
  verifying,
  resending,
  seconds,
  canResend,
}: Props) {
  // Once the attempt is spent, a new code cannot rescue it — the user has to
  // begin again, so the code boxes and resend are withdrawn.
  const exhausted = status === 'attempt-limit' || status === 'resend-limit';

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <h1 className="font-display text-2xl font-semibold text-forum-900">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">
        {description} <span className="font-medium text-ink">{maskEmail(email)}</span>.
      </p>

      {notice && status === 'idle' && !codeError && !error && (
        <div className="mt-6 rounded-lg border border-forum-600/20 bg-forum-100/50 p-4 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-forum-700 shrink-0 mt-0.5" />
          <p className="text-sm text-forum-900">{notice}</p>
        </div>
      )}

      {status === 'expired' && (
        <div className="mt-6 rounded-lg border border-brass-500/30 bg-brass-100/50 p-4 flex items-start gap-3">
          <Clock className="h-5 w-5 text-brass-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-brass-700">That code has expired</p>
            <p className="mt-0.5 text-brass-700/80">Request a new one to carry on.</p>
          </div>
        </div>
      )}

      {status === 'attempt-limit' && (
        <div className="mt-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <ShieldX className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-danger-600">Too many incorrect attempts</p>
            <p className="mt-0.5 text-danger-600/80">
              For your security this code has been cancelled. Start again to receive a new one.
            </p>
          </div>
        </div>
      )}

      {status === 'resend-limit' && (
        <div className="mt-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <ShieldX className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-danger-600">Too many codes requested</p>
            <p className="mt-0.5 text-danger-600/80">
              Please wait a few minutes, then start again.
            </p>
          </div>
        </div>
      )}

      {/* Delivery failure and cooldown refusals land here. */}
      {error && (
        <div className="mt-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {exhausted ? (
        <div className="mt-6">
          <Button type="button" size="lg" className="w-full" onClick={onBack}>
            Start again
            <ArrowRight className="h-4.5 w-4.5" />
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <OtpInput
            value={code}
            onChange={onCodeChange}
            onComplete={onSubmit}
            disabled={verifying}
            error={codeError ?? undefined}
            autoFocus
          />

          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={code.length !== 6 || verifying}
            onClick={() => onSubmit(code)}
          >
            {verifying ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ShieldCheck className="h-4.5 w-4.5" />}
            {verifying ? 'Verifying...' : submitLabel}
            {!verifying && <ArrowRight className="h-4.5 w-4.5" />}
          </Button>

          <div className="text-center text-sm text-ink-muted">
            {canResend ? (
              <button
                type="button"
                onClick={onResend}
                disabled={resending}
                className="font-medium text-forum-700 hover:text-forum-900 underline underline-offset-2 disabled:opacity-60"
              >
                {resending ? 'Sending...' : 'Send a new code'}
              </button>
            ) : (
              <span>
                You can request a new code in <span className="font-medium text-ink">{seconds}s</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
