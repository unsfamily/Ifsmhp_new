import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  UserPlus,
  Mail,
  ArrowRight,
  User,
  GraduationCap,
  CheckCircle2,
  FileCheck2,
  Briefcase,
  Send,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput, Checkbox, FileInput } from '../../components/common/Input';
import OtpCodeStep from '../../components/auth/OtpCodeStep';
import Badge from '../../components/common/Badge';
import logoImg from '../../assets/images/logo.png';
import { requestOtp } from '../../api/auth';
import { normalizeError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useOtpFlow } from '../../hooks/useOtpFlow';

const professionalTypes = [
  'Research Scholar / Scientist',
  'Psychiatrist',
  'Psychologist',
  'Counselor',
  'Therapist',
  'Social Worker',
  'Doctoral Candidate',
  'Academic Researcher',
  'Other Mental Health Professional',
];

// The address is asked for once: a one-time code is emailed to it and the
// account is not created until that code comes back, so a typo cannot slip
// through unnoticed the way it could when registration completed immediately.
const schema = z.object({
  fullName: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Enter a valid email address'),
  professionalType: z.string().min(1, 'Select your professional type'),
  institution: z.string().min(2, 'Institution / Organization is required'),
  credentials: z.string().min(10, 'Please briefly describe your credentials'),
  education: z.string().min(10, 'Please list your relevant education'),
  researchInterests: z.string().min(10, 'Please describe your research interests'),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const { refreshUser } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // The code step, its countdown, and its persistence across a refresh all live
  // in the shared flow. The account is created only when `submit` succeeds.
  const otp = useOtpFlow('REGISTER', {
    onVerified: async () => {
      // The applicant is signed in on verification, so the session is live for
      // the dashboard link on the success panel.
      await refreshUser().catch(() => undefined);
      setSubmitted(true);
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  /** Builds the registration payload the API expects from the current form. */
  const payloadFrom = (data: FormData) => ({
    purpose: 'REGISTER' as const,
    fullName: data.fullName,
    email: data.email,
    professionalType: data.professionalType,
    institution: data.institution,
    credentials: data.credentials,
    education: data.education,
    researchInterests: data.researchInterests,
    agreeTerms: data.agreeTerms,
  });

  const onSubmit = async (data: FormData) => {
    setErrorMsg(null);
    try {
      // Only enters the code step once the backend confirms a code was really
      // sent; a delivery failure throws and is surfaced below.
      otp.begin(await requestOtp(payloadFrom(data)));
    } catch (error) {
      setErrorMsg(normalizeError(error).message);
    }
  };

  const success = submitted;

  if (success) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-2xl border border-paper-border bg-paper-raised p-8 sm:p-10 shadow-lg text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
            <CheckCircle2 className="h-9 w-9 text-success-600" />
          </div>
          <h1 className="mt-6 font-display text-2xl font-semibold text-forum-900">
            Application Submitted Successfully
          </h1>
          <p className="mt-3 text-ink-muted leading-relaxed">
            Thank you for applying for IFSMHP membership. Our review team will
            carefully verify your credentials and get back to you within 3-5
            business days.
          </p>
          <div className="mt-6 text-left rounded-lg border border-forum-100 bg-forum-50/60 p-5">
            <h3 className="font-semibold text-forum-900 text-sm flex items-center gap-2">
              <FileCheck2 className="h-4.5 w-4.5 text-slateteal-500" />
              What happens next
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-ink-muted list-decimal list-inside">
              <li>Confirmation email sent to your inbox</li>
              <li>Credentials verified by our review committee</li>
              <li>Approval notification and unique Member ID issued</li>
              <li>Dashboard access activated with full member benefits</li>
            </ol>
          </div>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <Button as="link" to="/" size="lg" variant="outline">
              Return Home
            </Button>
            <Button as="link" to="/login" size="lg">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (otp.active) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-paper-border bg-paper-raised p-8 sm:p-10 shadow-lg">
          <OtpCodeStep
            email={otp.email}
            code={otp.code}
            onCodeChange={otp.setCode}
            onSubmit={otp.submit}
            onResend={otp.resend}
            onBack={otp.reset}
            backLabel="Back to the application"
            submitLabel="Verify and submit application"
            title="Verify your email"
            description="Enter the 6-digit code we sent to"
            status={otp.status}
            codeError={otp.codeError}
            error={otp.error}
            notice={otp.notice}
            verifying={otp.verifying}
            resending={otp.resending}
            seconds={otp.seconds}
            canResend={otp.canResend}
          />
          <p className="mt-6 text-center text-xs text-ink-subtle">
            Your account is created only once this code is confirmed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-paper via-forum-50 to-paper">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:py-14">
        <Link to="/" className="inline-flex items-center gap-2.5 mb-8">
          <img
            src={logoImg}
            alt="IFSMHP Logo"
            className="h-10 w-10 rounded-lg object-contain"
          />
          <div>
            <span className="block font-display text-lg font-semibold text-forum-900">IFSMHP</span>
            <span className="block text-[10px] uppercase tracking-wider text-ink-subtle">
              Membership Application
            </span>
          </div>
        </Link>

        <div className="grid gap-10 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <div className="sticky top-10 space-y-6">
              <div>
                <Badge variant="brass">
                  <UserPlus className="h-3 w-3 mr-1" />
                  Step 1 of 2
                </Badge>
                <h1 className="mt-4 font-display text-3xl font-semibold text-forum-900 leading-tight">
                  Apply for IFSMHP Membership
                </h1>
                <p className="mt-3 text-ink-muted leading-relaxed">
                  Join 277+ scientists and mental health professionals. Complete
                  the form to submit your application for review.
                </p>
              </div>
              <div className="rounded-xl border border-paper-border bg-paper-raised p-5 shadow-sm">
                <h3 className="font-semibold text-forum-900 text-sm flex items-center gap-2">
                  <Briefcase className="h-4.5 w-4.5 text-forum-700" />
                  Application Timeline
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-ink-muted">
                  {[
                    { label: 'Submit application & credentials', done: false },
                    { label: 'Review committee evaluation (3-5 days)', done: false },
                    { label: 'Receive Member ID & welcome', done: false },
                    { label: 'Full dashboard access activated', done: false },
                  ].map((item, i) => (
                    <li key={i} className="flex gap-3 items-start">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        i === 0 ? 'bg-forum-600 text-white' : 'bg-forum-100 text-forum-400'
                      }`}>
                        {i + 1}
                      </span>
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>
              <ul className="space-y-2 text-sm text-ink-muted">
                {[
                  'Unique IFSMHP Member ID',
                  'Project management & upload platform',
                  'Direct CRO document exchange',
                  'Publication & global recognition',
                ].map((b) => (
                  <li key={b} className="flex gap-2 items-center">
                    <CheckCircle2 className="h-4 w-4 text-slateteal-500 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-paper-border bg-paper-raised p-6 sm:p-8 lg:p-10 shadow-sm">
              {errorMsg && (
                <div className="mb-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-forum-700" />
                    Personal Information
                  </h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <TextInput
                      label="Full Name"
                      placeholder="Dr. Jane A. Smith"
                      required
                      error={errors.fullName?.message}
                      {...register('fullName')}
                    />
                    <div className="sm:col-span-2">
                      <SelectInput
                        label="Professional Type"
                        required
                        error={errors.professionalType?.message}
                        {...register('professionalType')}
                      >
                        <option value="">Select your role...</option>
                        {professionalTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </SelectInput>
                    </div>
                    <TextInput
                      label="Email Address"
                      type="email"
                      placeholder="jane@university.edu"
                      icon={<Mail className="h-4.5 w-4.5" />}
                      required
                      error={errors.email?.message}
                      hint="We'll send a 6-digit code here to verify your address."
                      {...register('email')}
                    />
                    <TextInput
                      label="Institution / Organization"
                      placeholder="University, Hospital, Institute..."
                      required
                      error={errors.institution?.message}
                      {...register('institution')}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-forum-700" />
                    Professional Background
                  </h2>
                  <div className="mt-5 grid gap-5">
                    <TextArea
                      label="Professional Credentials"
                      placeholder="Degrees, licenses, certifications, professional affiliations... (e.g. PhD Clinical Psychology, Licensed Psychologist #12345)"
                      rows={3}
                      required
                      error={errors.credentials?.message}
                      {...register('credentials')}
                    />
                    <TextArea
                      label="Education & Qualifications"
                      placeholder="List degrees, institutions, years. (e.g. PhD in Cognitive Neuroscience, Stanford, 2020; MA Clinical Psychology, Columbia, 2016)"
                      rows={3}
                      required
                      error={errors.education?.message}
                      {...register('education')}
                    />
                    <TextArea
                      label="Research Interests"
                      placeholder="What areas do you work in? (e.g. digital mental health interventions, treatment-resistant depression, psychedelic research, youth mental health policy)"
                      rows={3}
                      required
                      error={errors.researchInterests?.message}
                      {...register('researchInterests')}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-forum-700" />
                    Document Upload
                  </h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <FileInput
                      label="CV / Resume"
                      accept=".pdf,.doc,.docx"
                      hint="PDF, DOC, DOCX (max 10MB)"
                    />
                    <FileInput
                      label="Credentials / Certifications"
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      hint="Scanned degrees, licenses, certificates"
                    />
                  </div>
                </div>

                <div className="pt-2 rounded-lg border border-paper-border bg-paper p-5">
                  <Checkbox
                    label={
                      <>
                        I have read and agree to the{' '}
                        <a href="#" className="underline text-forum-700 font-medium">
                          Terms of Service
                        </a>{' '}
                        and{' '}
                        <a href="#" className="underline text-forum-700 font-medium">
                          Code of Ethics
                        </a>
                        .
                      </>
                    }
                    {...register('agreeTerms')}
                  />
                  {errors.agreeTerms && (
                    <p className="mt-2 text-xs text-danger-600 pl-6">{errors.agreeTerms.message}</p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-ink-subtle">
                    Already a member?{' '}
                    <Link to="/login" className="font-semibold text-forum-700 hover:text-forum-900">
                      Sign in instead
                    </Link>
                  </p>
                  <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={isSubmitting}>
                    <Send className="h-4.5 w-4.5" />
                    {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
                    {!isSubmitting && <ArrowRight className="h-4.5 w-4.5" />}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
