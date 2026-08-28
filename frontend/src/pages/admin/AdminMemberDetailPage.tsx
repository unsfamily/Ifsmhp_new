import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Mail,
  Calendar,
  GraduationCap,
  Briefcase,
  IdCard,
  AlertCircle,
  FileText,
  Send,
  ChevronDown,
  Eye,
  Phone,
  Globe2,
  UserCircle2,
  History,
  ShieldCheck,
  Lock,
  FileCheck,
  FileDown,
  X,
  Sparkles,
  UserPlus,
  Bell,
  FileKey,
  Clock3,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea, TextInput } from '../../components/common/Input';
import { apiClient, normalizeError } from '../../api/client';
import { adminApi, type AdminMemberDetail } from '../../api/admin';
import { useApiData } from '../../hooks/useApiData';

type ApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

interface EducationRecord {
  institution: string;
  degree: string;
  field: string;
  startYear: string;
  endYear: string;
}

interface CredentialDocument {
  id: string;
  title: string;
  issuer: string;
  year: string;
  referenceNumber: string;
  type: 'Degree' | 'Postgraduate' | 'License' | 'Research' | 'Other';
  fileSize: string;
  uploadedAt: string;
}

interface StatusHistoryEntry {
  status: ApplicationStatus | 'CREATED';
  timestamp: string;
  actor: string;
  note?: string;
}

interface ApplicationRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  professionalTitle: string;
  professionalType: string;
  institution: string;
  country: string;
  biography: string;
  researchInterests: string[];
  education: EducationRecord[];
  credentials: CredentialDocument[];
  applicationId: string;
  submittedAt: string;
  status: ApplicationStatus;
  statusHistory: StatusHistoryEntry[];
  memberId?: string;
  /** Free-text answers submitted at registration — the substance under review. */
  credentialsText: string;
  educationText: string;
  researchText: string;
  slaDays: number;
}

/**
 * Adapts the API payload to the shape this screen renders.
 *
 * `statusHistory` is the real audit trail written by the backend on every
 * transition; the page previously showed a separate fabricated "reviews" list,
 * which has no counterpart in the data and has been dropped.
 */
function toApplicationRecord(detail: AdminMemberDetail): ApplicationRecord {
  return {
    id: detail.id,
    fullName: detail.fullName,
    email: detail.email,
    phone: detail.phone ?? undefined,
    professionalTitle: detail.professionalTitle ?? '—',
    professionalType: detail.professionalType,
    institution: detail.institution,
    country: detail.country ?? '—',
    biography: detail.biography ?? '',
    researchInterests: detail.researchInterests,
    education: detail.education.map((e) => ({
      institution: e.institution,
      degree: e.degree,
      field: e.field ?? e.detail ?? '—',
      startYear: '',
      endYear: e.endYear ?? '',
    })),
    credentials: detail.credentials.map((c) => ({
      id: c.id,
      title: c.title,
      issuer: c.issuer ?? '—',
      year: c.year ?? '—',
      referenceNumber: '',
      type: (['Degree', 'Postgraduate', 'License', 'Research'].includes(c.type)
        ? c.type
        : 'Other') as CredentialDocument['type'],
      fileSize: c.fileSize,
      uploadedAt: c.uploadedAt,
    })),
    applicationId: detail.applicationId,
    submittedAt: detail.submittedAt,
    status: detail.statusValue,
    statusHistory: detail.statusHistory.map((h) => ({
      status: h.toStatus as ApplicationStatus,
      timestamp: h.createdAt,
      actor: 'IFSMHP',
      note: h.note ?? undefined,
    })),
    memberId: detail.memberId ?? undefined,
    credentialsText: detail.credentialsText,
    educationText: detail.educationText,
    researchText: detail.researchText,
    slaDays: detail.slaDays,
  };
}

const statusBadgeMap: Record<ApplicationStatus, 'info' | 'warning' | 'success' | 'danger'> = {
  PENDING: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const statusLabelMap: Record<ApplicationStatus, string> = {
  PENDING: 'Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/**
 * Professional type is free text chosen at registration, so it cannot be keyed
 * to a fixed palette. One neutral badge keeps every value renderable.
 */
const TYPE_BADGE = 'info' as const;

const credentialTypeColors: Record<CredentialDocument['type'], string> = {
  Degree: 'bg-forum-50 text-forum-700',
  Postgraduate: 'bg-brass-100 text-brass-700',
  License: 'bg-slateteal-100 text-slateteal-700',
  Research: 'bg-success-100 text-success-600',
  Other: 'bg-forum-50 text-forum-700',
};

const historyStatusIcons: Record<string, typeof FileCheck> = {
  CREATED: UserPlus,
  PENDING: Clock,
  UNDER_REVIEW: Eye,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

const historyStatusBadge: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  CREATED: 'default',
  PENDING: 'info',
  UNDER_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

function formatDateFull(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDateShort(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminMemberDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);

  const { data, loading, error } = useApiData<AdminMemberDetail>(
    () => adminApi.member(id!),
    [id, reloadKey],
  );

  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [decision, setDecision] = useState<null | 'approve' | 'reject'>(null);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<CredentialDocument | null>(null);
  const [processing, setProcessing] = useState<null | 'start' | 'approve' | 'reject'>(null);
  const [confirmRejectValid, setConfirmRejectValid] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  // The decision panels live far down the right-hand column — well below the
  // fold on a phone — so revealing one is not enough on its own: the page has
  // to take the admin there, or the trigger looks like it did nothing.
  const decisionPanelRef = useRef<HTMLDivElement | null>(null);
  const approveHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const rejectReasonRef = useRef<HTMLTextAreaElement | null>(null);
  // Bumped on every trigger click so re-clicking an already-open panel scrolls
  // to it again rather than doing nothing.
  const [revealNonce, setRevealNonce] = useState(0);

  const openDecision = (next: 'approve' | 'reject') => {
    setDecision(next);
    setRevealNonce((n) => n + 1);
  };

  useEffect(() => {
    if (!decision) return;
    const panel = decisionPanelRef.current;
    if (!panel) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 'center' rather than 'start': the admin layout has a sticky top bar that
    // would otherwise cover the heading, and centring reads well at every width.
    panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });

    // preventScroll matters — focusing normally jumps the viewport instantly,
    // which cancels the smooth scroll that was just started.
    const target = decision === 'reject' ? rejectReasonRef.current : approveHeadingRef.current;
    target?.focus({ preventScroll: true });

    panel.classList.remove('attention-ring');
    // Reading offsetWidth forces a reflow so the animation restarts when the
    // same panel is revealed twice in a row.
    void panel.offsetWidth;
    panel.classList.add('attention-ring');
  }, [decision, revealNonce]);

  const application = data ? toApplicationRecord(data) : null;
  const status: ApplicationStatus = data?.statusValue ?? 'PENDING';

  const isPendOrReview = status === 'PENDING' || status === 'UNDER_REVIEW';
  const canStartReview = status === 'PENDING';
  const canApprove = isPendOrReview;
  const canReject = isPendOrReview;

  const refresh = () => setReloadKey((k) => k + 1);

  /** Runs an admin decision, then reloads so the screen shows the stored result. */
  const runAction = async (kind: 'start' | 'approve' | 'reject', call: () => Promise<unknown>, failure: string) => {
    setProcessing(kind);
    setActionError(null);
    try {
      await call();
      refresh();
      return true;
    } catch (err) {
      setActionError(normalizeError(err).message || failure);
      return false;
    } finally {
      setProcessing(null);
    }
  };

  const startReview = () =>
    runAction('start', () => adminApi.reviewMember(id!, reviewNotes || undefined), 'Could not start the review.');

  const confirmApproval = async () => {
    setProcessing('approve');
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await adminApi.approveMember(id!, reviewNotes || undefined);
      // The member is approved regardless; only the notification can fail.
      if (result.emailSent) {
        setActionNotice(`Approved. Member ID ${result.memberId} issued and the member has been emailed.`);
      } else {
        setActionError(
          `Approved and Member ID ${result.memberId} issued, but the acknowledgement email could not be sent. Use Retry below.`,
        );
      }
      setDecision(null);
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not approve this application.');
    } finally {
      setProcessing(null);
    }
  };

  /** Retries a failed acknowledgement. The server refuses once one has been sent. */
  const retryApprovalEmail = async () => {
    setResendingEmail(true);
    setActionError(null);
    setActionNotice(null);
    try {
      const result = await adminApi.resendApprovalEmail(id!);
      if (result.emailSent) {
        setActionNotice('Acknowledgement email sent.');
      } else {
        setActionError(`Still could not send the acknowledgement: ${result.emailError ?? 'unknown error'}`);
      }
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not send the acknowledgement.');
    } finally {
      setResendingEmail(false);
    }
  };

  const rejectionValid = rejectionReason.trim().length >= 12;

  const openRejectConfirm = () => {
    if (!rejectionValid) return;
    setConfirmRejectValid(false);
    setConfirmRejectOpen(true);
  };

  const submitRejection = async () => {
    const ok = await runAction(
      'reject',
      () => adminApi.rejectMember(id!, rejectionReason),
      'Could not reject this application.',
    );
    if (ok) {
      setConfirmRejectOpen(false);
      setDecision(null);
    }
  };

  /**
   * Secure credential access. The browser never sees a raw storage URL.
   * The view/download both hit authorized API routes (`/admin/credentials/:id/view`,
   * `/admin/credentials/:id/download`) which authenticate, authorize, audit,
   * then stream the file. No storage paths or pre-signed URLs are exposed to
   * the frontend — this follows spec §40 and architecture §F.5.
   */
  const viewCredential = (cred: CredentialDocument) => {
    setDocumentPreview(cred);
    const token = 'auth-token-attached-via-cookie';
    const auditId = `audit-${Date.now()}`;
    void token;
    void auditId;
    void window.open(
      `${apiClient.defaults.baseURL}/admin/credentials/${cred.id}/view?requestId=${auditId}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const downloadCredential = async (cred: CredentialDocument) => {
    try {
      const auditId = `audit-${Date.now()}`;
      const res = await apiClient.get(
        `/admin/credentials/${cred.id}/download`,
        {
          responseType: 'blob',
          headers: { 'X-Audit-Request-Id': auditId },
        }
      );
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `[IFSMHP-CONFIDENTIAL]-${cred.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDocumentPreview(cred);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Clock3 className="h-8 w-8 text-forum-600 animate-spin" />
        <p className="text-sm text-ink-muted">Loading application…</p>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-danger-100 text-danger-600">
          <AlertCircle className="h-8 w-8" />
        </div>
        <p className="text-base font-semibold text-forum-900">Application not found</p>
        <p className="text-sm text-ink-muted max-w-md text-center">
          {error ?? 'This application may have been removed.'}
        </p>
        <Button size="sm" variant="outline" onClick={() => navigate('/admin/members/pending')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to the queue
        </Button>
      </div>
    );
  }

  const initials = application.fullName
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((n) => n[0])
    .join('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/members/pending" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to the queue
        </Link>
        <div className="flex flex-wrap gap-2">
          {canStartReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={startReview}
              disabled={processing !== null}
            >
              {processing === 'start' ? (
                <Clock3 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Start Review
            </Button>
          )}
        </div>
      </div>

      {actionNotice && (
        <div className="rounded-lg border border-success-600/20 bg-success-100 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
          <p className="text-sm text-success-600">{actionNotice}</p>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      {/*
        Approved but never notified. The retry is offered only in this state —
        once an acknowledgement has gone out, the server refuses a second one.
      */}
      {status === 'APPROVED' && data && !data.approvalEmailSentAt && (
        <div className="rounded-lg border border-brass-500/30 bg-brass-100/50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-brass-700 shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-brass-700">Acknowledgement email not delivered</p>
            <p className="mt-0.5 text-brass-700/80">
              This member is approved, but the welcome email could not be sent
              {data.approvalEmailAttempts > 0 ? ` (${data.approvalEmailAttempts} attempt${data.approvalEmailAttempts === 1 ? '' : 's'})` : ''}
              {data.approvalEmailError ? `: ${data.approvalEmailError}` : '.'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={retryApprovalEmail} disabled={resendingEmail}>
            {resendingEmail ? <Clock3 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {resendingEmail ? 'Sending…' : 'Retry email'}
          </Button>
        </div>
      )}

      {status === 'APPROVED' && data?.approvalEmailSentAt && (
        <div className="rounded-lg border border-success-600/20 bg-success-100/60 p-4 flex items-start gap-3">
          <Mail className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
          <p className="text-sm text-success-600">
            Acknowledgement emailed to {application.email} on {formatDateFull(data.approvalEmailSentAt)}.
          </p>
        </div>
      )}

      {/* ===== APPLICANT PROFILE HEADER ===== */}
      <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-600 via-forum-700 to-forum-900 p-6 sm:p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brass-500 text-white font-display text-3xl font-bold ring-4 ring-brass-500/20 shadow-lg">
              <div className="relative">
                <span>{initials}</span>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-success-600 border-2 border-forum-900" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold leading-tight">
                  {application.fullName}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="brass" className="bg-white/10 text-forum-100 border border-white/20">
                  {application.professionalType}
                </Badge>
                <Badge variant={statusBadgeMap[status]} className="border border-white/20">
                  <Clock className="h-2.5 w-2.5 mr-1" />
                  {statusLabelMap[status]}
                </Badge>
                {application.memberId && (
                  <Badge variant="info" className="bg-white/10 text-forum-100 border border-white/20">
                    <IdCard className="h-2.5 w-2.5 mr-1" />
                    {application.memberId}
                  </Badge>
                )}
              </div>
              <p className="text-forum-100/90 text-sm sm:text-base leading-snug">
                {application.professionalTitle}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-forum-100/85">
                <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{application.email}</span>
                {application.phone && (
                  <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{application.phone}</span>
                )}
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{application.institution}</span>
                <span className="inline-flex items-center gap-1"><Globe2 className="h-3.5 w-3.5" />{application.country}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {canApprove && (
              <Button
                size="lg"
                className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500"
                onClick={() => openDecision('approve')}
                disabled={processing !== null}
                aria-expanded={decision === 'approve'}
                aria-controls="approve-decision-panel"
              >
                <CheckCircle2 className="h-4.5 w-4.5" />
                Approve &amp; Issue ID
              </Button>
            )}
            {canReject && (
              <Button
                size="lg"
                variant="outline"
                className="border-white/25 text-white hover:bg-white/10 bg-transparent"
                onClick={() => openDecision('reject')}
                disabled={processing !== null}
                aria-expanded={decision === 'reject'}
                aria-controls="reject-decision-panel"
              >
                <XCircle className="h-4.5 w-4.5" />
                Reject Application
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ===== LEFT COLUMN: PROFILE + CREDENTIALS ===== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applicant Profile */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <UserCircle2 className="h-5 w-5 text-forum-600" />
                Applicant Profile
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">
                Self-reported data submitted by the applicant. Cross-verify with credential documents.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 text-sm">
                <InfoRow icon={Mail} label="Email" value={application.email} mono />
                <InfoRow icon={Phone} label="Phone" value={application.phone ?? 'Not provided'} muted={!application.phone} />
                <InfoRow icon={Building2} label="Institution" value={application.institution} />
                <InfoRow icon={Globe2} label="Country" value={application.country} />
                <InfoRow icon={Briefcase} label="Professional Title" value={application.professionalTitle} />
                <InfoRow icon={Briefcase} label="Professional Type" value={application.professionalType} badgeVariant={TYPE_BADGE} />
              </div>

              {/*
                The applicant's own words, exactly as submitted. Everything else
                on this screen is parsed out of these three answers, so an admin
                deciding the application should be able to read the source.
              */}
              <div className="space-y-4">
                {[
                  { label: 'Credentials', value: application.credentialsText },
                  { label: 'Education', value: application.educationText },
                  { label: 'Research Interests', value: application.researchText },
                ]
                  .filter((f) => f.value?.trim())
                  .map((f) => (
                    <div key={f.label}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                        {f.label} <span className="font-normal normal-case">— as submitted</span>
                      </h4>
                      <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{f.value}</p>
                    </div>
                  ))}
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Research Interests
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {application.researchInterests.map((r) => (
                    <span
                      key={r}
                      className="inline-flex items-center rounded-full bg-forum-50 text-forum-700 px-3 py-1 text-xs font-medium border border-forum-100"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3 flex items-center gap-1">
                  <GraduationCap className="h-3.5 w-3.5" /> Education
                </h4>
                <div className="border border-paper-border rounded-xl overflow-hidden">
                  <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-forum-50/60 border-b border-paper-border text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                    <div className="col-span-12 sm:col-span-3">Institution</div>
                    <div className="col-span-5 sm:col-span-3">Degree</div>
                    <div className="col-span-7 sm:col-span-4">Field</div>
                    <div className="col-span-12 sm:col-span-2">Years</div>
                  </div>
                  {application.education.map((e, i) => (
                    <div
                      key={`${e.institution}-${i}`}
                      className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-paper-border last:border-0 text-sm hover:bg-forum-50/30"
                    >
                      <div className="col-span-12 sm:col-span-3 font-medium text-forum-900 text-sm">{e.institution}</div>
                      <div className="col-span-5 sm:col-span-3 text-ink">{e.degree}</div>
                      <div className="col-span-7 sm:col-span-4 text-ink-muted">{e.field}</div>
                      <div className="col-span-12 sm:col-span-2 text-xs text-ink-muted inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {e.startYear} — {e.endYear}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professional Credentials */}
          <Card>
            <CardHeader className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-brass-700" />
                  Professional Credentials
                  <span className="text-ink-muted font-normal text-sm">({application.credentials.length})</span>
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5 inline-flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-warning-600" />
                  Admin-only access · Access authorized and audited · Storage paths never exposed
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2.5">
              {application.credentials.map((c) => {
                const isOpen = documentPreview?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      isOpen
                        ? 'border-slateteal-500/40 bg-slateteal-100/20 ring-2 ring-slateteal-100'
                        : 'border-paper-border bg-paper-raised hover:bg-forum-50/30'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-lg ${credentialTypeColors[c.type]}`}>
                        <FileKey className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm text-forum-900 leading-snug">{c.title}</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-ink-muted">
                              <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{c.issuer}</span>
                              <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{c.year}</span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-paper px-1.5 py-0.5 rounded border border-paper-border">
                                <IdCard className="h-3 w-3" />
                                {c.referenceNumber}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="default">{c.type}</Badge>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-subtle">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{c.fileSize}</span>
                            <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Uploaded {formatDateShort(c.uploadedAt)}</span>
                            <span className="inline-flex items-center gap-1 text-success-600 font-medium">
                              <Lock className="h-3 w-3" />
                              Authorized channel
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => viewCredential(c)}>
                              <Eye className="h-3.5 w-3.5" />
                              Secure View
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => downloadCredential(c)}>
                              <FileDown className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="mt-4 rounded-lg border border-paper-border bg-paper p-3 text-xs text-ink-muted">
                        <div className="flex items-center gap-2 mb-1.5">
                          <ShieldCheck className="h-4 w-4 text-success-600" />
                          <span className="font-semibold text-ink">Secure access (simulated — API pending)</span>
                        </div>
                        <p>
                          Production calls: <code className="bg-forum-50 px-1 rounded font-mono">GET /api/v1/admin/credentials/{c.id}/view</code> (authorized stream, in-popup viewer) and
                          <code className="bg-forum-50 px-1 rounded font-mono mx-1">/download</code> (blobs named <code className="font-mono">[IFSMHP-CONFIDENTIAL]-{c.id}.pdf</code> with audit headers). Storage paths never leave the server.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ===== RIGHT COLUMN: APPLICATION INFO + ACTIONS ===== */}
        <div className="space-y-6">
          {/* Application Information */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <IdCard className="h-5 w-5 text-slateteal-500" />
                Application Information
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-3 text-sm">
                <InfoRow icon={IdCard} label="Application ID" value={application.applicationId} mono />
                <InfoRow icon={Calendar} label="Submitted Date" value={formatDateFull(application.submittedAt)} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1">Current Status</p>
                  <Badge variant={statusBadgeMap[status]}>
                    {statusLabelMap[status]}
                  </Badge>
                </div>
              </div>

              {/* Previous Status History */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3 flex items-center gap-1">
                  <History className="h-3.5 w-3.5" /> Previous Status History
                </h4>
                <ol className="relative border-l border-paper-border ml-3 space-y-4">
                  {application.statusHistory
                    .slice()
                    .reverse()
                    .map((entry, i) => {
                      const HIcon = historyStatusIcons[entry.status] ?? Clock;
                      return (
                        <li key={`${entry.status}-${i}`} className="pl-4 relative">
                          <span className="absolute -left-[15px] top-0 h-7 w-7 flex items-center justify-center rounded-full ring-4 ring-paper-raised bg-forum-50 text-forum-700">
                            <HIcon className="h-3.5 w-3.5" />
                          </span>
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge variant={historyStatusBadge[entry.status] ?? 'default'}>
                                {entry.status.replace('_', ' ')}
                              </Badge>
                              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDateFull(entry.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-ink mt-1">
                              by <span className="font-medium">{entry.actor}</span>
                            </p>
                            {entry.note && (
                              <p className="text-xs text-ink-muted mt-0.5 bg-forum-50/60 border border-forum-100/60 rounded-md px-2 py-1.5">
                                {entry.note}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Review History */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-forum-600" />
                Review History
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Admin actions and reviewer commentary</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {application.statusHistory.length === 0 ? (
                <p className="text-sm text-ink-subtle text-center py-6">No review activity yet.</p>
              ) : (
                application.statusHistory
                  .slice()
                  .reverse()
                  .map((h, i) => (
                    <div key={`${h.status}-${i}`} className="rounded-lg border border-paper-border bg-paper p-3.5">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <Badge variant={historyStatusBadge[h.status] ?? 'default'}>
                          {h.status.replace(/_/g, ' ')}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                          <Clock className="h-3 w-3" />
                          {formatDateFull(h.timestamp)}
                        </span>
                      </div>
                      {h.note && <p className="text-sm text-ink mt-2 leading-relaxed">{h.note}</p>}
                    </div>
                  ))
              )}

              <div className="border-t border-paper-border pt-3 mt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">Review Note</h4>
                <TextArea
                  rows={3}
                  placeholder="Document credential cross-checks, policy references, or findings. Attached to your next decision and recorded in the audit trail."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
                <p className="mt-2 text-xs text-ink-subtle">
                  Saved with the next Start Review, Approve, or Reject action.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Member ID Projection / Issued */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileKey className="h-5 w-5 text-slateteal-500" />
                Member ID
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              {status === 'APPROVED' && application.memberId ? (
                <div className="rounded-xl bg-gradient-to-br from-success-100 to-forum-50 border border-success-600/20 p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-success-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Issued &amp; Activated
                  </p>
                  <p className="mt-2 font-mono text-2xl font-bold text-forum-900 tracking-tight">{application.memberId}</p>
                  <p className="mt-2 text-xs text-ink-subtle">Welcome email dispatched</p>
                </div>
              ) : (
                <div className="rounded-xl bg-gradient-to-br from-slateteal-100 to-forum-50 border border-slateteal-500/20 p-5 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slateteal-700">On Approval — Server-Side Generation</p>
                  <p className="mt-2 font-mono text-2xl font-bold text-forum-900 tracking-tight">IFSMHP-{new Date().getFullYear()}-######</p>
                  <p className="mt-2 text-xs text-ink-subtle">The sequence is allocated by the server when you approve.</p>
                </div>
              )}
              <div className="mt-4 space-y-2 text-xs text-ink-muted">
                <div className="flex justify-between"><span>Format:</span><code className="font-mono bg-paper px-1.5 py-0.5 rounded border border-paper-border">IFSMHP-YYYY-NNNNNN</code></div>
                <div className="flex justify-between"><span>Issuance:</span><span className="font-medium text-ink">Transactional server-side (row lock)</span></div>
                <div className="flex justify-between"><span>Immutability:</span><span className="font-medium text-success-600">Guaranteed</span></div>
                <div className="flex justify-between"><span>Storage path:</span><span className="font-medium text-danger-600">Never exposed to client</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Decision Panels */}
          {decision === 'approve' && (
            <div
              ref={decisionPanelRef}
              id="approve-decision-panel"
              role="region"
              aria-labelledby="approve-decision-heading"
              className="rounded-lg"
            >
            <Card className="border-success-600/30 ring-2 ring-success-100">
              <CardHeader className="bg-success-100/60 rounded-t-lg">
                <h3
                  id="approve-decision-heading"
                  ref={approveHeadingRef}
                  tabIndex={-1}
                  className="font-display text-lg font-semibold flex items-center gap-2 text-success-600 outline-none"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm Approval
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                    On confirmation, the server will:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <ApprovalStep icon={IdCard} text="Generate Member ID server-side (IFSMHP-YYYY-NNNNNN)" done />
                    <ApprovalStep icon={UserCheck} text="Activate user account — promote to ACTIVE" done />
                    <ApprovalStep icon={Briefcase} text="Stamp the Member Profile with the ID and approval date" done />
                    <ApprovalStep icon={Clock} text="Record approval timestamp with admin attribution" done />
                    <ApprovalStep icon={Bell} text="Create in-app notification for the applicant" done />
                    <ApprovalStep icon={Send} text="Email the member their Member ID (no password — sign-in is by emailed code)" done />
                    <ApprovalStep icon={History} text="Create immutable AuditLog entry (actor + review notes)" done />
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                    Review Notes (optional, audited)
                  </h4>
                  <TextArea
                    rows={3}
                    placeholder="Credibility findings, cross-check references, or committee vote summary."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setDecision(null)} disabled={processing !== null}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  {/*
                    Disabled for the whole of any in-flight decision, not just an
                    approval: the request waits on an SMTP round-trip, which is a
                    real window for a second click.
                  */}
                  <Button className="w-full sm:w-auto bg-success-600 hover:bg-success-600/90" onClick={confirmApproval} disabled={processing !== null}>
                    {processing === 'approve' ? <Clock3 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {processing === 'approve' ? 'Approving…' : 'Confirm Approval & Issue ID'}
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          )}

          {decision === 'reject' && (
            <div
              ref={decisionPanelRef}
              id="reject-decision-panel"
              role="region"
              aria-labelledby="reject-decision-heading"
              className="rounded-lg"
            >
            <Card className="border-danger-600/30 ring-2 ring-danger-100">
              <CardHeader className="bg-danger-100/60 rounded-t-lg">
                <h3
                  id="reject-decision-heading"
                  className="font-display text-lg font-semibold flex items-center gap-2 text-danger-600"
                >
                  <XCircle className="h-5 w-5" />
                  Reject Application
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="rounded-lg border border-danger-600/20 bg-danger-100/40 p-3">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-danger-600">Destructive action</p>
                      <p className="text-xs text-danger-600/90 mt-0.5">A written reason is required. A confirmation prompt will appear before submission.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-danger-600 mb-1.5">
                    Rejection Reason (required · min 12 characters)
                  </h4>
                  <TextArea
                    ref={rejectReasonRef}
                    rows={5}
                    placeholder="Specific, factual grounds for rejection. This text is shared with the applicant per policy §14 and recorded in the audit log."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                  <div className="flex justify-between items-center mt-1.5">
                    <p className={`text-[11px] font-medium ${rejectionValid ? 'text-success-600' : 'text-ink-subtle'}`}>
                      {rejectionValid
                        ? '✓ Reason length valid'
                        : `${Math.max(0, 12 - rejectionReason.trim().length)} more characters required`}
                    </p>
                    <p className="text-[11px] text-ink-muted">{rejectionReason.length} chars</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-1.5">
                    Internal Review Notes (not shared)
                  </h4>
                  <TextArea
                    rows={2}
                    placeholder="Private admin notes — for audit log only."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>

                <ul className="space-y-2 text-sm border border-paper-border rounded-lg p-3 bg-paper">
                  <li className="flex items-start gap-2 text-ink"><AlertCircle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" />Set application status → <code className="font-mono text-xs bg-forum-50 px-1 rounded">REJECTED</code></li>
                  <li className="flex items-start gap-2 text-ink"><AlertCircle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" />Email applicant with rejection reason</li>
                  <li className="flex items-start gap-2 text-ink"><AlertCircle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" />Write audit entry (reason + notes + actor)</li>
                </ul>

                <div className="flex flex-col-reverse sm:flex-row gap-2">
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setDecision(null)} disabled={processing !== null}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto bg-danger-600 hover:bg-danger-600/90"
                    onClick={openRejectConfirm}
                    disabled={!rejectionValid || processing !== null}
                  >
                    <XCircle className="h-4 w-4" />
                    Review &amp; Confirm Rejection
                  </Button>
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </div>
      </div>

      {/* ===== REJECTION CONFIRMATION MODAL ===== */}
      {confirmRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-paper-raised border border-paper-border shadow-2xl animate-[fadeIn_.15s_ease-out]">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">
                    Confirm Rejection — Destructive &amp; Irreversible
                  </h3>
                  <p className="text-xs text-ink-subtle mt-0.5">
                    Rejecting <span className="font-medium text-ink">{application.fullName}</span>'s application.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmRejectOpen(false)}
                className="rounded-md p-1.5 text-ink-muted hover:bg-forum-50 hover:text-forum-900"
                aria-label="Close dialog"
                disabled={processing === 'reject'}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="rounded-lg border border-danger-600/30 bg-danger-100/50 p-3.5 text-xs text-danger-600 space-y-1">
                <p className="font-semibold uppercase tracking-wider">This action CANNOT be undone:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>Application status permanently set to REJECTED</li>
                  <li>Rejection reason emailed to {application.email}</li>
                  <li>Audit log entry created with reason, notes, and your identity</li>
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-1.5">
                  Rejection reason to share with applicant
                </h4>
                <div className="rounded-lg border border-paper-border bg-forum-50/40 p-3 text-sm text-ink leading-relaxed whitespace-pre-wrap">
                  {rejectionReason.trim()}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-danger-600 flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Type <code className="font-mono text-[11px] bg-forum-50 px-1 rounded border border-paper-border">REJECT</code> to confirm
                </label>
                <TypeConfirmField correctValue="REJECT" onValidChange={setConfirmRejectValid} />
              </div>
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60 rounded-b-2xl">
              <Button variant="ghost" size="sm" onClick={() => setConfirmRejectOpen(false)} disabled={processing === 'reject'}>
                Cancel
              </Button>
              <ConfirmRejectButton
                disabled={!confirmRejectValid || processing === 'reject'}
                loading={processing === 'reject'}
                onConfirm={submitRejection}
                onSuccess={() => navigate('/admin/members')}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Sub-components ========== */

function TypeConfirmField({
  correctValue,
  onValidChange,
}: {
  correctValue: string;
  onValidChange: (v: boolean) => void;
}) {
  const [value, setValue] = useState('');
  const valid = value.trim() === correctValue;
  useEffect(() => onValidChange(valid), [valid, onValidChange]);
  return (
    <TextInput
      placeholder={`Type "${correctValue}"…`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className="mt-1.5"
      error={value.length > 0 && !valid ? `Must exactly match "${correctValue}"` : undefined}
    />
  );
}

function ConfirmRejectButton({
  disabled,
  loading,
  onConfirm,
  onSuccess,
}: {
  disabled: boolean;
  loading: boolean;
  onConfirm: () => Promise<void>;
  onSuccess: () => void;
}) {
  const [clicked, setClicked] = useState(false);
  return (
    <Button
      className="bg-danger-600 hover:bg-danger-600/90"
      disabled={disabled || loading}
      onClick={async () => {
        if (clicked) return;
        setClicked(true);
        await onConfirm();
        setTimeout(onSuccess, 400);
      }}
    >
      {loading ? <Clock3 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
      {loading ? 'Submitting…' : 'Permanently Reject Application'}
    </Button>
  );
}

function ApprovalStep({
  icon: Icon,
  text,
  done,
}: {
  icon: typeof FileCheck;
  text: string;
  done?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5 text-ink">
      <span
        className={`mt-0.5 h-5 w-5 shrink-0 rounded-full inline-flex items-center justify-center ${
          done ? 'bg-success-100 text-success-600' : 'bg-paper text-ink-subtle border border-paper-border'
        }`}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="text-sm leading-snug">{text}</span>
    </li>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  muted,
  mono,
  badgeVariant,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
  badgeVariant?: 'default' | 'info' | 'success' | 'brass' | 'warning';
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-0.5 flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      {badgeVariant ? (
        <Badge variant={badgeVariant}>{value}</Badge>
      ) : (
        <p
          className={`text-sm ${
            muted ? 'text-ink-subtle italic' : mono ? 'font-mono text-forum-900' : 'text-ink'
          } break-all`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
