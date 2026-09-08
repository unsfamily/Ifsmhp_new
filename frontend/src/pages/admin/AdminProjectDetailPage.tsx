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
  Archive,
  ShieldCheck,
  ChevronDown,
  FileUp,
  Link2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';
import {
  adminApi,
  type AdminProjectDetail,
  type AdminProjectFile,
  type ProjectStatusLabel,
  type ProjectStatusValue,
} from '../../api/admin';
import { apiClient, normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { formatBytes } from '../../utils/formatBytes';

type ProjectStatus = ProjectStatusLabel;

/** The happy path, rendered as a stepper. Rejected/Archived are terminal chips. */
const statusFlow: ProjectStatus[] = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Published'];

/** Mirrors the server's state machine so buttons only offer legal moves. */
const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  Draft: ['Submitted'],
  Submitted: ['Under Review', 'Approved', 'Rejected'],
  'Under Review': ['Approved', 'Rejected'],
  Approved: ['Published', 'Archived'],
  Published: ['Archived'],
  Rejected: ['Archived', 'Draft'],
  Archived: [],
};

const statusValue: Record<ProjectStatus, ProjectStatusValue> = {
  Draft: 'DRAFT',
  Submitted: 'SUBMITTED',
  'Under Review': 'UNDER_REVIEW',
  Approved: 'APPROVED',
  Rejected: 'REJECTED',
  Published: 'PUBLISHED',
  Archived: 'ARCHIVED',
};

/** Matches the server's minimum; a rejection under this is refused with 422. */
const REJECTION_NOTE_MIN = 10;

function formatDateTime(iso: string | null) {
  if (!iso) return 'Not submitted';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminProjectDetailPage() {
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const { data: project, loading, error } = useApiData<AdminProjectDetail>(
    () => adminApi.project(id!),
    [id, reloadKey],
  );

  const [action, setAction] = useState<null | 'approve' | 'reject'>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [processing, setProcessing] = useState<ProjectStatus | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  const currentStatus = project?.status;
  const canTransitionTo = (next: ProjectStatus) =>
    Boolean(currentStatus && allowedTransitions[currentStatus].includes(next));

  /**
   * Runs a transition, then reloads so the screen reflects what was actually
   * stored — including the server's own history and status, rather than a
   * guess made on the client.
   */
  const transitionTo = async (next: ProjectStatus, note?: string) => {
    if (!project) return;
    setProcessing(next);
    setActionError(null);
    setNotice(null);
    try {
      if (next === 'Approved') await adminApi.approveProject(project.id, note);
      else if (next === 'Rejected') await adminApi.rejectProject(project.id, note ?? '');
      else await adminApi.transitionProject(project.id, statusValue[next], note);
      setNotice(`Project moved to ${next}.${next === 'Approved' || next === 'Rejected' ? ' The member has been notified.' : ''}`);
      setAction(null);
      setReviewNotes('');
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || `Could not move the project to ${next}.`);
    } finally {
      setProcessing(null);
    }
  };

  const fileBlob = async (file: AdminProjectFile) => {
    const res = await apiClient.get(`/files/${file.id}/download`, { responseType: 'blob' });
    return res.data as Blob;
  };

  const viewFile = async (file: AdminProjectFile) => {
    setActionError(null);
    try {
      const url = URL.createObjectURL(await fileBlob(file));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open this file.');
    }
  };

  const downloadFile = async (file: AdminProjectFile) => {
    setActionError(null);
    try {
      const url = URL.createObjectURL(await fileBlob(file));
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not download this file.');
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
        <p className="text-sm font-medium text-forum-900">Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
          <XCircle className="h-7 w-7" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-base font-semibold text-forum-900">Project not found</p>
          <p className="text-sm text-ink-muted mt-1">{error ?? 'This project may have been removed.'}</p>
        </div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={refresh}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
          <Button as="link" to="/admin/projects" size="sm" variant="ghost"><ArrowLeft className="h-3.5 w-3.5" />Back to projects</Button>
        </div>
      </div>
    );
  }

  const status = project.status;
  const rejectionValid = reviewNotes.trim().length >= REJECTION_NOTE_MIN;
  const busy = processing !== null;

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
            {status}
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
                  <span className="font-medium text-forum-900">{project.member ?? 'Unknown member'}</span>
                  {project.memberId && (
                    <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{project.memberId}</code>
                  )}
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Clock className="h-4 w-4" />
                  Submitted {formatDateTime(project.submitted)}
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Eye className="h-4 w-4" />
                  {project.views} views
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canTransitionTo('Under Review') && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => transitionTo('Under Review')}>
                  {processing === 'Under Review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Start Review
                </Button>
              )}
              {canTransitionTo('Approved') && (
                <Button size="sm" variant="primary" disabled={busy} onClick={() => { setAction('approve'); setReviewNotes(''); }}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
              )}
              {canTransitionTo('Rejected') && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setAction('reject'); setReviewNotes(''); }} className="border-danger-600/30 text-danger-600 hover:bg-danger-100">
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
              {canTransitionTo('Published') && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => transitionTo('Published')}>
                  {processing === 'Published' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Publish
                </Button>
              )}
              {canTransitionTo('Draft') && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => transitionTo('Draft')}>
                  {processing === 'Draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Reopen as Draft
                </Button>
              )}
              {canTransitionTo('Archived') && (
                <Button size="sm" variant="outline" disabled={busy} onClick={() => transitionTo('Archived')}>
                  {processing === 'Archived' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  Archive
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        {actionError && (
          <div className="border-b border-paper-border bg-danger-100 px-4 py-3 text-sm text-danger-600 sm:px-6">{actionError}</div>
        )}
        {notice && !actionError && (
          <div className="border-b border-paper-border bg-success-100 px-4 py-3 text-sm text-success-600 sm:px-6">{notice}</div>
        )}

        <div className="flex items-center gap-2 p-4 sm:p-6 overflow-x-auto border-b border-paper-border">
          {statusFlow.map((s, i) => {
            const flowIndex = statusFlow.indexOf(status);
            const passed = flowIndex >= 0 && i <= flowIndex;
            const current = s === status;
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
          {(status === 'Rejected' || status === 'Archived') && (
            <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${status === 'Rejected' ? 'bg-danger-100 text-danger-700' : 'bg-ink-subtle/10 text-ink-muted'}`}>
              <XCircle className="h-3.5 w-3.5" />
              {status}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3 p-4 sm:p-6">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2">Project Description</h3>
              <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{project.description}</p>
            </div>

            <Card className="bg-paper border-paper-border/70">
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                  <FileUp className="h-4.5 w-4.5 text-forum-600" />
                  Project Files ({project.files.length})
                </h3>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {project.files.length === 0 ? (
                  <p className="text-sm text-ink-muted py-2">No files were attached to this project.</p>
                ) : project.files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2.5 rounded-md hover:bg-paper-raised transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 shrink-0 rounded-md bg-forum-50 text-forum-700 flex items-center justify-center">
                        {f.kind === 'PRESENTATION' ? <FileUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-forum-900 truncate">{f.name}</p>
                        <p className="text-[11px] text-ink-subtle">{f.kind} · {formatBytes(f.size)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => viewFile(f)} aria-label={`Open ${f.name}`} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => downloadFile(f)} aria-label={`Download ${f.name}`} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {project.resourceLinks.length > 0 && (
              <Card className="bg-paper border-paper-border/70">
                <CardHeader>
                  <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                    <Link2 className="h-4.5 w-4.5 text-forum-600" />
                    Resource Links ({project.resourceLinks.length})
                  </h3>
                </CardHeader>
                <CardContent className="pt-0 space-y-1.5">
                  {project.resourceLinks.map((l) => (
                    <a
                      key={l.id}
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2.5 rounded-md hover:bg-paper-raised transition-colors"
                    >
                      <p className="text-sm font-medium text-forum-700 hover:underline truncate">{l.label ?? l.url}</p>
                      {l.label && <p className="text-[11px] text-ink-subtle truncate">{l.url}</p>}
                    </a>
                  ))}
                </CardContent>
              </Card>
            )}

            {action && (
              <Card className={action === 'approve' ? 'border-success-600/30 ring-2 ring-success-100' : 'border-danger-600/30 ring-2 ring-danger-100'}>
                <CardHeader className={action === 'approve' ? 'bg-success-100/60 rounded-t-lg' : 'bg-danger-100/60 rounded-t-lg'}>
                  <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                    {action === 'approve' ? <CheckCircle2 className="h-5 w-5 text-success-600" /> : <XCircle className="h-5 w-5 text-danger-600" />}
                    {action === 'approve' ? 'Confirm Project Approval' : 'Request Revision or Reject'}
                  </h3>
                </CardHeader>
                <CardContent className="pt-0">
                  <TextArea
                    rows={5}
                    placeholder={action === 'approve'
                      ? 'Optional reviewer comments. These are shared with the member…'
                      : `Required. Describe the specific revisions needed or the reason for rejection — at least ${REJECTION_NOTE_MIN} characters. Visible to the member.`}
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="mt-4"
                  />
                  {action === 'reject' && !rejectionValid && reviewNotes.length > 0 && (
                    <p className="mt-1.5 text-xs text-danger-600">
                      {REJECTION_NOTE_MIN - reviewNotes.trim().length} more characters needed.
                    </p>
                  )}
                  <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setAction(null); setReviewNotes(''); }}>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                    {action === 'approve' ? (
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() => transitionTo('Approved', reviewNotes.trim() || undefined)}
                        className="bg-success-600 hover:bg-success-600/90"
                      >
                        {processing === 'Approved' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Approve &amp; Notify Member
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        disabled={!rejectionValid || busy}
                        onClick={() => transitionTo('Rejected', reviewNotes.trim())}
                        className="bg-danger-600 hover:bg-danger-600/90"
                      >
                        {processing === 'Rejected' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send Revision Request
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
                {project.history.length === 0 ? (
                  <p className="text-sm text-ink-muted">No status changes recorded yet.</p>
                ) : (
                  <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                    {project.history.map((h) => (
                      <li key={h.id} className="relative">
                        <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full ring-4 ring-paper-raised ${
                          h.to === 'Submitted' ? 'bg-forum-600' : h.to === 'Approved' ? 'bg-success-600' : h.to === 'Rejected' ? 'bg-danger-600' : h.to === 'Archived' ? 'bg-ink-muted' : 'bg-brass-500'
                        }`} />
                        <div className="flex flex-wrap items-baseline gap-2">
                          <p className="text-sm font-medium text-forum-900">
                            {h.from ? `${h.from} → ` : ''}<strong className="text-forum-900">{h.to}</strong>
                          </p>
                          <span className="text-[11px] text-ink-subtle">{formatDateTime(h.at)}</span>
                          <span className="text-[11px] text-ink-subtle">· by {h.actor}</span>
                        </div>
                        {h.note && <p className="text-sm text-ink-muted mt-0.5">{h.note}</p>}
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h3 className="font-display text-base font-semibold text-forum-900">Project Details</h3>
              </CardHeader>
              <CardContent className="pt-0 space-y-3 text-sm">
                <div className="flex justify-between items-start gap-3">
                  <span className="text-ink-subtle shrink-0">Timeline</span>
                  <span className="font-medium text-ink text-right">{project.timeline || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-start gap-3">
                  <span className="text-ink-subtle shrink-0">Budget</span>
                  <span className="font-medium text-ink text-right">{project.budget || 'Not provided'}</span>
                </div>
                <div className="flex justify-between items-start gap-3">
                  <span className="text-ink-subtle shrink-0">Last updated</span>
                  <span className="font-medium text-ink text-right">{formatDateTime(project.updated)}</span>
                </div>
                {project.linkedSupport && (
                  <div className="flex justify-between items-start gap-3">
                    <span className="text-ink-subtle shrink-0">Linked Support</span>
                    <Link to={`/admin/support/${project.linkedSupport.id}`} className="text-forum-700 font-semibold hover:underline">
                      <Badge variant="info">{project.linkedSupport.status}</Badge>
                    </Link>
                  </div>
                )}
                <div className="pt-2 border-t border-paper-border">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle mb-2">Support Requested</h4>
                  {project.support.length === 0 ? (
                    <p className="text-sm text-ink-muted">No support requested</p>
                  ) : (
                    <div className="space-y-1.5">
                      {project.support.map((s) => {
                        const Icon = s === 'Funding' ? DollarSign : s === 'Official' ? Building2 : HeartHandshake;
                        return (
                          <span key={s} className="flex items-center gap-1.5 text-sm text-ink">
                            <Icon className="h-4 w-4 text-forum-600" />
                            <span className="font-medium">{s} Support</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Card>
    </div>
  );
}
