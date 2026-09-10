import { useEffect, useState } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea, Checkbox, SelectInput } from '../../components/common/Input';
import { supportApi, supportDate, type SupportPriority } from '../../api/support';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useApiData } from '../../hooks/useApiData';
import { useAuth } from '../../context/AuthContext';
import { normalizeError } from '../../api/client';
import { downloadAttachment, openAttachmentInTab } from '../../api/messaging';
import { formatBytes } from '../../utils/formatBytes';
import SupportConversation from '../../components/support/SupportConversation';

type SupportType = 'Moral Support' | 'Official Support' | 'Funding Support';

type AdminStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';

const priorityMap: Record<SupportPriority, 'danger' | 'warning' | 'default' | 'info'> = {
  Urgent: 'danger',
  High: 'warning',
  Standard: 'default',
  Low: 'info',
};

const statusMap: Record<AdminStatus, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
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
  const { user } = useAuth();
  return user && id ? <AdminSupportDetail key={`${user.id}:${id}`} id={id} /> : null;
}

function AdminSupportDetail({ id }: { id: string }) {
  const location = useLocation();
  const { data, initialLoading, error, refresh } = usePolledApiData(() => supportApi.detail(true, id), [id], 10000);
  const admins = useApiData(supportApi.assignees, []);

  type ActionKind = null | 'start' | 'approve' | 'reject' | 'complete';
  const [action, setAction] = useState<ActionKind>(null);
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => {
    if (data?.status === 'Pending' && location.hash === '#triage') setAction('start');
    if (data?.status === 'Approved' && location.hash === '#complete') setAction('complete');
  }, [data?.status, location.hash]);
  const decide = async () => {
    if (!data || !action || pending) return;
    setPending(true); setActionError(null); setSuccess(null);
    try {
      await supportApi.decide(id, action === 'start' ? 'review' : action, notes, data.lastUpdate);
      setAction(null); setNotes(''); setConfirmed(false); setSuccess('Decision saved.'); refresh();
    } catch (failure) { setActionError(normalizeError(failure).message); refresh(); }
    finally { setPending(false); }
  };
  const update = async (patch: { priority?: SupportPriority; assignedAdminId?: string | null }) => {
    if (!data || pending) return;
    setPending(true); setActionError(null); setSuccess(null);
    try { await supportApi.update(id, { ...patch, expectedUpdatedAt: data.lastUpdate }); setSuccess('Request updated.'); refresh(); }
    catch (failure) { setActionError(normalizeError(failure).message); refresh(); }
    finally { setPending(false); }
  };

  const notesRequired = action === 'start' || action === 'reject' || action === 'complete';
  const notesOptional = action === 'approve';
  const canSubmit = !pending && (notesRequired ? notes.trim().length > 0 : true) && (action === 'reject' || action === 'approve' ? confirmed : true);

  if (!data) return <Card><CardContent className="p-6">
    <Link to={`/admin/support${location.search}`} className="text-sm text-forum-700">Back to Support Queue</Link>
    <p role={error ? 'alert' : 'status'} className="mt-4 text-sm text-ink-muted">{initialLoading ? 'Loading support request...' : error ?? 'Support request not found'}</p>
    {error && <Button variant="ghost" onClick={refresh}><RefreshCw className="h-4 w-4" />Retry</Button>}
  </CardContent></Card>;
  const t = { ...data, created: supportDate(data.submitted), SLA: data.requiredBy ? `Required by ${supportDate(data.requiredBy)}` : 'No deadline provided', requestedSupport: data.type.map((kind) => `${kind} Support`) };
  const statusConfig = statusMap[t.status as AdminStatus];
  const SIcon = statusConfig.icon;

  return (
    <div className="space-y-6" style={{ overflowWrap: 'anywhere' }}>
      {(actionError || error) && <p role="alert" className="text-sm text-danger-600">{actionError || error} <Button size="sm" variant="ghost" onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</Button></p>}
      {success && <p role="status" className="text-sm text-success-600">{success}</p>}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to={`/admin/support${location.search}`} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
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
                {t.type.map((kind) => <Badge key={kind} variant={requestTypeVariant[`${kind} Support`]} className="inline-flex items-center gap-1">
                  {(() => { const CIcon = requestTypeIcon[`${kind} Support`]; return <CIcon className="h-3 w-3 mr-1" />; })()}
                  {kind} Support
                </Badge>)}
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
                    <code className="font-mono text-xs bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{t.memberId ?? 'Not provided'}</code>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FolderKanban className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Project</p>
                    <Link to={t.projectId ? `/admin/projects/${t.projectId}` : '#'} aria-disabled={!t.projectId} className="font-medium text-forum-900 hover:text-forum-700 truncate block">
                      {t.project}
                    </Link>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Headphones className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Request Type</p>
                    <p className="font-medium text-forum-900">{t.requestedSupport.join(', ') || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-forum-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Institution</p>
                    <p className="font-medium text-forum-900 truncate">{t.institution ?? 'Not provided'}</p>
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
                <Button variant="primary" size="sm" disabled={pending} onClick={() => { setAction('start'); setNotes(''); setConfirmed(false); }}>
                  <Play className="h-4 w-4" />
                  Start Review
                </Button>
              )}
              {(t.status === 'Pending' || t.status === 'Under Review') && (
                <>
                  <Button variant="primary" size="sm" disabled={pending} onClick={() => { setAction('approve'); setNotes(''); setConfirmed(false); }}>
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                  <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" disabled={pending} onClick={() => { setAction('reject'); setNotes(''); setConfirmed(false); }}>
                    <XCircle className="h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              {t.status === 'Approved' && (
                <Button size="sm" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" disabled={pending} onClick={() => { setAction('complete'); setNotes(''); setConfirmed(false); }}>
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
                {t.adminResponse && <div className="mt-4"><p className="mb-2 text-xs font-semibold text-ink-subtle">Latest Decision Response</p><p className="text-sm text-ink-muted whitespace-pre-wrap">{t.adminResponse}</p></div>}
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
                {t.attachments.length === 0 && <p className="text-sm text-ink-muted">No documents attached.</p>}
                {t.attachments.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3.5 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
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
                          <span className="text-[11px] text-ink-subtle">{formatBytes(a.size)}{a.internal ? ' · Internal only' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button className="p-2 rounded-md text-ink-muted hover:bg-paper hover:text-forum-700 transition-colors" aria-label="Preview" title="Preview" disabled={a.type !== 'application/pdf' && !a.type.startsWith('image/')} onClick={() => void openAttachmentInTab(a.id).catch(() => setActionError('This document is unavailable.'))}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 rounded-md text-ink-muted hover:bg-paper hover:text-forum-700 transition-colors" aria-label="Download" title="Download" onClick={() => void downloadAttachment(a.id, a.name).catch(() => setActionError('This document is unavailable.'))}>
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
                  value={notes} maxLength={4000} disabled={pending}
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
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => { setAction(null); setNotes(''); setConfirmed(false); }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  {action === 'start' && (
                    <Button variant="primary" className="bg-slateteal-600 hover:bg-slateteal-600/90" disabled={!canSubmit} onClick={() => void decide()}>
                      <Eye className="h-4 w-4" />
                      Start Review
                    </Button>
                  )}
                  {action === 'approve' && (
                    <Button variant="primary" className="bg-success-600 hover:bg-success-600/90" disabled={!canSubmit} onClick={() => void decide()}>
                      <Send className="h-4 w-4" />
                      Approve &amp; Send Response
                    </Button>
                  )}
                  {action === 'complete' && (
                    <Button className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" disabled={!canSubmit} onClick={() => void decide()}>
                      <Check className="h-4 w-4" />
                      Mark Complete &amp; Notify
                    </Button>
                  )}
                  {action === 'reject' && (
                    <Button variant="primary" className="bg-danger-600 hover:bg-danger-600/90" disabled={!canSubmit} onClick={() => void decide()}>
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
              <SupportConversation detail={data} admin onSent={refresh} />
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
                        <span className="text-[11px] text-ink-subtle">{new Date(h.at).toLocaleString()}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          by {h.by}
                        </span>
                      </div>
                      <p className="text-sm text-ink-muted mt-1.5 leading-relaxed bg-paper/60 rounded-md border border-paper-border p-3">
                        {h.internal ? 'Internal: ' : ''}{h.note ?? 'Status updated'}
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
              <SelectInput label="Assigned Administrator" value={t.assignedAdminId ?? ''} disabled={pending || admins.loading} error={admins.error ?? undefined} onChange={(event) => void update({ assignedAdminId: event.target.value || null })}>
                <option value="">Unassigned</option>
                {(admins.data ?? []).map((admin) => <option key={admin.id} value={admin.id}>{admin.fullName}</option>)}
              </SelectInput>
              <SelectInput label="Priority" value={t.priority} disabled={pending} onChange={(event) => void update({ priority: event.target.value as SupportPriority })}>
                {(['Standard', 'High', 'Urgent', 'Low'] as const).map((priority) => <option key={priority}>{priority}</option>)}
              </SelectInput>
              {pending && <p role="status" className="text-xs text-ink-muted">Saving...</p>}
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
                <button disabled={pending} onClick={() => { setAction('start'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slateteal-500/20 bg-slateteal-100/30 text-slateteal-700 hover:bg-slateteal-600 hover:text-white transition-colors">
                  <Play className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Start Review</span>
                </button>
              )}
              {(t.status === 'Pending' || t.status === 'Under Review') && (
                <>
                  <button disabled={pending} onClick={() => { setAction('approve'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-success-600/20 bg-success-100/30 text-success-600 hover:bg-success-600 hover:text-white transition-colors">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Approve</span>
                  </button>
                  <button disabled={pending} onClick={() => { setAction('reject'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-danger-600/20 bg-danger-100/30 text-danger-600 hover:bg-danger-600 hover:text-white transition-colors">
                    <XCircle className="h-5 w-5" />
                    <span className="text-xs font-semibold text-center leading-tight">Decline</span>
                  </button>
                </>
              )}
              {t.status === 'Approved' && (
                <button disabled={pending} onClick={() => { setAction('complete'); setNotes(''); setConfirmed(false); }} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-brass-500/20 bg-brass-100/30 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors col-span-2">
                  <Check className="h-5 w-5" />
                  <span className="text-xs font-semibold text-center leading-tight">Mark Completed</span>
                </button>
              )}
              <button aria-disabled="true" disabled title="Letter generation is not available" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-brass-500/20 bg-brass-100/30 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors">
                <FileText className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Generate Letter</span>
              </button>
              <button aria-disabled="true" disabled title="SAB escalation is not available" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slateteal-500/20 bg-slateteal-100/30 text-slateteal-700 hover:bg-slateteal-500 hover:text-white transition-colors">
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
              {t.linked.length === 0 && <p className="text-sm text-ink-muted">No linked records.</p>}
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
              <Link to={`/admin/members/${t.requesterId}`} className="block">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {t.member.split(' ').slice(1, 2).concat(t.member.split(' ').slice(-1)).map((n: string) => n[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-forum-900 truncate">{t.member}</p>
                    <p className="text-[11px] text-ink-subtle font-mono truncate">{t.memberId ?? 'Not provided'}</p>
                  </div>
                </div>
              </Link>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-forum-900">{t.memberSummary?.previous ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Previous SRs</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-success-600">{t.memberSummary?.approved ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Approved</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-lg font-bold text-danger-600">{t.memberSummary?.rejected ?? 0}</p>
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
