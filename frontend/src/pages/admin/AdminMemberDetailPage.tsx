import { useEffect, useMemo, useState } from 'react';
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
import { apiClient } from '../../api/client';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type ApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

type ProfessionalType =
  | 'Scientist'
  | 'Mental Health Professional'
  | 'Researcher'
  | 'Academician'
  | 'Clinician'
  | 'Policy Advisor'
  | 'Public Health Specialist';

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

interface ReviewEntry {
  id: string;
  reviewer: string;
  role: string;
  timestamp: string;
  action: 'STARTED_REVIEW' | 'ADDED_NOTE' | 'REQUESTED_INFO' | 'RECOMMENDED_APPROVE' | 'RECOMMENDED_REJECT';
  comment: string;
}

interface ApplicationRecord {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  professionalTitle: string;
  professionalType: ProfessionalType;
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
  reviews: ReviewEntry[];
  memberId?: string;
}

const mockApplications: Record<string, ApplicationRecord> = {
  mr1: {
    id: 'mr1',
    fullName: 'Dr. Anika Kapoor',
    email: 'anika.kapoor@aiimsdelhi.edu.in',
    phone: '+91 98113 45678',
    professionalTitle: 'Associate Professor of Clinical Psychology',
    professionalType: 'Mental Health Professional',
    institution: 'All India Institute of Medical Sciences, Delhi',
    country: 'India',
    biography:
      'Fifteen years of clinical practice and academic research specializing in adolescent mental health, PTSD in urban populations, and culturally adapted CBT protocols. Lead researcher on the Delhi Youth Mental Health Initiative, with 32 peer-reviewed publications and 4 national policy contributions. Supervises 6 doctoral candidates and coordinates a 12-site clinical trial across northern India.',
    researchInterests: [
      'Adolescent Mental Health',
      'Culturally Adapted CBT',
      'Suicide Prevention',
      'Digital Mental Health Tools',
      'PTSD & Urban Trauma',
      'Youth Public Health Policy',
    ],
    education: [
      {
        institution: 'All India Institute of Medical Sciences, Delhi',
        degree: 'MD (Psychiatry)',
        field: 'Clinical Psychiatry',
        startYear: '2011',
        endYear: '2014',
      },
      {
        institution: 'Maulana Azad Medical College',
        degree: 'MBBS',
        field: 'Medicine & Surgery',
        startYear: '2006',
        endYear: '2010',
      },
      {
        institution: 'University of Delhi',
        degree: 'B.Sc. (Honours)',
        field: 'Psychology',
        startYear: '2003',
        endYear: '2006',
      },
    ],
    credentials: [
      {
        id: 'c1',
        title: 'MD Psychiatry — Degree Certificate',
        issuer: 'All India Institute of Medical Sciences',
        year: '2014',
        referenceNumber: 'AIIMS/MD/PSY/2014/0417',
        type: 'Postgraduate',
        fileSize: '2.4 MB',
        uploadedAt: '2026-08-17',
      },
      {
        id: 'c2',
        title: 'MBBS Degree Certificate',
        issuer: 'University of Delhi',
        year: '2010',
        referenceNumber: 'DU-MBBS-2010-8832',
        type: 'Degree',
        fileSize: '1.8 MB',
        uploadedAt: '2026-08-17',
      },
      {
        id: 'c3',
        title: 'MCI Permanent Registration Certificate',
        issuer: 'National Medical Commission, India',
        year: '2015',
        referenceNumber: 'MCI-REG-78452-KAP',
        type: 'License',
        fileSize: '540 KB',
        uploadedAt: '2026-08-17',
      },
      {
        id: 'c4',
        title: 'Publication Dossier & Peer Review List',
        issuer: 'Self-attested (32 papers)',
        year: '2026',
        referenceNumber: 'SELF-ATT-0817-KAP-1',
        type: 'Research',
        fileSize: '8.1 MB',
        uploadedAt: '2026-08-17',
      },
      {
        id: 'c5',
        title: 'Professional Reference Letter — Prof. M. Iyer',
        issuer: 'NIMHANS Bangalore',
        year: '2026',
        referenceNumber: 'NIMH-REF-2026-112',
        type: 'Other',
        fileSize: '380 KB',
        uploadedAt: '2026-08-17',
      },
    ],
    applicationId: 'IFSMHP-APP-2026-01847',
    submittedAt: '2026-08-17T09:12:44+05:30',
    status: 'PENDING',
    statusHistory: [
      { status: 'CREATED', timestamp: '2026-08-15T14:22:10+05:30', actor: 'anika.kapoor@aiimsdelhi.edu.in', note: 'Draft application started' },
      { status: 'PENDING', timestamp: '2026-08-17T09:12:44+05:30', actor: 'anika.kapoor@aiimsdelhi.edu.in', note: 'Application submitted with all required documents' },
    ],
    reviews: [
      {
        id: 'r1',
        reviewer: 'Dr. Priya Narayanan',
        role: 'Credentials Officer',
        timestamp: '2026-08-18T11:32:00+05:30',
        action: 'ADDED_NOTE',
        comment: 'Degree certificates appear authentic. Cross-checking MCI registration via NMC public registry — number format matches.',
      },
    ],
  },
  mr3: {
    id: 'mr3',
    fullName: 'Dr. Maya Fernández',
    email: 'maya.fernandez@hcuchile.cl',
    professionalTitle: 'Head, Child & Adolescent Psychiatry Unit',
    professionalType: 'Clinician',
    institution: 'Hospital Clínico Universidad de Chile',
    country: 'Chile',
    biography:
      'Ten years as a child psychiatrist in public and private settings. Lead clinician on early intervention programs for preschool-age anxiety disorders. Principal investigator on a study of inter-generational trauma in Chilean schools with 1,200 enrolled families.',
    researchInterests: [
      'Child Psychiatry',
      'Early Intervention',
      'Inter-generational Trauma',
      'Preschool Mental Health',
      'Public Child Health',
    ],
    education: [
      {
        institution: 'Universidad de Chile',
        degree: 'Especialidad en Psiquiatría Infantil',
        field: 'Child & Adolescent Psychiatry',
        startYear: '2013',
        endYear: '2016',
      },
      {
        institution: 'Universidad de Chile',
        degree: 'Médico Cirujano',
        field: 'Medicine',
        startYear: '2007',
        endYear: '2013',
      },
    ],
    credentials: [
      {
        id: 'c1',
        title: 'Medical Specialist Title',
        issuer: 'Universidad de Chile',
        year: '2016',
        referenceNumber: 'UCH-ESP-2016-1184-FERN',
        type: 'Postgraduate',
        fileSize: '1.2 MB',
        uploadedAt: '2026-08-19',
      },
      {
        id: 'c2',
        title: 'Medical License — Colegio Médico de Chile',
        issuer: 'Colegio Médico de Chile',
        year: '2017',
        referenceNumber: 'CMC-REG-88745-F',
        type: 'License',
        fileSize: '260 KB',
        uploadedAt: '2026-08-19',
      },
    ],
    applicationId: 'IFSMHP-APP-2026-01882',
    submittedAt: '2026-08-19T15:08:12-04:00',
    status: 'UNDER_REVIEW',
    statusHistory: [
      { status: 'CREATED', timestamp: '2026-08-16T10:05:22-04:00', actor: 'maya.fernandez@hcuchile.cl' },
      { status: 'PENDING', timestamp: '2026-08-19T15:08:12-04:00', actor: 'maya.fernandez@hcuchile.cl', note: 'Submitted with 2 credentials' },
      { status: 'UNDER_REVIEW', timestamp: '2026-08-20T08:44:00-04:00', actor: 'Admin — Chief Research Office', note: 'High-priority queue: High priority flag set — well-regarded regional lead' },
    ],
    reviews: [
      {
        id: 'r1',
        reviewer: 'Admin — CRO Office',
        role: 'Administrator',
        timestamp: '2026-08-20T08:44:00-04:00',
        action: 'STARTED_REVIEW',
        comment: 'Opening review. High regional impact profile — recommending expedited pathway with second reviewer.',
      },
    ],
  },
};

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

const typeBadgeMap: Record<ProfessionalType, 'default' | 'info' | 'success' | 'brass' | 'warning'> = {
  Scientist: 'default',
  'Mental Health Professional': 'info',
  Researcher: 'success',
  Academician: 'brass',
  Clinician: 'warning',
  'Policy Advisor': 'info',
  'Public Health Specialist': 'success',
};

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
  const application = mockApplications[id!] ?? mockApplications['mr1']!;

  const [status, setStatus] = useState<ApplicationStatus>(application.status);
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [decision, setDecision] = useState<null | 'approve' | 'reject'>(null);
  const [confirmRejectOpen, setConfirmRejectOpen] = useState(false);
  const [documentPreview, setDocumentPreview] = useState<CredentialDocument | null>(null);
  const [processing, setProcessing] = useState<null | 'start' | 'approve' | 'reject'>(null);
  const [confirmRejectValid, setConfirmRejectValid] = useState(false);

  useEffect(() => {
    setStatus(application.status);
  }, [application.status]);

  const isPendOrReview = status === 'PENDING' || status === 'UNDER_REVIEW';
  const canStartReview = status === 'PENDING';
  const canApprove = isPendOrReview;
  const canReject = isPendOrReview;

  const nextMemberId = useMemo(() => {
    const year = new Date().getFullYear();
    const seq = 278;
    return `IFSMHP-${year}-${seq.toString().padStart(6, '0')}`;
  }, []);

  const startReview = async () => {
    setProcessing('start');
    try {
      await apiClient.patch(`/admin/members/${id}/status`, {
        status: 'UNDER_REVIEW',
        reviewNotes: reviewNotes || 'Review initiated',
      }).catch(() => {
        /* mock path — API not wired */
      });
      setStatus('UNDER_REVIEW');
      const note: ReviewEntry = {
        id: `r-auto-${Date.now()}`,
        reviewer: 'You (CRO Admin)',
        role: 'Administrator',
        timestamp: new Date().toISOString(),
        action: 'STARTED_REVIEW',
        comment: reviewNotes || 'Review opened by CRO Office.',
      };
      application.reviews.unshift(note);
    } finally {
      setProcessing(null);
    }
  };

  const confirmApproval = async () => {
    setProcessing('approve');
    try {
      await apiClient.post(`/admin/members/${id}/approve`, {
        reviewNotes,
      }).catch(() => {});
      setStatus('APPROVED');
      application.memberId = nextMemberId;
      application.statusHistory.push({
        status: 'APPROVED',
        timestamp: new Date().toISOString(),
        actor: 'You (CRO Admin)',
        note: `Approval issued · Member ID ${nextMemberId}`,
      });
      setDecision(null);
    } finally {
      setProcessing(null);
    }
  };

  const rejectionValid = rejectionReason.trim().length >= 12;

  const openRejectConfirm = () => {
    if (!rejectionValid) return;
    setConfirmRejectValid(false);
    setConfirmRejectOpen(true);
  };

  const submitRejection = async () => {
    setProcessing('reject');
    try {
      await apiClient.post(`/admin/members/${id}/reject`, {
        reason: rejectionReason,
        reviewNotes,
      }).catch(() => {});
      setStatus('REJECTED');
      application.statusHistory.push({
        status: 'REJECTED',
        timestamp: new Date().toISOString(),
        actor: 'You (CRO Admin)',
        note: rejectionReason,
      });
      setConfirmRejectOpen(false);
      setDecision(null);
    } finally {
      setProcessing(null);
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

  const initials = application.fullName
    .split(' ')
    .slice(1, 2)
    .concat(application.fullName.split(' ').slice(-1))
    .map((n) => n[0])
    .join('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/members" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Members
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant="brass" className="gap-1">
            <Sparkles className="h-2.5 w-2.5" />
            {DEMO_LABEL}
          </Badge>
          <Button variant="ghost" size="sm">
            <Mail className="h-4 w-4" />
            Email Applicant
          </Button>
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
                onClick={() => setDecision('approve')}
                disabled={processing !== null}
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
                onClick={() => setDecision('reject')}
                disabled={processing !== null}
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
                <InfoRow icon={Badge as any} label="Professional Type" value={application.professionalType} badgeVariant={typeBadgeMap[application.professionalType]} />
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">Biography</h4>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{application.biography}</p>
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
              {application.reviews.length === 0 ? (
                <p className="text-sm text-ink-subtle text-center py-6">No review activity yet.</p>
              ) : (
                application.reviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-paper-border bg-paper p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <p className="text-sm font-medium text-forum-900">{r.reviewer}</p>
                      <Badge variant="info">{r.role}</Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                        <Clock className="h-3 w-3" />
                        {formatDateFull(r.timestamp)}
                      </span>
                    </div>
                    <Badge variant="default">{r.action.replace(/_/g, ' ')}</Badge>
                    <p className="text-sm text-ink mt-2 leading-relaxed">{r.comment}</p>
                  </div>
                ))
              )}

              <div className="border-t border-paper-border pt-3 mt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">Add Review Note</h4>
                <TextArea
                  rows={3}
                  placeholder="Document credential cross-checks, policy references, or findings. Included in the audit trail."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
                <Button size="sm" className="mt-2 w-full justify-center">
                  <Send className="h-3.5 w-3.5" />
                  Save to Review History
                </Button>
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
                  <p className="mt-2 font-mono text-2xl font-bold text-forum-900 tracking-tight">{nextMemberId}</p>
                  <p className="mt-2 text-xs text-ink-subtle">Projected sequence · {new Date().getFullYear()} cohort</p>
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
            <Card className="border-success-600/30 ring-2 ring-success-100">
              <CardHeader className="bg-success-100/60 rounded-t-lg">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2 text-success-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Confirm Approval
                </h3>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">
                    On confirmation, the server will perform these 7 actions:
                  </p>
                  <ul className="space-y-2 text-sm">
                    <ApprovalStep icon={IdCard} text={`Generate Member ID server-side (projected: ${nextMemberId})`} done />
                    <ApprovalStep icon={UserCheck as any} text="Activate user account — promote to ACTIVE" done />
                    <ApprovalStep icon={Briefcase} text="Create Member Profile record if missing" done />
                    <ApprovalStep icon={Clock} text="Record approval timestamp with admin attribution" done />
                    <ApprovalStep icon={Bell} text="Create in-app notification for the applicant" done />
                    <ApprovalStep icon={Send} text="Queue welcome email job (with ID + credentials)" done />
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
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setDecision(null)} disabled={processing === 'approve'}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button className="w-full sm:w-auto bg-success-600 hover:bg-success-600/90" onClick={confirmApproval} disabled={processing === 'approve'}>
                    {processing === 'approve' ? <Clock3 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Confirm Approval &amp; Issue ID
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {decision === 'reject' && (
            <Card className="border-danger-600/30 ring-2 ring-danger-100">
              <CardHeader className="bg-danger-100/60 rounded-t-lg">
                <h3 className="font-display text-lg font-semibold flex items-center gap-2 text-danger-600">
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
                  <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setDecision(null)} disabled={processing === 'reject'}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  <Button
                    className="w-full sm:w-auto bg-danger-600 hover:bg-danger-600/90"
                    onClick={openRejectConfirm}
                    disabled={!rejectionValid || processing === 'reject'}
                  >
                    <XCircle className="h-4 w-4" />
                    Review &amp; Confirm Rejection
                  </Button>
                </div>
              </CardContent>
            </Card>
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
