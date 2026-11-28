import PolicyDialog from '../../components/membership/PolicyDialog';
import RegistrationRequirements, { type ReferralInput } from '../../components/membership/RegistrationRequirements';
import RegistrationFeeNotice from '../../components/membership/RegistrationFeeNotice';
import { membershipService, type RegistrationPolicy } from '../../services/membershipService';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail,
  ArrowRight,
  User,
  GraduationCap,
  CheckCircle2,
  FileCheck2,
  Camera,
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
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { hidesAcademicBackground, isApplicationFeeExempt, isSchoolStudent, SCHOOL_STUDENT_TYPE, STEM_COLLEGE_STUDENT_TYPE } from '../../domain/membershipFee';
import { DISCIPLINARY_AWARD_OPTIONS } from '../../domain/awardNomination';
import CheckboxDropdown from '../../components/common/CheckboxDropdown';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput, Checkbox } from '../../components/common/Input';
import OtpCodeStep from '../../components/auth/OtpCodeStep';
import logoImg from '../../assets/images/logo.webp';
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
  'Professor',
  'Therapist',
  'Practitioner in AYUSH',
  'Social Worker',
  'Doctoral Candidate',
  'Student',
  SCHOOL_STUDENT_TYPE,
  STEM_COLLEGE_STUDENT_TYPE,
  'Academic Researcher',
  'Mental Health Professional',
  'Public Servant',
  'Physical Education',
  'Others',
];

// The address is asked for once: a one-time code is emailed to it and the
// account is not created until that code comes back, so a typo cannot slip
// through unnoticed the way it could when registration completed immediately.
const commemorativeAwardLabels = DISCIPLINARY_AWARD_OPTIONS.map(([, label]) => label);
const commemorativeAwardEnum = z.enum(commemorativeAwardLabels as unknown as [string, ...string[]], { errorMap: () => ({ message: 'Select a commemorative award.' }) });
const registerFields = z.object({
  firstName: z.string().trim().min(1, 'Please enter your first name').max(59),
  lastName: z.string().trim().min(1, 'Please enter your last name').max(59),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(40, 'Phone number must be 40 characters or fewer'),
  professionalType: z.string().min(1, 'Select your professional type'),
  institution: z.string().trim().max(200),
  communicationAddress: z.string().trim().max(1000),
  credentials: z.string().trim().max(5000),
  researchInterests: z.array(commemorativeAwardEnum).min(1, 'Select at least one commemorative award.').max(2, 'You can choose only two.').refine((items) => new Set(items).size === items.length, 'Select each award only once.'),
  agreeTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
});
const schema = registerFields.superRefine((value, ctx) => {
  if (isSchoolStudent(value.professionalType)) return;
  if (value.institution.length < 2) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['institution'], message: 'Type of Professional Organization / Independent Professionals is required' });
  if (value.communicationAddress.length < 5) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['communicationAddress'], message: 'Enter your communication address' });
  if (hidesAcademicBackground(value.professionalType)) return;
  if (value.credentials.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['credentials'], message: 'Please briefly describe your credentials' });
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

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const documentSlots: Array<{
  kind: RegistrationDocumentKind;
  label: string;
  accept: string;
  extensions: string[];
  typeError: string;
  hint: string;
}> = [
  {
    kind: 'CREDENTIAL',
    label: 'Credentials / Certifications / ID Card',
    accept: 'application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'webp'],
    typeError: 'Upload a PDF, DOC, DOCX, JPG, PNG, or WebP file.',
    hint: 'PDF, DOC, DOCX, JPG, PNG, or WebP, up to 5 MB',
  },
  {
    kind: 'PHOTO',
    label: 'Member photograph',
    accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
    extensions: ['jpg', 'jpeg', 'png', 'webp'],
    typeError: 'Upload a JPG, PNG, or WebP photograph.',
    hint: 'A clear photograph of you. JPG, PNG, or WebP, up to 5 MB',
  },
];

const initialUploadState = (): Record<RegistrationDocumentKind, UploadState> => ({
  CV: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
  CREDENTIAL: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
  PHOTO: { status: 'idle', file: null, uploaded: null, previewUrl: null, error: null },
});
const previewMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

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
  if (mimeType === 'image/webp') return 'WebP';
  return ext || mimeType;
}

function clientFileError(file: File, slot: (typeof documentSlots)[number]) {
  if (file.size <= 0) return 'Choose a non-empty file.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Upload a file under 5 MB.';
  if (!slot.extensions.includes(fileExtension(file.name))) return slot.typeError;
  return null;
}

function makePreviewUrl(file: File, mimeType: string) {
  if (!previewMimeTypes.has(mimeType) && !previewMimeTypes.has(file.type)) return null;
  return URL.createObjectURL(file);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [policy, setPolicy] = useState<RegistrationPolicy | null>(null), [policyError, setPolicyError] = useState(''), [policyReload, setPolicyReload] = useState(0);
  const [referrals, setReferrals] = useState<ReferralInput[]>([]), [letters, setLetters] = useState<RegistrationDocumentUpload[]>([]), [waiver, setWaiver] = useState(''), [lettersBusy, setLettersBusy] = useState(false);
  const [paymentReference, setPaymentReference] = useState(''), [paymentProof, setPaymentProof] = useState<RegistrationDocumentUpload | null>(null), [paymentBusy, setPaymentBusy] = useState(false), [paymentError, setPaymentError] = useState('');
  useEffect(() => { const controller = new AbortController(); setPolicyError(''); membershipService.policy(controller.signal).then(p => { if (!controller.signal.aborted) setPolicy(p); }).catch(e => { if (!controller.signal.aborted) setPolicyError(normalizeError(e).message); }); return () => controller.abort(); }, [policyReload]);
  const [submitted, setSubmitted] = useState(false);
  const [openPolicy, setOpenPolicy] = useState<'terms-of-service' | 'code-of-ethics' | null>(null);
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
      navigate('/application', { replace: true });
    },
  });

  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      institution: '',
      communicationAddress: '',
      credentials: '',
      researchInterests: [],
      professionalType: '',
    },
  });
  const professionalType = watch('professionalType') ?? '';
  const schoolStudent = isSchoolStudent(professionalType);
  const isRequired = (kind: RegistrationDocumentKind) => {
    if (kind === 'PHOTO') return true;
    if (schoolStudent || kind === 'CV') return false;
    return policy?.requireCredential ?? true;
  };
  const paymentRequired = Boolean(policy?.applicationFeeEnabled && professionalType && !isApplicationFeeExempt(professionalType));
  const offlinePayment = paymentRequired && !policy?.razorpayEnabled;

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

  const documentsReady = documentSlots.every((slot) => !isRequired(slot.kind) || (documentUploads[slot.kind].status === 'uploaded' && documentUploads[slot.kind].uploaded));
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
    const slot = documentSlots.find((item) => item.kind === kind);
    const localError = slot ? clientFileError(file, slot) : 'Choose a supported file.';
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
    firstName: data.firstName,
    lastName: data.lastName,
    communicationAddress: data.communicationAddress,
    fullName: `${data.firstName} ${data.lastName}`,
    email: data.email,
    phone: data.phone,
    professionalType: data.professionalType,
    institution: data.institution,
    credentials: data.credentials,
    researchInterests: data.researchInterests,
    documents: documentClaims,
    policyRevision: policy?.revision,
    referrals: referrals.filter(r => r.name || r.email || r.organization),
    referenceLetters: letters.map(l => ({ fileId: l.id, claimToken: l.claimToken })),
    ...(policy?.applicationFeeEnabled && policy.waiversEnabled && !isApplicationFeeExempt(data.professionalType) && waiver.trim() ? { waiverReason: waiver.trim() } : {}),
    ...(offlinePayment && paymentProof ? { paymentReference: paymentReference.trim(), paymentScreenshot: { fileId: paymentProof.id, claimToken: paymentProof.claimToken } } : {}),
    agreeTerms: data.agreeTerms,
  });

  const onPaymentProof = async (file: File | null) => {
    if (!file) return;
    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!['.jpg', '.jpeg', '.png'].includes(extension) || (file.type && !['image/jpeg', 'image/png'].includes(file.type))) {
      setPaymentProof(null);
      setPaymentError('Upload a JPEG or PNG screenshot of the payment.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) { setPaymentError('Upload a JPEG or PNG screenshot under 5 MB.'); return; }
    setPaymentBusy(true); setPaymentError('');
    try {
      const uploaded = await uploadRegistrationDocument(file);
      setPaymentProof(uploaded);
    } catch (error) { setPaymentError(normalizeError(error).message); }
    finally { setPaymentBusy(false); }
  };

  const onSubmit = async (data: FormData) => {
    setErrorMsg(null);
    if (!policy || policyError) { setErrorMsg('Load the current membership requirements before submitting.'); return; }
    if (!documentsReady) {
      setErrorMsg('Upload the required documents before submitting your application.');
      setDocumentUploads((current) => ({
        ...current,
        CV: !isRequired('CV') || current.CV.uploaded ? current.CV : { ...current.CV, error: 'Upload your CV.' },
        CREDENTIAL: !isRequired('CREDENTIAL') || current.CREDENTIAL.uploaded
          ? current.CREDENTIAL
          : { ...current.CREDENTIAL, error: 'Upload your Credentials / Certifications / ID Card.' },
        PHOTO: current.PHOTO.uploaded ? current.PHOTO : { ...current.PHOTO, error: 'Upload your photograph.' },
      }));
      return;
    }
    if (offlinePayment && (paymentReference.trim().length < 4 || !paymentProof)) {
      setErrorMsg('Enter the UTR / UPI reference and upload a JPEG or PNG payment screenshot.');
      if (!paymentProof) setPaymentError('Upload a JPEG or PNG screenshot of the payment.');
      return;
    }
    try {
      // Only enters the code step once the backend confirms a code was really
      // sent; a delivery failure throws and is surfaced below.
      otp.begin(await requestOtp(payloadFrom(data)));
    } catch (error) {
      const normalized = normalizeError(error);
      setErrorMsg([normalized.message, ...Object.values(normalized.fieldErrors)].join(' '));
      if (normalized.status === 409) { setPolicy(null); setPolicyReload(n => n + 1); }
      for (const [field, message] of Object.entries(normalized.fieldErrors)) {
        if (field === 'fullName') setError('firstName', { type: 'server', message });
        else if (field in registerFields.shape) setError(field as keyof FormData, { type: 'server', message });
      }
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
            <Button as="link" to="/application" size="lg">
              View application
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
        

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-1">
            <div className="space-y-6 lg:sticky lg:top-10">
              <Link to="/" className="inline-flex items-center gap-2.5 mb-8">
          <img
            src={logoImg}
            alt="IFSMHP Logo"
            className="h-20 w-20 rounded-lg object-contain"
          />
          <div>
            <span className="block font-display text-lg font-semibold text-forum-900">IFSMHP</span>
            <span className="block text-[10px] uppercase tracking-wider text-ink-subtle">
              Membership Application
            </span>
          </div>
        </Link>
              <div>
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

          <div className="min-w-0 lg:col-span-2">
            <div className="rounded-2xl border border-paper-border bg-paper-raised p-6 sm:p-8 lg:p-10 shadow-sm">
              {errorMsg && (
                <div className="mb-6 rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">
                  {errorMsg}
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {policyError && <div role="alert">{policyError}<Button type="button" onClick={() => setPolicyReload(n => n + 1)}>Retry membership requirements</Button></div>}
                {!policy && !policyError && <p role="status">Loading membership requirements…</p>}
                <div>
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-forum-700" />
                    Personal Information
                  </h2>
                  <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput
                      label="First Name"
                      maxLength={59}
                      placeholder="Jane A."
                      required
                      error={errors.firstName?.message}
                      {...register('firstName')}
                    />
                    <TextInput
                      label="Last Name"
                      maxLength={59}
                      placeholder="Smith"
                      required
                      error={errors.lastName?.message}
                      {...register('lastName')}
                    />
                    <div className="sm:col-span-2">
                      <SelectInput
                        label="Professional Type"
                        required
                        error={errors.professionalType?.message}
                        {...register('professionalType', {
                          onChange: (event) => {
                            if (isApplicationFeeExempt(event.target.value)) {
                              setWaiver('');
                              setPaymentReference('');
                              setPaymentProof(null);
                              setPaymentError('');
                            }
                          },
                        })}
                      >
                        <option value="">Select your role...</option>
                        {professionalTypes.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </SelectInput>
                      {policy && <RegistrationFeeNotice policy={policy} professionalType={professionalType} />}
                      {offlinePayment && (
                        <div className="mt-3 space-y-3">
                          <TextInput label="Payment reference (UTR / UPI)" required maxLength={191} value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} />
                          <label className="block text-sm font-medium text-ink">
                            Payment screenshot <span className="text-danger-600">*</span>
                            <input type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="mt-1.5 block w-full text-base" disabled={paymentBusy} onChange={(event) => { void onPaymentProof(event.target.files?.[0] ?? null); event.target.value = ''; }} />
                          </label>
                          {paymentProof ? <p className="text-xs text-success-700">{paymentProof.name}</p> : <p className="text-xs text-ink-muted">JPEG or PNG, up to 5 MB, required before you submit.</p>}
                          {paymentError && <p role="alert" className="text-xs text-danger-600">{paymentError}</p>}
                        </div>
                      )}
                    </div>
                    <TextInput
                      label="Email"
                      type="email"
                      placeholder="jane@university.edu"
                      icon={<Mail className="h-4.5 w-4.5" />}
                      required
                      error={errors.email?.message}
                      hint="We'll send a 6-digit code here to verify your address."
                      {...register('email')}
                    />
                    <TextInput
                      label="Phone Number"
                      type="tel"
                      placeholder="+91 xxx xxx xxxx"
                      required
                      error={errors.phone?.message}
                      {...register('phone')}
                    />
                    {!schoolStudent && (
                    <TextInput
                      label="Type of Professional Organization / Independent Professionals"
                      placeholder="University, Hospital, Private Practice..."
                      required
                      className="flex h-full flex-col [&>label]:mb-0 [&>div]:pt-2.5"
                      error={errors.institution?.message}
                      {...register('institution')}
                    />
                    )}
                    {documentSlots.filter((slot) => slot.kind === 'PHOTO').map((slot) => {
                      const state = documentUploads[slot.kind];
                      const uploaded = state.uploaded;
                      const busy = state.status === 'uploading' || state.status === 'removing';
                      return (
                        <div key={slot.kind} className="flex h-full flex-col">
                          <label htmlFor="registration-photo" className="block text-sm font-medium leading-5 text-ink">
                            Photo
                            {isRequired(slot.kind) ? <span className="ml-1 text-danger-600">*</span> : <span className="ml-1 text-ink-subtle">(optional)</span>}
                          </label>
                          <div className="mt-auto pt-2.5">
                            <div
                              className={`flex h-[42px] items-center gap-3 rounded-md border bg-paper px-3 shadow-sm ${
                                state.error ? 'border-danger-600' : uploaded ? 'border-success-600/40' : 'border-paper-border'
                              }`}
                            >
                              {state.previewUrl ? (
                                <img src={state.previewUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forum-50 text-forum-700">
                                  <Camera className="h-4 w-4" aria-hidden="true" />
                                </span>
                              )}
                              <p className="min-w-0 flex-1 truncate text-sm text-forum-900">
                                {uploaded ? uploaded.name : 'JPG, PNG, or WebP'}
                              </p>
                              {uploaded && (
                                <button
                                  type="button"
                                  className="shrink-0 text-sm font-medium text-ink-muted hover:text-danger-600 disabled:opacity-60"
                                  disabled={busy}
                                  onClick={() => { void removeDocument(slot.kind); }}
                                >
                                  Remove
                                </button>
                              )}
                              <label className="relative shrink-0 cursor-pointer text-sm font-semibold text-forum-700">
                                {state.status === 'uploading' ? 'Uploading…' : uploaded ? 'Replace' : 'Choose'}
                                <input
                                  id="registration-photo"
                                  type="file"
                                  accept={slot.accept}
                                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                  disabled={busy}
                                  onChange={(event) => {
                                    void handleDocumentSelected(slot.kind, event.currentTarget.files?.[0] ?? null);
                                    event.currentTarget.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                          {state.error && <p role="alert" className="mt-1 text-xs text-danger-600">{state.error}</p>}
                          <figure className="mt-2 flex items-center gap-3">
                            <svg viewBox="0 0 72 88" className="h-16 w-14 shrink-0 rounded-md border border-paper-border bg-paper" role="img" aria-label="Example portrait">
                              <rect width="72" height="88" fill="#f4f7f8" />
                              <circle cx="36" cy="30" r="14" fill="#1e3a5f" />
                              <path d="M12 80c2-16 12-24 24-24s22 8 24 24" fill="#1e3a5f" />
                              <text x="36" y="84" textAnchor="middle" fontSize="7" fill="#5c6b73">Example</text>
                            </svg>
                            <figcaption className="text-xs text-ink-muted">Example photograph. Upload a clear head-and-shoulders picture like this.</figcaption>
                          </figure>
                        </div>
                      );
                    })}
                    {!schoolStudent && (
                    <>
                    <div className="sm:col-span-2">
                      <TextArea
                        label="Communication Address"
                        maxLength={1000}
                        placeholder="Street address, city, state / province, postal code, country"
                        rows={2}
                        required
                        error={errors.communicationAddress?.message}
                        {...register('communicationAddress')}
                      />
                    </div>
                    </>
                    )}
                  </div>
                </div>

                {schoolStudent && (
                  <p className="rounded-lg border border-forum-200 bg-forum-50 px-3 py-2 text-sm text-forum-900">
                    School students choose up to two commemorative awards. Organization, address, credentials, and education are not required.
                  </p>
                )}

                {!schoolStudent && policy && <RegistrationRequirements policy={policy} professionalType={professionalType} referrals={referrals} setReferrals={setReferrals} letters={letters} setLetters={setLetters} waiver={waiver} setWaiver={setWaiver} setUploading={setLettersBusy} />}

                <div className="pt-2">
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-forum-700" />
                    Professional Background
                  </h2>
                  <div className="mt-5 grid gap-5">
                    {!hidesAcademicBackground(professionalType) && (
                    <>
                    <TextArea
                      label="Professional Credentials"
                      placeholder="Degrees, licenses, certifications, professional affiliations... (e.g. PhD Clinical Psychology, Licensed Psychologist #12345)"
                      rows={3}
                      required
                      error={errors.credentials?.message}
                      {...register('credentials')}
                    />
                    </>
                    )}
                    <Controller
                      name="researchInterests"
                      control={control}
                      render={({ field }) => (
                        <CheckboxDropdown
                          label="Research Interests"
                          required
                          options={commemorativeAwardLabels}
                          value={field.value}
                          onChange={field.onChange}
                          error={errors.researchInterests?.message}
                          hint="Choose up to two commemorative awards."
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <h2 className="font-display text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <FileCheck2 className="h-5 w-5 text-forum-700" />
                    Document Upload
                  </h2>
                  <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {documentSlots.filter((slot) => slot.kind !== 'PHOTO' && !(schoolStudent && slot.kind === 'CREDENTIAL')).map((slot) => {
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
                                : isRequired(slot.kind) ? 'Required' : 'Optional';
                      const statusClass =
                        state.status === 'uploaded'
                          ? 'bg-success-100 text-success-600'
                          : state.status === 'failed'
                            ? 'bg-danger-100 text-danger-600'
                            : ['uploading', 'removing'].includes(state.status)
                              ? 'bg-forum-50 text-forum-700'
                              : isRequired(slot.kind)
                                ? 'bg-warning-100 text-warning-600'
                                : 'bg-forum-50 text-ink-muted';

                      return (
                        <div key={slot.kind} className="flex flex-col gap-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 text-sm font-medium leading-5 text-ink">
                              {slot.label}
                              {isRequired(slot.kind) ? <span className="ml-1 text-danger-600">*</span> : <span className="ml-1 text-ink-subtle">(optional)</span>}
                            </p>
                            <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>
                              {['uploading', 'removing'].includes(state.status) && <RefreshCw className="h-3 w-3 animate-spin" />}
                              {state.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                              {state.status === 'uploaded' && <CheckCircle2 className="h-3 w-3" />}
                              {statusText}
                            </span>
                          </div>

                          <div
                            className={`flex h-full flex-col justify-center rounded-lg border ${
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
                                  <label className="relative inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-forum-600 bg-transparent px-3 py-2 text-sm font-medium text-forum-700 transition-colors hover:bg-forum-50">
                                    <Upload className="h-3.5 w-3.5" />
                                    Replace
                                    <input
                                      type="file"
                                      accept={slot.accept}
                                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
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
                                <label className="relative mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-forum-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-forum-700">
                                  {state.status === 'uploading' ? 'Uploading...' : 'Upload file'}
                                  <input
                                    type="file"
                                    accept={slot.accept}
                                    className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
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
                        <button type="button" className="underline text-forum-700 font-medium" onClick={() => setOpenPolicy('terms-of-service')}>
                          Terms of Service
                        </button>{' '}
                        and{' '}
                        <button type="button" className="underline text-forum-700 font-medium" onClick={() => setOpenPolicy('code-of-ethics')}>
                          Code of Ethics
                        </button>
                        .
                      </>
                    }
                    {...register('agreeTerms')}
                  />
                  {errors.agreeTerms && (
                    <p className="mt-2 text-xs text-danger-600 pl-6">{errors.agreeTerms.message}</p>
                  )}
                </div>
                {openPolicy && <PolicyDialog key={openPolicy} slug={openPolicy} onClose={() => setOpenPolicy(null)} />}

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
                    disabled={isSubmitting || documentsBusy || documentsFailed || !documentsReady || lettersBusy || paymentBusy || !policy || !!policyError || (offlinePayment && (paymentReference.trim().length < 4 || !paymentProof))}
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
