import { useEffect, useRef, useState } from 'react';
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
  Upload,
  FileText,
  Eye,
  Download,
  Trash2,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput, Checkbox } from '../../components/common/Input';
import OtpCodeStep from '../../components/auth/OtpCodeStep';
import Badge from '../../components/common/Badge';
import logoImg from '../../assets/images/logo.png';
import {
  removeRegistrationDocument,
  requestOtp,
  uploadRegistrationDocument,
  type RegistrationDocumentKind,
  type RegistrationDocumentUpload,
} from '../../api/auth';
import { normalizeError } from '../../api/client';
import { formatBytes } from '../../utils/formatBytes';
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
type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'removing' | 'failed';

type UploadState = {
  status: UploadStatus;
  file: File | null;
  uploaded: RegistrationDocumentUpload | null;
  previewUrl: string | null;
  error: string | null;
};

const documentSlots: Array<{
  kind: RegistrationDocumentKind;
  label: string;
  accept: string;
  hint: string;
}> = [
  { kind: 'CV', label: 'CV / Resume', accept: '.pdf,.doc,.docx', hint: 'PDF, DOC, DOCX (max 10MB)' },
  {
    kind: 'CREDENTIAL',
    label: 'Credentials / Certifications',
    accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
    hint: 'Scanned degrees, licenses, certificates (max 10MB)',
  },
];

const initialUploadState = (): Record<RegistrationDocumentKind, UploadState> => ({
  CV: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
  CREDENTIAL: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
});

const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']);
const previewMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

function fileExtension(fileName: string) {
  return fileName.split('.').pop()?.toLowerCase() ?? '';
}

function readableType(mimeType: string, fileName: string) {
  const ext = fileExtension(fileName).toUpperCase();
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/msword') return 'DOC';
  if (mimeType.includes('wordprocessingml')) return 'DOCX';
  if (mimeType === 'image/jpeg') return 'JPG';
  if (mimeType === 'image/png') return 'PNG';
  return ext || mimeType;
}

function clientFileError(file: File) {
  if (file.size <= 0) return 'Choose a non-empty file.';
  if (file.size > 10 * 1024 * 1024) return 'Upload a file under 10 MB.';
  if (!allowedExtensions.has(fileExtension(file.name))) return 'Upload a PDF, DOC, DOCX, JPG, or PNG file.';
  return null;
}

function makePreviewUrl(file: File, mimeType: string) {
  if (!previewMimeTypes.has(mimeType) && !previewMimeTypes.has(file.type)) return null;
  return URL.createObjectURL(file);
}

export default function RegisterPage() {
  const { refreshUser } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [documentUploads, setDocumentUploads] = useState(initialUploadState);
  const documentUploadsRef = useRef(documentUploads);

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

  useEffect(() => {
    documentUploadsRef.current = documentUploads;
  }, [documentUploads]);

  useEffect(() => {
    return () => {
      Object.values(documentUploadsRef.current).forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const documentClaims = documentSlots
    .map((slot) => {
      const uploaded = documentUploads[slot.kind].uploaded;
      return uploaded ? { kind: slot.kind, fileId: uploaded.id, claimToken: uploaded.claimToken } : null;
    })
    .filter(Boolean) as Array<{ kind: RegistrationDocumentKind; fileId: string; claimToken: string }>;

  const documentsReady = documentSlots.every((slot) => documentUploads[slot.kind].status === 'uploaded' && documentUploads[slot.kind].uploaded);
  const documentsBusy = documentSlots.some((slot) => ['uploading', 'removing'].includes(documentUploads[slot.kind].status));
  const documentsFailed = documentSlots.some((slot) => documentUploads[slot.kind].status === 'failed');

  const replacePreview = (kind: RegistrationDocumentKind, nextUrl: string | null) => {
    const previous = documentUploads[kind].previewUrl;
    if (previous) URL.revokeObjectURL(previous);
    return nextUrl;
  };

  const handleDocumentSelected = async (kind: RegistrationDocumentKind, file: File | null) => {
    if (!file) return;
    setErrorMsg(null);

    const previous = documentUploads[kind];
    const localError = clientFileError(file);
    if (localError) {
      setDocumentUploads((current) => ({
        ...current,
        [kind]: {
          status: 'failed',
          file,
          uploaded: null,
          previewUrl: replacePreview(kind, null),
          error: localError,
        },
      }));
      return;
    }

    setDocumentUploads((current) => ({
      ...current,
      [kind]: {
        status: 'uploading',
        file,
        uploaded: null,
        previewUrl: replacePreview(kind, null),
        error: null,
      },
    }));

    try {
      const uploaded = await uploadRegistrationDocument(file);
      const previewUrl = makePreviewUrl(file, uploaded.mimeType);
      setDocumentUploads((current) => ({
        ...current,
        [kind]: {
          status: 'uploaded',
          file,
          uploaded,
          previewUrl,
          error: null,
        },
      }));
      if (previous.uploaded) {
        await removeRegistrationDocument({ id: previous.uploaded.id, claimToken: previous.uploaded.claimToken }).catch(() => undefined);
      }
    } catch (error) {
      const normalized = normalizeError(error);
      setDocumentUploads((current) => ({
        ...current,
        [kind]: {
          status: 'failed',
          file,
          uploaded: null,
          previewUrl: null,
          error: normalized.fieldErrors.file ?? normalized.message,
        },
      }));
    }
  };

  const removeDocument = async (kind: RegistrationDocumentKind) => {
    const current = documentUploads[kind];
    if (!current.uploaded) {
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      setDocumentUploads((all) => ({
        ...all,
        [kind]: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
      }));
      return;
    }

    setDocumentUploads((all) => ({
      ...all,
      [kind]: { ...all[kind], status: 'removing', error: null },
    }));
    try {
      await removeRegistrationDocument({ id: current.uploaded.id, claimToken: current.uploaded.claimToken });
      if (current.previewUrl) URL.revokeObjectURL(current.previewUrl);
      setDocumentUploads((all) => ({
        ...all,
        [kind]: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
      }));
    } catch (error) {
      setDocumentUploads((all) => ({
        ...all,
        [kind]: { ...all[kind], status: 'uploaded', error: normalizeError(error).message },
      }));
    }
  };

  const downloadLocalDocument = (state: UploadState) => {
    if (!state.file) return;
    const url = URL.createObjectURL(state.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = state.uploaded?.name ?? state.file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

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
    documents: documentClaims,
    agreeTerms: data.agreeTerms,
  });

  const onSubmit = async (data: FormData) => {
    setErrorMsg(null);
    if (!documentsReady || documentClaims.length !== documentSlots.length) {
      setErrorMsg('Upload both required documents before submitting your application.');
      setDocumentUploads((current) => ({
        CV: current.CV.uploaded ? current.CV : { ...current.CV, error: 'Upload your CV / Resume.' },
        CREDENTIAL: current.CREDENTIAL.uploaded
          ? current.CREDENTIAL
          : { ...current.CREDENTIAL, error: 'Upload your Credentials / Certifications.' },
      }));
      return;
    }
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
            demoHint={otp.demoHint}
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
                    {documentSlots.map((slot) => {
                      const state = documentUploads[slot.kind];
                      const uploaded = state.uploaded;
                      const statusText =
                        state.status === 'uploading'
                          ? 'Uploading...'
                          : state.status === 'removing'
                            ? 'Removing...'
                            : state.status === 'uploaded'
                              ? 'Uploaded'
                              : state.status === 'failed'
                                ? 'Upload failed'
                                : 'Required';
                      const statusClass =
                        state.status === 'uploaded'
                          ? 'bg-success-100 text-success-600'
                          : state.status === 'failed'
                            ? 'bg-danger-100 text-danger-600'
                            : ['uploading', 'removing'].includes(state.status)
                              ? 'bg-forum-50 text-forum-700'
                              : 'bg-warning-100 text-warning-600';

                      return (
                        <div key={slot.kind}>
                          <div className="mb-1.5 flex items-center justify-between gap-3">
                            <label className="block text-sm font-medium text-ink">
                              {slot.label}
                              <span className="ml-1 text-danger-600">*</span>
                            </label>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                              {['uploading', 'removing'].includes(state.status) && <RefreshCw className="h-3 w-3 animate-spin" />}
                              {state.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                              {state.status === 'uploaded' && <CheckCircle2 className="h-3 w-3" />}
                              {statusText}
                            </span>
                          </div>

                          <div
                            className={`rounded-lg border ${
                              state.error
                                ? 'border-danger-600/40 bg-danger-100/20'
                                : uploaded
                                  ? 'border-success-600/25 bg-success-100/20'
                                  : 'border-dashed border-paper-border bg-paper'
                            } p-4`}
                          >
                            {uploaded ? (
                              <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-paper-raised text-forum-700 ring-1 ring-paper-border">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-forum-900">{uploaded.name}</p>
                                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-subtle">
                                      <span>{readableType(uploaded.mimeType, uploaded.name)}</span>
                                      <span>{formatBytes(uploaded.sizeBytes)}</span>
                                      <span>Saved for submission</span>
                                    </div>
                                  </div>
                                </div>

                                {state.error && <p className="text-xs text-danger-600">{state.error}</p>}

                                <div className="flex flex-wrap items-center gap-2">
                                  {state.previewUrl && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => window.open(state.previewUrl!, '_blank', 'noopener,noreferrer')}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Preview
                                    </Button>
                                  )}
                                  <Button type="button" variant="ghost" size="sm" onClick={() => downloadLocalDocument(state)}>
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeDocument(slot.kind)}
                                    disabled={state.status === 'removing'}
                                  >
                                    {state.status === 'removing' ? (
                                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                    Remove
                                  </Button>
                                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-forum-600 bg-transparent px-3 py-1.5 text-sm font-medium text-forum-700 transition-colors hover:bg-forum-50">
                                    <Upload className="h-3.5 w-3.5" />
                                    Replace
                                    <input
                                      type="file"
                                      accept={slot.accept}
                                      className="sr-only"
                                      disabled={state.status === 'removing'}
                                      onChange={(event) => {
                                        void handleDocumentSelected(slot.kind, event.currentTarget.files?.[0] ?? null);
                                        event.currentTarget.value = '';
                                      }}
                                    />
                                  </label>
                                </div>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Upload className="mx-auto h-9 w-9 text-ink-subtle" />
                                <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg bg-forum-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forum-700">
                                  {state.status === 'uploading' ? 'Uploading...' : 'Upload file'}
                                  <input
                                    type="file"
                                    accept={slot.accept}
                                    className="sr-only"
                                    disabled={state.status === 'uploading'}
                                    onChange={(event) => {
                                      void handleDocumentSelected(slot.kind, event.currentTarget.files?.[0] ?? null);
                                      event.currentTarget.value = '';
                                    }}
                                  />
                                </label>
                                <p className="mt-2 text-xs text-ink-subtle">{slot.hint}</p>
                                {state.status === 'uploading' && (
                                  <p className="mt-2 text-xs font-medium text-forum-700">Uploading and validating document...</p>
                                )}
                                {state.error && <p className="mt-2 text-xs text-danger-600">{state.error}</p>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={isSubmitting || documentsBusy || documentsFailed || !documentsReady}
                  >
                    <Send className="h-4.5 w-4.5" />
                    {isSubmitting
                      ? 'Submitting Application...'
                      : documentsBusy
                        ? 'Uploading Documents...'
                        : documentsFailed
                          ? 'Fix Document Upload'
                        : !documentsReady
                          ? 'Upload Required Documents'
                          : 'Submit Application'}
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
