import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  IdCard,
  ShieldCheck,
  Clock,
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/common/Button';
import { TextInput, Checkbox } from '../../components/common/Input';
import OtpCodeStep from '../../components/auth/OtpCodeStep';
import logoImg from '../../assets/images/logo.png';
import { useAuth } from '../../context/AuthContext';
import { requestOtp, type SessionUser } from '../../api/auth';
import { normalizeError, type NormalizedApiError } from '../../api/client';
import { useOtpFlow } from '../../hooks/useOtpFlow';
import { maskEmail } from '../../utils/maskEmail';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
});
type EmailForm = z.infer<typeof emailSchema>;

const passwordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  remember: z.boolean().optional(),
});
type PasswordForm = z.infer<typeof passwordSchema>;

export default function LoginPage() {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const navigate = useNavigate();
  const location = useLocation();

  const routeAfterLogin = (user: SessionUser) => {
    const state = location.state as { from?: { pathname?: string } } | null;
    const fallback = user.role === 'ADMIN' ? '/admin' : '/dashboard';
    navigate(state?.from?.pathname ?? fallback, { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-forum-900 via-forum-700 to-forum-600 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        <div className="hidden lg:flex flex-col justify-between bg-forum-900 p-10 text-white relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
          />
          <div className="relative">
            <Link to="/" className="flex items-center gap-2.5">
              <img
                src={logoImg}
                alt="IFSMHP Logo"
                className="h-10 w-10 rounded-lg object-contain bg-white p-0.5"
              />
              <div>
                <span className="block font-display text-lg font-semibold">IFSMHP</span>
                <span className="block text-[10px] uppercase tracking-wider text-forum-200/60">
                  Member Portal
                </span>
              </div>
            </Link>
          </div>
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold leading-tight">
              Welcome back to the global community of scientific excellence.
            </h2>
            <ul className="mt-8 space-y-3">
              {[
                'Access your member dashboard',
                'Manage projects and request support',
                'Exchange documents with the CRO',
                'Publish and share your research',
              ].map((f) => (
                <li key={f} className="flex gap-2.5 items-center text-forum-100/80">
                  <CheckCircle2 className="h-5 w-5 text-brass-100 shrink-0" />
                  <span className="text-sm">{f}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-forum-200/50">
            © {new Date().getFullYear()} International Forum of Scientists and Mental Health Professionals.
          </p>
        </div>

        <div className="bg-paper-raised p-8 sm:p-10 lg:p-12">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-forum-600 text-white">
                <span className="font-display text-sm font-bold">IF</span>
              </div>
              <span className="font-display text-lg font-semibold text-forum-900">IFSMHP</span>
            </Link>
          </div>

          {mode === 'otp' ? (
            <OtpSignIn onSignedIn={routeAfterLogin} onUsePassword={() => setMode('password')} />
          ) : (
            <PasswordSignIn onSignedIn={routeAfterLogin} onUseOtp={() => setMode('otp')} />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Member sign-in — emailed one-time code                                     */
/* -------------------------------------------------------------------------- */

function OtpSignIn({
  onSignedIn,
  onUsePassword,
}: {
  onSignedIn: (user: SessionUser) => void;
  onUsePassword: () => void;
}) {
  const { refreshUser } = useAuth();
  // Applicants verify successfully but have nowhere to go until an admin
  // approves them, so that outcome gets its own panel rather than a redirect.
  const [pendingApproval, setPendingApproval] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const otp = useOtpFlow('LOGIN', {
    onVerified: async (user) => {
      await refreshUser().catch(() => undefined);
      if (user.role === 'APPLICANT') {
        setPendingApproval(true);
        return;
      }
      onSignedIn(user);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const onSubmitEmail = async (data: EmailForm) => {
    setErrorMsg(null);
    try {
      // Enters the code step only once the backend confirms a real send.
      otp.begin(await requestOtp({ purpose: 'LOGIN', email: data.email }));
    } catch (error) {
      setErrorMsg(normalizeError(error).message);
    }
  };

  if (pendingApproval) {
    return (
      <div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brass-100">
          <Clock className="h-6 w-6 text-brass-700" />
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-forum-900">
          Your application is under review
        </h1>
        <p className="mt-2 text-sm text-ink-muted leading-relaxed">
          We verified <span className="font-medium text-ink">{maskEmail(otp.email)}</span>, but your
          IFSMHP membership is still being reviewed. Dashboard access opens as soon as the review
          committee approves your credentials and issues your Member ID.
        </p>
        <div className="mt-6 rounded-lg border border-paper-border bg-paper p-4">
          <p className="text-sm text-ink-muted">
            Reviews usually take 3-5 business days. We will email you as soon as there is news.
          </p>
        </div>
        <div className="mt-8">
          <Button as="link" to="/" size="lg" variant="outline" className="w-full">
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  if (otp.active) {
    return (
      <OtpCodeStep
        email={otp.email}
        code={otp.code}
        onCodeChange={otp.setCode}
        onSubmit={otp.submit}
        onResend={otp.resend}
        onBack={otp.reset}
        backLabel="Use a different email"
        submitLabel="Verify and sign in"
        title="Enter your code"
        description="We sent a 6-digit code to"
        status={otp.status}
        codeError={otp.codeError}
        error={otp.error}
        notice={otp.notice}
        verifying={otp.verifying}
        resending={otp.resending}
        seconds={otp.seconds}
        canResend={otp.canResend}
      />
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-forum-900">Sign in to your account</h1>
      <p className="mt-1 text-sm text-ink-muted">
        New member?{' '}
        <Link to="/register" className="font-medium text-forum-700 hover:text-forum-900 underline underline-offset-2">
          Create an account
        </Link>
      </p>

      {errorMsg && (
        <div className="mt-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmitEmail)} className="mt-6 space-y-5">
        <TextInput
          label="Email Address"
          type="email"
          placeholder="you@institution.edu"
          icon={<Mail className="h-4.5 w-4.5" />}
          error={errors.email?.message}
          hint="We'll email you a 6-digit code — no password needed."
          {...register('email')}
        />

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <ShieldCheck className="h-4.5 w-4.5" />}
          {isSubmitting ? 'Sending code...' : 'Email me a sign-in code'}
          {!isSubmitting && <ArrowRight className="h-4.5 w-4.5" />}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-paper-border">
        <div className="rounded-lg border border-brass-500/20 bg-brass-100/40 p-4 flex gap-3 items-start">
          <IdCard className="h-5 w-5 text-brass-700 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-brass-700">Chief Research Officer?</p>
            <p className="mt-0.5 text-brass-700/80">
              Administrator accounts sign in with a password.{' '}
              <button
                type="button"
                onClick={onUsePassword}
                className="font-medium text-brass-700 underline underline-offset-2 hover:text-brass-900"
              >
                Use password sign-in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Administrator sign-in — password                                           */
/* -------------------------------------------------------------------------- */

function PasswordSignIn({
  onSignedIn,
  onUseOtp,
}: {
  onSignedIn: (user: SessionUser) => void;
  onUseOtp: () => void;
}) {
  const { login } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: PasswordForm) => {
    setErrorMsg(null);
    try {
      onSignedIn(await login(data));
    } catch (error) {
      setErrorMsg((error as NormalizedApiError).message ?? 'Sign in failed. Try again.');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onUseOtp}
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to member sign-in
      </button>

      <h1 className="font-display text-2xl font-semibold text-forum-900">Administrator sign-in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Members sign in with an emailed code instead.
      </p>

      {errorMsg && (
        <div className="mt-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{errorMsg}</p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-5">
        <TextInput
          label="Email Address"
          type="email"
          placeholder="you@institution.edu"
          icon={<Mail className="h-4.5 w-4.5" />}
          error={errors.email?.message}
          {...register('email')}
        />
        <div>
          <div className="relative">
            <TextInput
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              icon={<Lock className="h-4.5 w-4.5" />}
              error={errors.password?.message}
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-8 text-ink-subtle hover:text-ink-muted transition-colors"
              aria-label={showPw ? 'Hide password' : 'Show password'}
            >
              {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <Link to="/forgot-password" className="text-xs font-medium text-forum-700 hover:text-forum-900">
              Forgot password?
            </Link>
          </div>
        </div>

        <Checkbox label="Remember me for 30 days" {...register('remember')} />

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          <LogIn className="h-4.5 w-4.5" />
          {isSubmitting ? 'Signing in...' : 'Sign In'}
          {!isSubmitting && <ArrowRight className="h-4.5 w-4.5" />}
        </Button>
      </form>
    </div>
  );
}
