import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LogIn,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  IdCard,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/common/Button';
import { TextInput, Checkbox } from '../../components/common/Input';
import logoImg from '../../assets/images/logo.png';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (_data: FormData) => {
    return new Promise((resolve) => {
      setErrorMsg(null);
      setTimeout(() => {
        resolve(true);
        window.location.href = '/dashboard';
      }, 1200);
    });
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

          <h1 className="font-display text-2xl font-semibold text-forum-900">
            Sign in to your account
          </h1>
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

          <div className="mt-8 pt-6 border-t border-paper-border">
            <div className="rounded-lg border border-brass-500/20 bg-brass-100/40 p-4 flex gap-3 items-start">
              <IdCard className="h-5 w-5 text-brass-700 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-brass-700">Chief Research Officer?</p>
                <p className="mt-0.5 text-brass-700/80">
                  Sign in above — admin role is assigned automatically based on your credentials.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
