import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  User,
  DollarSign,
  Building2,
  HeartHandshake,
  FileText,
  Send,
  Eye,
  History,
  MessageSquare,
  ShieldCheck,
  ChevronDown,
  FileUp,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';

interface ProjectFile {
  id: string;
  name: string;
  kind: string;
  size: string;
}

interface HistoryEntry {
  at: string;
  by: string;
  from: string | null;
  to: string;
  note: string;
}

type ProjectStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Published' | 'Rejected' | 'Archived';

interface AuditEntry {
  at: string;
  action: string;
  detail: string;
}

interface LinkedSupport {
  id: string;
  status: string;
}

interface MockProject {
  title: string;
  category: string;
  member: string;
  memberId: string;
  institution: string;
  support: string[];
  status: ProjectStatus;
  priority: string;
  description: string;
  budgetRequested: string;
  budgetCurrency: string;
  startDate: string;
  expectedCompletion: string;
  submittedAt: string;
  files: ProjectFile[];
  history: HistoryEntry[];
  linkedSupport: LinkedSupport;
  funding: Record<string, string>;
}

const mockProject: Record<string, MockProject> = {
  pa3: {
    title: 'Sleep intervention RCT in refugee populations',
    category: 'Clinical Trials',
    member: 'Prof. Henrik Lindberg',
    memberId: 'IFSMHP-2024-000092',
    institution: 'Karolinska Institutet, Sweden',
    support: ['Moral', 'Funding'],
    status: 'Submitted',
    priority: 'Urgent',
    description: 'A parallel-arm, assessor-blinded randomized controlled trial evaluating a culturally adapted brief behavioral sleep intervention (BSI) delivered by community health workers in three refugee reception centers in northern Europe. Primary outcome: PSQI score reduction at 8 weeks. Secondary: depression symptom severity (PHQ-9), PTSD symptoms (PCL-5), retention in care. Target n = 184.',
    budgetRequested: '€42,500',
    budgetCurrency: 'EUR',
    startDate: '2026-10-01',
    expectedCompletion: '2028-03-31',
    submittedAt: '2026-08-18 14:22',
    files: [
      { id: 'f1', name: 'Full Protocol.pdf', kind: 'DOCUMENT', size: '3.1 MB' },
      { id: 'f2', name: 'Statistical Analysis Plan.pdf', kind: 'DOCUMENT', size: '890 KB' },
      { id: 'f3', name: 'Informed Consent Template.pdf', kind: 'DOCUMENT', size: '420 KB' },
      { id: 'f4', name: 'Budget Justification.xlsx', kind: 'DOCUMENT', size: '180 KB' },
      { id: 'f5', name: 'Presentation — Study Design.pptx', kind: 'PRESENTATION', size: '4.7 MB' },
    ],
    history: [
      { at: 'Aug 18, 2026 14:22', by: 'Prof. H. Lindberg', from: null, to: 'Submitted', note: 'Submitted for CRO review with 5 attachments' },
    ],
    linkedSupport: { id: 'sr-00238', status: 'Open' },
    funding: {
      personnel: '€24,000',
      travel: '€7,500',
      materials: '€6,000',
      participantCompensation: '€5,000',
    },
  },
};

const statusFlow: ProjectStatus[] = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published'];
const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Published', 'Archived'],
  Published: ['Archived'],
  Rejected: ['Archived'],
  Archived: [],
};

export default function AdminProjectDetailPage() {
  const { id } = useParams();
  const project = mockProject[id!] ?? mockProject['pa3']!;
  const [currentStatus, setCurrentStatus] = useState<ProjectStatus>(project.status);
  const [history, setHistory] = useState<HistoryEntry[]>(project.history);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [action, setAction] = useState<null | 'approve' | 'reject' | 'note'>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [feedback, setFeedback] = useState('');

  const transitionTo = (nextStatus: ProjectStatus) => {
    if (!allowedTransitions[currentStatus].includes(nextStatus)) {
      setFeedback(`Invalid transition: ${currentStatus} cannot move to ${nextStatus}.`);
      return;
    }
    if (nextStatus === 'Rejected' && !reviewNotes.trim()) {
      setFeedback('Review notes are required when rejecting a project.');
      return;
    }

    const timestamp = new Date().toLocaleString();
    const note = reviewNotes.trim() || `Project status changed to ${nextStatus}.`;
    setCurrentStatus(nextStatus);
    setHistory((entries) => [...entries, { at: timestamp, by: 'CRO Admin', from: currentStatus, to: nextStatus, note }]);
    setNotifications((entries) => [...entries, `Member notified: project is now ${nextStatus}.`]);
    setAuditEntries((entries) => [...entries, { at: timestamp, action: 'ProjectStatusChanged', detail: `${currentStatus} → ${nextStatus}` }]);
    setAction(null);
    setReviewNotes('');
    setFeedback(`Project moved to ${nextStatus}. Status history, notification, and audit log created.`);
  };

  const canTransitionTo = (nextStatus: ProjectStatus) => allowedTransitions[currentStatus].includes(nextStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to All Projects
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant={project.priority === 'Urgent' ? 'danger' : project.priority === 'High' ? 'warning' : 'default'} className="!py-1">
            Priority: {project.priority}
          </Badge>
          <Badge variant="warning">
            <Clock className="h-2.5 w-2.5 mr-1" />
            {currentStatus}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="border-b border-paper-border">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-subtle uppercase tracking-wider font-semibold">{project.category}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold text-forum-900 leading-tight">{project.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <User className="h-4 w-4 text-forum-600" />
                  <span className="font-medium text-forum-900">{project.member}</span>
                  <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{project.memberId}</code>
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Building2 className="h-4 w-4" />
                  {project.institution}
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Clock className="h-4 w-4" />
                  Submitted {project.submittedAt}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canTransitionTo('Under Review') && (
                <Button variant="outline" size="sm" onClick={() => transitionTo('Under Review')}>
                  <Eye className="h-4 w-4" />
                  Start Review
                </Button>
              )}
              {canTransitionTo('Approved') && (
                <Button size="sm" variant="primary" onClick={() => setAction('approve')}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
              )}
              {canTransitionTo('Rejected') && (
                <Button size="sm" variant="outline" onClick={() => setAction('reject')} className="border-danger-600/30 text-danger-600 hover:bg-danger-100">
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
              {canTransitionTo('Published') && (
                <Button size="sm" variant="secondary" onClick={() => transitionTo('Published')}>
                  <Send className="h-4 w-4" />
                  Publish
                </Button>
              )}
              {canTransitionTo('Archived') && (
                <Button size="sm" variant="outline" onClick={() => transitionTo('Archived')}>
                  <Download className="h-4 w-4" />
                  Archive
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {feedback && <div className="border-b border-paper-border bg-forum-50 px-4 py-3 text-sm text-forum-800 sm:px-6">{feedback}</div>}

        <div className="flex items-center gap-2 p-4 sm:p-6 overflow-x-auto border-b border-paper-border">
          {statusFlow.map((s, i) => {
            const passed = i <= statusFlow.indexOf(currentStatus);
            const current = s === currentStatus;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  current ? 'bg-brass-500 text-white ring-2 ring-brass-500/30' : passed ? 'bg-forum-100 text-forum-700' : 'bg-paper border border-paper-border text-ink-subtle'
                }`}>
                  {passed && !current && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {current && <Clock className="h-3.5 w-3.5" />}
                  {s}
                </div>
                {i < statusFlow.length - 1 && <div className={`w-6 sm:w-10 h-0.5 mx-1 ${passed ? 'bg-forum-200' : 'bg-paper-border'}`} />}
              </div>
            );
          })}
          {(currentStatus === 'Rejected' || currentStatus === 'Archived') && (
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${currentStatus === 'Rejected' ? 'bg-danger-100 text-danger-700' : 'bg-ink-subtle/10 text-ink-muted'}`}>
              <XCircle className="h-3.5 w-3.5" />
              {currentStatus}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3 p-4 sm:p-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">Project Description</h3>
              <p className="text-sm text-ink leading-relaxed">{project.description}</p>
            </div>

            <Card className="bg-paper border-paper-border/70">
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                  <FileUp className="h-4.5 w-4.5 text-forum-600" />
                  Project Files ({project.files.length})
                </h3>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {project.files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-md hover:bg-paper-raised transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-md bg-forum-50 text-forum-700 flex items-center justify-center">
                        {f.kind === 'PRESENTATION' ? <FileUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-forum-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-ink-subtle">{f.kind} · {f.size}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {action && (
              <Card className={action === 'approve' ? 'border-success-600/30 ring-2 ring-success-100' : action === 'reject' ? 'border-danger-600/30 ring-2 ring-danger-100' : ''}>
                <CardHeader className={action === 'approve' ? 'bg-success-100/60 rounded-t-lg' : action === 'reject' ? 'bg-danger-100/60 rounded-t-lg' : ''}>
                  <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                    {action === 'approve' ? <CheckCircle2 className="h-5 w-5 text-success-600" /> : action === 'reject' ? <XCircle className="h-5 w-5 text-danger-600" /> : <MessageSquare className="h-5 w-5" />}
                    {action === 'approve' ? 'Confirm Project Approval' : action === 'reject' ? 'Request Revision or Reject' : 'Add Review Note'}
                  </h3>
                </CardHeader>
                <CardContent className="pt-0">
                  <TextArea
                    rows={5}
                    placeholder={action === 'approve' ? 'Reviewer comments. These will be shared with the member…' : action === 'reject' ? 'Required. Describe the specific revisions needed or reason for rejection. Visible to the member.' : 'Private note for audit trail — not visible to the member.'}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-4"
                  />
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    {action === 'approve' ? (
                      <Button variant="primary" onClick={() => transitionTo('Approved')} className="bg-success-600 hover:bg-success-600/90">
                        <ShieldCheck className="h-4 w-4" />
                        Approve &amp; Notify Member
                      </Button>
                    ) : action === 'reject' ? (
                      <Button variant="primary" disabled={!reviewNotes.trim()} onClick={() => transitionTo('Rejected')} className="bg-danger-600 hover:bg-danger-600/90">
                        <Send className="h-4 w-4" />
                        Send Revision Request
                      </Button>
                    ) : (
                      <Button variant="primary">
                        <Send className="h-4 w-4" />
                        Save Note to Audit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                  <History className="h-4.5 w-4.5 text-slateteal-500" />
                  Status History &amp; Audit Trail
                </h3>
              </CardHeader>
              <CardContent className="pt-0">
                <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                  {history.map((h, i) => (
                    <li key={i} className="relative">
                      <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full ring-4 ring-paper-raised ${
                        h.to === 'Submitted' ? 'bg-forum-600' : h.to === 'Approved' ? 'bg-success-600' : h.to === 'Rejected' ? 'bg-danger-600' : h.to === 'Archived' ? 'bg-ink-muted' : 'bg-brass-500'
                      }`} />
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-sm font-medium text-forum-900">
                          {h.from ? `${h.from} → ` : ''}<strong className="text-forum-900">{h.to}</strong>
                        </p>
                        <span className="text-[11px] text-ink-subtle">{h.at}</span>
                        <span className="text-[11px] text-ink-subtle">· by {h.by}</span>
                      </div>
                      <p className="text-sm text-ink-muted mt-0.5">{h.note}</p>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900">Project Details</h3>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm">
                <div className="flex justify-between items-start">
                  <span className="text-ink-subtle">Duration</span>
                  <span className="font-medium text-ink text-right">{project.startDate}<br />→ {project.expectedCompletion}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-ink-subtle">Linked Support</span>
                  <Link to={`/admin/support/${project.linkedSupport.id}`} className="text-forum-700 font-semibold hover:underline">
                    {project.linkedSupport.id.toUpperCase()} · <Badge variant="info">{project.linkedSupport.status}</Badge>
                  </Link>
                </div>
                <div className="pt-2 border-t border-paper-border">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle mb-2">Support Requested</h4>
                  <div className="space-y-1.5">
                    {project.support.map((s: string) => {
                      const Icon = s === 'Funding' ? DollarSign : s === 'Official' ? Building2 : HeartHandshake;
                      return (
                        <span key={s} className="flex items-center gap-1.5 text-sm text-ink">
                          <Icon className="h-4 w-4 text-forum-600" />
                          <span className="font-medium">{s} Support</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
                {project.support.includes('Funding') && (
                  <div className="pt-3 border-t border-paper-border">
                    <div className="flex justify-between pb-2 mb-2 border-b border-paper-border">
                      <span className="text-ink-subtle">Total Requested</span>
                      <span className="font-display text-lg font-bold text-forum-900">{project.budgetRequested}</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {Object.entries(project.funding).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-ink-muted capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-medium text-ink">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-3 mt-2 border-t border-paper-border">
                  <button onClick={() => setAction('note')} className="w-full text-xs font-semibold text-forum-700 hover:text-forum-900 inline-flex items-center justify-center gap-1 rounded-md border border-paper-border py-2 hover:bg-forum-50 transition-colors">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Add Private Admin Note
                  </button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900">Quick Decisions</h3>
              </CardHeader>
              <CardContent className="pt-0 grid grid-cols-2 gap-2">
                <button disabled={!canTransitionTo('Approved')} onClick={() => setAction('approve')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-success-600/20 bg-success-100/30 text-success-600 hover:bg-success-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Approve</span>
                </button>
                <button disabled={!canTransitionTo('Rejected')} onClick={() => setAction('reject')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-danger-600/20 bg-danger-100/30 text-danger-600 hover:bg-danger-600 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <XCircle className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Revisions / Reject</span>
                </button>
                <button disabled={!canTransitionTo('Published')} onClick={() => transitionTo('Published')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-brass-500/20 bg-brass-100/30 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <MessageSquare className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Message Member</span>
                </button>
                <button disabled={!canTransitionTo('Archived')} onClick={() => transitionTo('Archived')} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slateteal-500/20 bg-slateteal-100/30 text-slateteal-700 hover:bg-slateteal-500 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Send to Publication</span>
                </button>
              </CardContent>
            </Card>

            {(notifications.length > 0 || auditEntries.length > 0) && (
              <Card>
                <CardHeader><h3 className="font-display text-base font-semibold text-forum-900">Transition Records</h3></CardHeader>
                <CardContent className="pt-0 space-y-2 text-xs">
                  {notifications.map((notification, index) => <p key={`notification-${index}`} className="text-success-700">Notification: {notification}</p>)}
                  {auditEntries.map((entry, index) => <p key={`audit-${index}`} className="text-ink-muted">Audit: {entry.action} ({entry.detail}) · {entry.at}</p>)}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
