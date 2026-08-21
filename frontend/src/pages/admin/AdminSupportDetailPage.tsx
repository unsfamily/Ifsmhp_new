import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  FileText,
  Send,
  Eye,
  History,
  MessageSquare,
  ChevronDown,
  Headphones,
  AlertCircle,
  DollarSign,
  Building2,
  HeartHandshake,
  Paperclip,
  Calendar,
  Link as LinkIcon,
  FolderKanban,
  Play,
  Check,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea, Checkbox } from '../../components/common/Input';

type SupportType = 'Moral Support' | 'Official Support' | 'Funding Support';

interface Attachment {
  name: string;
  size: string;
  type?: string;
}

interface LinkedRecord {
  label: string;
  id: string;
  name: string;
}

interface MessageItem {
  from: 'member' | 'admin' | 'system';
  name: string;
  at: string;
  text: string;
}

interface HistoryEntry {
  at: string;
  by: string;
  from: string | null;
  to: string;
  note: string;
}

interface MockSupport {
  id: string;
  subject: string;
  member: string;
  memberId: string;
  institution: string;
  project: string;
  projectId: string;
  requestType: SupportType;
  requestedSupport: string[];
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';
  priority: 'Urgent' | 'High' | 'Standard' | 'Low';
  created: string;
  SLA: string;
  description: string;
  attachments: Attachment[];
  linked: LinkedRecord[];
  messages: MessageItem[];
  history: HistoryEntry[];
}

const mock: Record<string, MockSupport> = {
  'sr-00240': {
    id: 'SR-00240',
    subject: 'Official letter of support for ethics submission (REC UK)',
    member: 'Prof. M. Whitfield',
    memberId: 'IFSMHP-2024-000045',
    institution: 'UCL · Dept. of Clinical Neuroscience',
    project: 'PA-00005 Psilocybin therapy protocol',
    projectId: 'pa5',
    requestType: 'Official Support',
    requestedSupport: [
      'Formal institutional support letter on IFSMHP letterhead',
      'Explicit confirmation of IFSMHP endorsement of study design',
      'Ethical clearance number issuance upon REC approval',
    ],
    status: 'Under Review',
    priority: 'High',
    created: 'Aug 19, 2026 at 09:12',
    SLA: 'By Aug 26, 2026 (REC deadline)',
    description:
      'Dear CRO Office — The London-Cambridge Research Ethics Committee (REC) requires a formal institutional support letter from IFSMHP for our protocol: "Psilocybin-assisted therapy for existential distress in advanced palliative care (Protocol CRO-PEACE-4)." The committee needs explicit confirmation of endorsement, support of the study design, and that IFSMHP will issue the ethical clearance number upon approval. Letterhead template, protocol PDF, and the exact REC-requested clauses are attached.',
    attachments: [
      { name: 'REC-request-clauses.pdf', size: '340 KB', type: 'PDF' },
      { name: 'Protocol_CRO-PEACE-4.pdf', size: '1.8 MB', type: 'PDF' },
      { name: 'Proposed_Letterhead_Draft.docx', size: '92 KB', type: 'DOCX' },
    ],
    linked: [
      { label: 'Project', id: 'pa5', name: 'PA-00005 Psilocybin therapy protocol' },
      { label: 'Publication', id: 'pub5', name: 'Psilocybin protocol (pub #5)' },
    ],
    messages: [
      { from: 'member', name: 'Prof. M. Whitfield', at: 'Aug 19, 09:12', text: 'Submitting the three required documents. Thank you for the quick turn-around given the August 26 deadline.' },
      { from: 'system', name: 'System', at: 'Aug 19, 09:13', text: 'Auto-assigned to CRO queue. Cross-linked to Project PA-00005 and Publication PUB-00005.' },
      { from: 'admin', name: 'CRO Office', at: 'Aug 19, 16:42', text: 'Legal review of the requested clauses in progress. Aim is to issue the letter within 48 hours if alignment.' },
    ],
    history: [
      { at: 'Aug 19, 2026 09:12', by: 'Prof. M. Whitfield', from: null, to: 'Pending', note: 'Request submitted with 3 attachments, High priority' },
      { at: 'Aug 19, 2026 09:13', by: 'System', from: 'Pending', to: 'Under Review', note: 'Triage: auto-flagged for expedited review (REC deadline). CRO Office notified.' },
      { at: 'Aug 19, 2026 16:42', by: 'CRO Office', from: 'Under Review', to: 'Under Review', note: 'Admin note: Legal reviewing requested clauses (private). External counsel engaged.' },
    ],
  },
  'sr-00241': {
    id: 'SR-00241',
    subject: 'Funding support for PTSD intervention study — 4th cohort extension',
    member: 'Dr. A. Kapoor',
    memberId: 'IFSMHP-2024-000176',
    institution: 'NIMHANS Bangalore',
    project: 'PTSD intervention study',
    projectId: 'pa3',
    requestType: 'Funding Support',
    requestedSupport: [
      'Bridge funding extension for 4th cohort (6 months)',
      'Endorsement for supplementary grant application to ICMR',
      'Budget review & variance justification letter',
    ],
    status: 'Pending',
    priority: 'Urgent',
    created: 'Aug 20, 2026 at 11:04',
    SLA: 'Initial triage by Aug 22, 2026',
    description:
      'Enrollment rates for the PTSD intervention RCT exceeded our original target by 38%, making a 4th cohort statistically feasible and scientifically valuable. The site team has capacity to run the extension within current infrastructure, but requires 6 months of bridge funding until the main ICMR supplementary grant decision is rendered. Attached: enrollment report, budget variance, and draft ICMR supplementary application pre-review version.',
    attachments: [
      { name: 'Cohort-4-Enrollment-Report.xlsx', size: '210 KB', type: 'XLSX' },
      { name: 'Budget-Variance-Cohort4.pdf', size: '480 KB', type: 'PDF' },
      { name: 'ICMR-Supplementary-Draft.pdf', size: '1.3 MB', type: 'PDF' },
    ],
    linked: [{ label: 'Project', id: 'pa3', name: 'PTSD intervention study' }],
    messages: [
      { from: 'member', name: 'Dr. A. Kapoor', at: 'Aug 20, 11:04', text: 'Member: "Enrollment rates exceeded target; 4th cohort feasible if IFSMHP can endorse…"' },
    ],
    history: [
      { at: 'Aug 20, 2026 11:04', by: 'Dr. A. Kapoor', from: null, to: 'Pending', note: 'Request submitted. Urgent priority — ICMR deadline Sep 05.' },
    ],
  },
};

const priorityMap: Record<MockSupport['priority'], 'danger' | 'warning' | 'default' | 'info'> = {
  Urgent: 'danger',
  High: 'warning',
  Standard: 'default',
  Low: 'info',
};

const statusMap: Record<MockSupport['status'], { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Pending: { variant: 'info', icon: Clock },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Completed: { variant: 'brass', icon: CheckCircle2 },
  Rejected: { variant: 'danger', icon: XCircle },
};

const requestTypeIcon: Record<SupportType, typeof DollarSign> = {
  'Funding Support': DollarSign,
  'Official Support': Building2,
  'Moral Support': HeartHandshake,
};

const requestTypeVariant: Record<SupportType, 'brass' | 'info' | 'success'> = {
  'Funding Support': 'brass',
  'Official Support': 'info',
  'Moral Support': 'success',
};

export default function AdminSupportDetailPage() {
  const { id } = useParams();
  const t = mock[id!] ?? mock['sr-00240']!;
  const statusConfig = statusMap[t.status];
  const SIcon = statusConfig.icon;

  type ActionKind = null | 'start' | 'approve' | 'reject' | 'complete';
  const [action, setAction] = useState<ActionKind>(null);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [reply, setReply] = useState('');

  const notesRequired = action === 'start' || action === 'reject' || action === 'complete';
  const notesOptional = action === 'approve';
  const canSubmit = (notesRequired ? notes.trim().length > 0 : true) && (action === 'reject' || action === 'approve' ? confirmed : true);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/support" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Support Queue
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant="default" className="!py-1 font-mono text-[11px] uppercase tracking-wider">{t.id}</Badge>
          <Badge variant={priorityMap[t.priority]} className="!py-1">
            {t.priority === 'Urgent' && <AlertCircle className="h-2.5 w-2.5 mr-1" />}
            {t.priority} Priority
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-br from-forum-50 to-brass-100/60 rounded-t-xl border-b border-paper-border sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant={requestTypeVariant[t.requestType]} className="inline-flex items-center gap-1">
                  {(() => { const CIcon = requestTypeIcon[t.requestType]; return <CIcon className="h-3 w-3 mr-1" />; })()}
                  {t.requestType}
                </Badge>
                <Badge variant={statusConfig.variant}>
                  <SIcon className="h-2.5 w-2.5 mr-1" />
                  {t.status}
                </Badge>
                <span className="text-xs text-ink-subtle inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {t.SLA}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{t.subject}</h1>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Member</p>
                    <p className="font-medium text-forum-900 truncate">{t.member}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Member ID</p>
                    <code className="font-mono text-xs bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{t.memberId}</code>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FolderKanban className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Project</p>
                    <Link to={`/admin/projects/${t.projectId}`} className="font-medium text-forum-900 hover:text-forum-700 truncate block">
                      {t.project}
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Headphones className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Request Type</p>
                    <p className="font-medium text-forum-900">{t.requestType}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Institution</p>
                    <p className="font-medium text-forum-900 truncate">{t.institution}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Submission Date</p>
                    <p className="font-medium text-forum-900">{t.created}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 shrink-0">
              {t.status === 'Pending' && (
                <Button variant="primary" size="sm" onClick={() => { setAction('start'); setNotes(''); setConfirmed(false); }}>
                  <Play className="h-4 w-4" />
                  Start Review
                </Button>
              )}
              {(t.status === 'Pending' || t.status === 'Under Review') && (
                <>
                  <Button variant="primary" size="sm" onClick={() => { setAction('approve'); setNotes(''); setConfirmed(false); }}>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => { setAction('reject'); setNotes(''); setConfirmed(false); }}>
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {t.status === 'Approved' && (
                <Button size="sm" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" onClick={() => { setAction('complete'); setNotes(''); setConfirmed(false); }}>
                  <Check className="h-4 w-4" />
                  Mark Completed
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Request Details
              </h3>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-2">Request Description</p>
                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{t.description}</p>
              </div>
              <div className="border-t border-paper-border pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-3 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Requested Support
                </p>
                <ul className="space-y-2.5">
                  {t.requestedSupport.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-forum-100 text-forum-700 text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-sm text-ink leading-snug">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-forum-600" />
                Attached Documents ({t.attachments.length})
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid sm:grid-cols-2 gap-2">
                {t.attachments.map((a) => (
                  <div key={a.name} className="flex items-center justify-between p-3.5 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-md bg-forum-50 text-forum-700 ring-1 ring-forum-100">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-forum-900 truncate">{a.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {a.type && (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 bg-paper text-[9px] font-semibold uppercase tracking-wider text-ink-subtle border border-paper-border">
                              {a.type}
                            </span>
                          )}
                          <span className="text-[11px] text-ink-subtle">{a.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="p-2 rounded-md text-ink-muted hover:bg-paper hover:text-forum-700 transition-colors" aria-label="Preview">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 rounded-md text-ink-muted hover:bg-paper hover:text-forum-700 transition-colors" aria-label="Download">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {action && (
            <Card className={
              action === 'start' ? 'border-info-500/30 ring-2 ring-slateteal-100' :
              action === 'approve' ? 'border-success-600/30 ring-2 ring-success-100' :
              action === 'complete' ? 'border-brass-500/30 ring-2 ring-brass-100' :
              'border-danger-600/30 ring-2 ring-danger-100'
            }>
              <CardHeader className={
                action === 'start' ? 'bg-slateteal-100/60 rounded-t-lg' :
                action === 'approve' ? 'bg-success-100/60 rounded-t-lg' :
                action === 'complete' ? 'bg-brass-100/60 rounded-t-lg' :
                'bg-danger-100/60 rounded-t-lg'
              }>
                <h3 className="font-display text-lg font-semibold flex items-center gap-2" style={{
                  color: action === 'approve' ? '#1F6B41' : action === 'complete' ? '#3F7825' : action === 'reject' ? '#A32B2B' : '#1E3A5F'
                }}>
                  {action === 'start' && <><Play className="h-5 w-5" />Start Review — Begin Triage</>}
                  {action === 'approve' && <><CheckCircle2 className="h-5 w-5" />Approve Support Request</>}
                  {action === 'complete' && <><Check className="h-5 w-5" />Mark as Completed</>}
                  {action === 'reject' && <><XCircle className="h-5 w-5" />Reject / Decline Request</>}
                </h3>
              </CardHeader>
              <CardContent className="pt-0">
                <TextArea
                  rows={5}
                  label={
                    <span className="flex items-center gap-1.5">
                      Admin Notes / Decision Rationale
                      {(notesRequired) && <span className="text-danger-600">*</span>}
                      {notesOptional && <span className="text-[11px] font-normal text-ink-subtle">(recommended)</span>}
                    </span>
                  }
                  placeholder={
                    action === 'start' ? 'Describe scope of review, assignment rationale, and next steps. Logged in audit trail and visible to admins.' :
                    action === 'approve' ? 'Include funding amount, endorsements being issued, action items, deliverables, and timeline. Sent to member.' :
                    action === 'complete' ? 'Closing summary — delivered artifacts, signatories, outcome, and member follow-up (if any). Visible to member and audit.' :
                    'Required: specific, actionable reason the request is declined. Include guidance for re-submission (when applicable), re-scoping suggestions, and contact for appeal. Sent to member.'
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  hint={
                    action === 'start' ? 'These notes are internal — not sent to the member.' :
                    action === 'reject' ? 'Reason will be included in the rejection notice sent to the member.' :
                    'Message will be sent to the member and recorded in the audit trail.'
                  }
                  className="mt-3"
                />
                {notesRequired && notes.trim().length === 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-danger-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Notes are required for this action.
                  </div>
                )}

                {(action === 'approve' || action === 'reject') && (
                  <div className="mt-4">
                    <Checkbox
                      label={
                        action === 'approve'
                          ? 'I confirm this approval is within my authority, budget (if any) is available, and the decision is accurate.'
                          : 'I confirm this rejection is justified and I have included a clear, actionable reason for the member.'
                      }
                      checked={confirmed}
                      onChange={(e) => setConfirmed((e.target as HTMLInputElement).checked)}
                    />
                  </div>
                )}

                <div className="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setAction(null); setNotes(''); setConfirmed(false); }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  {action === 'start' && (
                    <Button variant="primary" className="bg-slateteal-600 hover:bg-slateteal-600/90" disabled={!canSubmit}>
                      <Eye className="h-4 w-4" />
                      Start Review
                    </Button>
                  )}
                  {action === 'approve' && (
                    <Button variant="primary" className="bg-success-600 hover:bg-success-600/90" disabled={!canSubmit}>
                      <Send className="h-4 w-4" />
                      Approve &amp; Send Response
                    </Button>
                  )}
                  {action === 'complete' && (
                    <Button className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" disabled={!canSubmit}>
                      <Check className="h-4 w-4" />
                      Mark Complete &amp; Notify
                    </Button>
                  )}
                  {action === 'reject' && (
                    <Button variant="primary" className="bg-danger-600 hover:bg-danger-600/90" disabled={!canSubmit}>
                      <Send className="h-4 w-4" />
                      Send Rejection Notice
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-forum-600" />
                Related Conversation &amp; Messages ({t.messages.length})
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {t.messages.map((m, i) => (
                <div key={i} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${
                    m.from === 'system' ? 'bg-slateteal-100 text-slateteal-700 rounded-lg' :
                    m.from === 'admin' ? 'bg-forum-600 text-white rounded-2xl rounded-br-md' :
                    'bg-paper-raised border border-paper-border text-ink rounded-2xl rounded-bl-md'
                  } px-4 py-3`}>
                    <div className={`flex items-center gap-2 mb-1 ${m.from === 'admin' ? 'text-forum-200' : m.from === 'system' ? 'text-slateteal-700/70' : 'text-ink-subtle'}`}>
                      <span className="text-xs font-semibold">{m.name}</span>
                      <span className="text-[10px]">· {m.at}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                </div>
              ))}
              <div className="border-t border-paper-border pt-4 mt-6">
                <TextArea
                  rows={3}
                  label="Send a message to the member"
                  placeholder="Type your message here. Sent as CRO Office and visible in the audit trail."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="mb-3"
                />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <Badge variant="info" className="w-fit">Sent as CRO Office · logged in audit</Badge>
                  <Button variant="primary">
                    <Send className="h-4 w-4" />
                    Send Message
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <History className="h-5 w-5 text-slateteal-500" />
                Status History &amp; Audit Trail
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-5">
                {t.history.map((h, i) => {
                  const toIcon = statusMap[h.to as keyof typeof statusMap]?.icon ?? AlertCircle;
                  const StatusIcon = toIcon;
                  return (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[27px] top-0.5 h-5 w-5 rounded-full ring-4 ring-paper-raised flex items-center justify-center text-white ${
                        h.to === 'Pending' ? 'bg-slateteal-600' :
                        h.to === 'Under Review' ? 'bg-warning-600' :
                        h.to === 'Approved' ? 'bg-success-600' :
                        h.to === 'Completed' ? 'bg-brass-500' :
                        h.to === 'Rejected' ? 'bg-danger-600' :
                        'bg-forum-600'
                      }`}>
                        <StatusIcon className="h-3 w-3" />
                      </span>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-sm font-medium text-forum-900">
                          {h.from && (
                            <>
                              <span className="text-ink-subtle font-normal inline-flex items-center gap-1">
                                {h.from}
                                <span className="text-ink-subtle/60">→</span>
                              </span>{' '}
                            </>
                          )}
                          <Badge variant={statusMap[h.to as keyof typeof statusMap]?.variant ?? 'default'}>
                            {h.to}
                          </Badge>
                        </p>
                        <span className="text-[11px] text-ink-subtle">{h.at}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          by {h.by}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted mt-1.5 leading-relaxed bg-paper/60 rounded-md border border-paper-border p-3">
                        {h.note}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Decision Section</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {t.status === 'Pending' && (
                <div className="rounded-xl border border-info-500/30 bg-slateteal-50 p-4">
                  <p className="text-sm font-semibold text-slateteal-800 flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Awaiting Triage
                  </p>
                  <p className="text-xs text-slateteal-700 mt-1">This request is in the pending queue. Click &quot;Start Review&quot; to begin triage and assign it out.</p>
                </div>
              )}
              {t.status === 'Under Review' && (
                <div className="rounded-xl border border-warning-500/30 bg-warning-50 p-4">
                  <p className="text-sm font-semibold text-warning-800 flex items-center gap-1.5">
                    <Eye className="h-4 w-4" />
                    Under Active Review
                  </p>
                  <p className="text-xs text-warning-700 mt-1">Triage in progress. Legal / scientific review underway.</p>
                </div>
              )}
              {t.status === 'Approved' && (
                <div className="rounded-xl border border-success-600/30 bg-success-50 p-4">
                  <p className="text-sm font-semibold text-success-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Request Approved
                  </p>
                  <p className="text-xs text-success-700 mt-1">Deliver the commitment and then mark completed.</p>
                </div>
              )}
              {t.status === 'Completed' && (
                <div className="rounded-xl border border-brass-500/30 bg-brass-50 p-4">
                  <p className="text-sm font-semibold" style={{ color: '#3F7825' }}>
                    <Check className="h-4 w-4 inline mr-1" />
                    Resolved / Completed
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#5A6415' }}>All deliverables issued &amp; member notified.</p>
                </div>
              )}
              {t.status === 'Rejected' && (
                <div className="rounded-xl border border-danger-600/30 bg-danger-50 p-4">
                  <p className="text-sm font-semibold text-danger-800 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    Request Declined
                  </p>
                  <p className="text-xs text-danger-700 mt-1">Member has been notified with reason and (if applicable) re-submission guidance.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Quick Actions</h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              {t.status === 'Pending' && (
                <button onClick={() => { setAction('start'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slateteal-500/20 bg-slateteal-100/30 text-slateteal-700 hover:bg-slateteal-600 hover:text-white transition-colors">
                  <Play className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Start Review</span>
                </button>
              )}
              {(t.status === 'Pending' || t.status === 'Under Review') && (
                <>
                  <button onClick={() => { setAction('approve'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-success-600/20 bg-success-100/30 text-success-600 hover:bg-success-600 hover:text-white transition-colors">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Approve</span>
                  </button>
                  <button onClick={() => { setAction('reject'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-danger-600/20 bg-danger-100/30 text-danger-600 hover:bg-danger-600 hover:text-white transition-colors">
                    <XCircle className="h-5 w-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Decline</span>
                  </button>
                </>
              )}
              {t.status === 'Approved' && (
                <button onClick={() => { setAction('complete'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-brass-500/20 bg-brass-100/30 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors col-span-2">
                  <Check className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Mark Completed</span>
                </button>
              )}
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-brass-500/20 bg-brass-100/30 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors">
                <FileText className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Generate Letter</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slateteal-500/20 bg-slateteal-100/30 text-slateteal-700 hover:bg-slateteal-500 hover:text-white transition-colors">
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Escalate to SAB</span>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Linked Records</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {t.linked.map((l) => (
                <Link to={`/admin/${l.label.toLowerCase()}s/${l.id}`} key={l.id} className="block">
                  <div className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-md bg-forum-50 text-forum-700">
                        <LinkIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle">{l.label}</p>
                        <p className="text-sm font-medium text-forum-900 truncate">{l.name}</p>
                      </div>
                    </div>
                    <Eye className="h-4 w-4 text-ink-subtle shrink-0" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-forum-600" />
                Member Summary
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to={`/admin/members/lookup?mid=${t.memberId}`} className="block">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {t.member.split(' ').slice(1, 2).concat(t.member.split(' ').slice(-1)).map((n: string) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-forum-900 truncate">{t.member}</p>
                    <p className="text-[11px] text-ink-subtle font-mono truncate">{t.memberId}</p>
                  </div>
                </div>
              </Link>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-forum-900">7</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Previous SRs</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-success-600">6</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Approved</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-danger-600">1</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
