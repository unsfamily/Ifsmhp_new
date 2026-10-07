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
  Loader2,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/common/Button';
import { TextInput, Checkbox } from '../../components/common/Input';
import OtpCodeStep from '../../components/auth/OtpCodeStep';
import logoImg from '../../assets/images/logo.webp';
import { homePathFor, useAuth } from '../../context/AuthContext';
import { requestOtp, type SessionUser } from '../../api/auth';
import { normalizeError, type NormalizedApiError } from '../../api/client';
import { useOtpFlow } from '../../hooks/useOtpFlow';

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

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="IFSMHP home">
      <img
        src={logoImg}
        alt="IFSMHP Logo"
        className={compact ? 'h-9 w-9 rounded-lg object-contain p-0.5 shadow-md shadow-forum-900/20' : 'h-10 w-10 rounded-lg object-contain bg-white p-0.5 shadow-md shadow-forum-900/20'}
      />
      <div className={compact ? 'flex items-center gap-2' : ''}>
        <span className={compact ? 'font-display text-lg font-semibold text-forum-900' : 'block font-display text-lg font-semibold'}>
          IFSMHP
        </span>
        {!compact && (
          <span className="block text-[10px] uppercase tracking-wider text-forum-200/60">Member Portal</span>
        )}
      </div>
    </Link>
  );
}

function AuthAmbientBackground() {
  const lines = [
    [0.18, 0.28, 0.33, 0.5],
    [0.18, 0.28, 0.54, 0.74],
    [0.33, 0.5, 0.44, 0.38],
    [0.44, 0.38, 0.7, 0.31],
    [0.54, 0.74, 0.68, 0.64],
    [0.68, 0.64, 0.82, 0.72],
    [0.7, 0.31, 0.82, 0.18],
    [0.52, 0.18, 0.76, 0.12],
  ] as const;

  const nodes = [
    [0.18, 0.28, '0.7s'],
    [0.33, 0.5, '1.6s'],
    [0.44, 0.38, '2.1s'],
    [0.54, 0.74, '0.9s'],
    [0.68, 0.64, '1.3s'],
    [0.82, 0.72, '2.6s'],
    [0.82, 0.18, '1.9s'],
    [0.7, 0.31, '2.8s'],
    [0.52, 0.18, '1.1s'],
    [0.76, 0.12, '2.3s'],
  ] as const;

  return (
    <div className="auth-background" aria-hidden="true">
      <div className="auth-background__glow auth-background__glow--blue" />
      <div className="auth-background__glow auth-background__glow--gold" />
      <div className="auth-background__glow auth-background__glow--slate" />

      <svg className="auth-background__network" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="auth-network-stroke" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="rgba(17, 24, 39, 0.18)" />
            <stop offset="50%" stopColor="rgba(152, 170, 188, 0.28)" />
            <stop offset="100%" stopColor="rgba(17, 24, 39, 0.12)" />
          </linearGradient>
        </defs>

        {lines.map(([x1, y1, x2, y2], index) => (
          <line
            key={`line-${index}`}
            x1={x1 * 1200}
            y1={y1 * 900}
            x2={x2 * 1200}
            y2={y2 * 900}
            className="auth-network-line"
            style={{ animationDelay: `${index * 0.5}s` }}
          />
        ))}

        {nodes.map(([x, y, delay], index) => (
          <circle
            key={`node-${index}`}
            cx={x * 1200}
            cy={y * 900}
            r={index % 3 === 0 ? 7 : 5}
            className="auth-network-node"
            style={{ animationDelay: delay }}
          />
        ))}
      </svg>
    </div>
  );
}

export default function LoginPage() {
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const navigate = useNavigate();
  const location = useLocation();

  const routeAfterLogin = (user: SessionUser) => {
    const state = location.state as { from?: { pathname?: string } } | null;
    const from = state?.from?.pathname;
    const home = homePathFor(user.role);
    // Resume the pre-login page only when this role actually belongs there.
    // `from` is stamped by RequireAuth on any bounce — including the one that
    // follows a sign-out — so without this check an admin signing in after a
    // member signed out of /dashboard would land in the member portal.
    const target = from === home || from?.startsWith(`${home}/`) ? from : home;
    navigate(target, { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-forum-900 via-forum-700 to-forum-600 px-4 py-12">
      <AuthAmbientBackground />

      <div className="relative z-10 flex min-h-[calc(100vh-6rem)] items-center justify-center">
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
            <BrandMark />
          </div>
          <div className="relative">
            <h2 className="font-display text-2xl font-semibold leading-tight text-white">
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
              <BrandMark compact />
            </div>

            {mode === 'otp' ? (
              <OtpSignIn onSignedIn={routeAfterLogin} onUsePassword={() => setMode('password')} />
            ) : (
              <PasswordSignIn onSignedIn={routeAfterLogin} onUseOtp={() => setMode('otp')} />
            )}
          </div>
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const otp = useOtpFlow('LOGIN', {
    onVerified: async (user) => {
      await refreshUser().catch(() => undefined);
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
        demoHint={otp.demoHint}
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
