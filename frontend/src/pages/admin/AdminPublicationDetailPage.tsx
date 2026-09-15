import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  User,
  Globe2,
  FileText,
  Send,
  Eye,
  History,
  MessageSquare,
  ChevronDown,
  BookOpenCheck,
  Ban,
  Calendar,
  ShieldCheck,
  Loader2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';
import {
  adminApi,
  type AdminPublicationDetail,
  type PublicationFile,
  type PublicationStatusLabel,
} from '../../api/admin';
import { apiClient, normalizeError } from '../../api/client';
import {
  PUBLICATION_REJECTION_NOTE_MIN,
  PUBLICATION_TRANSITIONS,
  statusValueOf,
} from '../../api/publications';
import { useApiData } from '../../hooks/useApiData';
import { formatBytes } from '../../utils/formatBytes';

type Action = 'approve' | 'publish' | 'reject' | 'unpublish';

const formatDateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

const initialsOf = (name: string) =>
  name.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase() || '?';

export default function AdminPublicationDetailPage() {
  const { id } = useParams();
  const [reloadKey, setReloadKey] = useState(0);
  const { data: pub, loading, error } = useApiData<AdminPublicationDetail>(
    () => adminApi.publication(id!),
    [id, reloadKey],
  );

  const [action, setAction] = useState<Action | null>(null);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState<Action | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => setReloadKey((k) => k + 1);

  const openAction = (next: Action) => {
    setAction(next);
    setComments('');
    setActionError(null);
  };

  /**
   * Runs one editorial decision, then reloads so the screen reflects what was
   * actually stored — the server's own status, review record and history,
   * rather than a guess made on the client.
   */
  const runAction = async (next: Action) => {
    if (!pub) return;
    const note = comments.trim();
    setProcessing(next);
    setActionError(null);
    setNotice(null);
    try {
      if (next === 'approve') await adminApi.approvePublication(pub.id, note || undefined);
      else if (next === 'publish') await adminApi.publishPublication(pub.id, note || undefined);
      else if (next === 'unpublish') await adminApi.unpublishPublication(pub.id, note || undefined);
      else await adminApi.rejectPublication(pub.id, note);

      setNotice(
        next === 'publish' ? 'Published. The paper is now live on the public research listing.'
        : next === 'unpublish' ? 'Removed from the public listing. The manuscript is retained.'
        : next === 'approve' ? 'Approved. The author has been notified.'
        : 'Rejected. The author has been notified with your reasons.',
      );
      setAction(null);
      setComments('');
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || `Could not ${next} this publication.`);
    } finally {
      setProcessing(null);
    }
  };

  /** Starting a review is a plain move with no note, so it fires immediately. */
  const startReview = async () => {
    if (!pub) return;
    setProcessing('approve');
    setActionError(null);
    setNotice(null);
    try {
      await adminApi.transitionPublication(pub.id, statusValueOf['Under Review']);
      setNotice('Moved into review.');
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not start the review.');
    } finally {
      setProcessing(null);
    }
  };

  // Files ride an authenticated route, so they are fetched as blobs through
  // apiClient — a bare <a href> would 401.
  const fileBlob = async (file: PublicationFile) =>
    (await apiClient.get(`/files/${file.id}/download`, { responseType: 'blob' })).data as Blob;

  const viewFile = async (file: PublicationFile) => {
    setActionError(null);
    try {
      const url = URL.createObjectURL(await fileBlob(file));
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open this file.');
    }
  };

  const downloadFile = async (file: PublicationFile) => {
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
        <p className="text-sm font-medium text-forum-900">Loading publication…</p>
      </div>
    );
  }

  if (error || !pub) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-danger-600" />
          <p className="mt-4 text-base font-semibold text-forum-900">Publication not found</p>
          <p className="mt-1 text-sm text-ink-muted">{error ?? 'This manuscript may have been removed.'}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="outline" onClick={refresh}>
              <RotateCcw className="h-4 w-4" />
              Try again
            </Button>
            <Button as="link" to="/admin/publications" size="sm" variant="ghost">
              <ArrowLeft className="h-4 w-4" />
              Back to publications
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canMoveTo = (next: PublicationStatusLabel) => PUBLICATION_TRANSITIONS[pub.status]?.includes(next) ?? false;
  const rejectionValid = comments.trim().length >= PUBLICATION_REJECTION_NOTE_MIN;
  const busy = processing !== null;
  const totalFileSize = pub.files.reduce((sum, f) => sum + f.size, 0);
  const authorName = pub.author ?? 'Unknown author';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/publications" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Publications Queue
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant={pub.status === 'Under Review' ? 'warning' : pub.status === 'Approved' ? 'success' : pub.status === 'Published' ? 'brass' : pub.status === 'Rejected' ? 'danger' : 'info'} className="!py-1">
            <Clock className="h-2.5 w-2.5 mr-1" />
            {pub.status}
          </Badge>
          {pub.status === 'Published' && (
            <Badge variant="success" className="!py-1">
              <Globe2 className="h-2.5 w-2.5 mr-1" />
              Public
            </Badge>
          )}
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">{actionError}</div>
      )}
      {notice && !actionError && (
        <div className="rounded-lg border border-success-600/20 bg-success-100 p-4 text-sm text-success-600">{notice}</div>
      )}

      <Card>
        <CardHeader className="bg-gradient-to-br from-forum-50 via-paper to-brass-100/50 rounded-t-xl border-b border-paper-border sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="brass">{pub.category}</Badge>
                <Badge variant="info">{pub.researchType}</Badge>
                <span className="text-xs text-ink-subtle inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Submitted {formatDateTime(pub.submittedAt)}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
                {pub.title}
              </h1>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold shrink-0">
                  {initialsOf(authorName)}
                </div>
                <div>
                  <p className="font-medium text-forum-900">
                    {authorName}
                    {pub.memberId && <> · <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{pub.memberId}</code></>}
                  </p>
                  {pub.institution && <p className="text-ink-subtle text-xs">{pub.institution}</p>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {canMoveTo('Under Review') && (
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void startReview()}>
                  {processing === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                  Start Review
                </Button>
              )}
              {canMoveTo('Approved') && pub.status !== 'Published' && (
                <Button variant="primary" size="sm" disabled={busy} onClick={() => openAction('approve')}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Submission
                </Button>
              )}
              {canMoveTo('Published') && (
                <Button size="sm" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" disabled={busy} onClick={() => openAction('publish')}>
                  <Globe2 className="h-4 w-4" />
                  Publish Now
                </Button>
              )}
              {pub.status === 'Published' && (
                <Button variant="outline" size="sm" className="border-warning-600/40 text-warning-700 hover:bg-warning-100" disabled={busy} onClick={() => openAction('unpublish')}>
                  <Ban className="h-4 w-4" />
                  Unpublish
                </Button>
              )}
              {canMoveTo('Rejected') && (
                <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" disabled={busy} onClick={() => openAction('reject')}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Abstract
              </h3>
              {pub.status === 'Published' && pub.slug && (
                <Button variant="ghost" size="sm" as="link" to={`/research/${pub.slug}`}>
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  View Public Page
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink leading-relaxed">{pub.abstract}</p>
            </CardContent>
          </Card>

          {/*
            The declarations the author made on submission. Collected by the
            Submit New Paper form and required reading for a reviewer — a
            conflict of interest is not something to judge a manuscript without.
          */}
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slateteal-500" />
                Submission Details
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  { label: 'All authors', value: pub.authors },
                  { label: 'Corresponding author', value: pub.correspondingAuthor },
                  { label: 'Corresponding email', value: pub.correspondingEmail },
                  { label: 'ORCID', value: pub.orcid },
                  { label: 'Preferred journal', value: pub.venue },
                  { label: 'Keywords', value: pub.keywords },
                  { label: 'DOI', value: pub.doi },
                  { label: 'Funding', value: pub.funding },
                  { label: 'Conflict of interest', value: pub.conflicts, wide: true },
                  { label: 'Ethics approval', value: pub.ethicsApproval, wide: true },
                  { label: 'Cover letter', value: pub.coverLetter, wide: true },
                ]
                  .filter((field) => field.value)
                  .map((field) => (
                    <div key={field.label} className={field.wide ? 'sm:col-span-2' : ''}>
                      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{field.label}</dt>
                      <dd className="mt-1 text-sm text-ink whitespace-pre-line break-words">{field.value}</dd>
                    </div>
                  ))}
              </dl>
              {![pub.authors, pub.correspondingAuthor, pub.keywords, pub.conflicts].some(Boolean) && (
                <p className="text-sm text-ink-subtle">
                  This manuscript predates the current submission form, so it carries no declarations.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Download className="h-5 w-5 text-brass-700" />
                Submitted Files ({pub.files.length})
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {pub.files.length === 0 && (
                <p className="text-sm text-ink-subtle">No files were attached to this submission.</p>
              )}
              {pub.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-brass-100 text-brass-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-forum-900 truncate">{f.name}</p>
                      <p className="text-xs text-ink-subtle">{f.kind} · {formatBytes(f.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => void viewFile(f)} className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                      Read
                    </button>
                    <button onClick={() => void downloadFile(f)} className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-paper transition-colors">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {action && (
            <Card className={
              action === 'approve' ? 'border-success-600/30 ring-2 ring-success-100'
              : action === 'publish' ? 'border-brass-500/30 ring-2 ring-brass-100'
              : action === 'reject' ? 'border-danger-600/30 ring-2 ring-danger-100'
              : 'border-warning-600/30 ring-2 ring-warning-100'
            }>
              <CardHeader className={
                action === 'approve' ? 'bg-success-100/60 rounded-t-lg'
                : action === 'publish' ? 'bg-brass-100/60 rounded-t-lg'
                : action === 'reject' ? 'bg-danger-100/60 rounded-t-lg'
                : 'bg-warning-100/60 rounded-t-lg'
              }>
                <h3 className="font-display text-lg font-semibold flex items-center gap-2" style={{ color: action === 'approve' ? '#1F6B41' : action === 'publish' ? '#3F7825' : action === 'reject' ? '#A32B2B' : '#8A6212' }}>
                  {action === 'approve' ? <CheckCircle2 className="h-5 w-5" /> : action === 'publish' ? <Globe2 className="h-5 w-5" /> : action === 'reject' ? <XCircle className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                  {action === 'approve' ? 'Confirm Approval (Internal)' : action === 'publish' ? 'Confirm Publication (Public)' : action === 'reject' ? 'Confirm Rejection' : 'Confirm Unpublishing'}
                </h3>
              </CardHeader>
              <CardContent className="pt-0">
                {action === 'publish' && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4 text-xs mb-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">URL slug (auto-generated)</label>
                      <code className="mt-1 block text-sm font-mono bg-forum-50 text-forum-700 px-2.5 py-2 rounded-lg">/research/{pub.slug ?? 'generated-on-publish'}</code>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Publication Date</label>
                      <p className="mt-1 text-sm font-medium text-ink">Today · Immediately visible on public site</p>
                    </div>
                  </div>
                )}
                {action === 'unpublish' && (
                  <div className="my-4 p-4 rounded-lg border border-warning-600/30 bg-warning-100/40">
                    <p className="text-sm text-warning-700 font-medium flex items-start gap-2">
                      <Ban className="h-5 w-5 shrink-0 mt-0.5" />
                      Unpublishing removes the publication from all public queries, the research listing, and the PDF endpoint immediately. The manuscript is retained and can be re-published. An audit entry is created.
                    </p>
                  </div>
                )}
                <TextArea
                  rows={5}
                  placeholder={
                    action === 'reject' ? `Required. Give the specific reason for rejection — at least ${PUBLICATION_REJECTION_NOTE_MIN} characters. Visible to the submitting member.`
                    : action === 'approve' ? 'Reviewer comments (optional). These comments will be visible to the member as part of the "approved" notification.'
                    : action === 'publish' ? 'Public-facing editor note (optional).'
                    : 'Reason for unpublishing (for audit log and author notification).'
                  }
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="mt-4"
                />
                {action === 'reject' && !rejectionValid && comments.length > 0 && (
                  <p className="mt-1.5 text-xs text-danger-600">
                    {PUBLICATION_REJECTION_NOTE_MIN - comments.trim().length} more characters needed.
                  </p>
                )}
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => { setAction(null); setComments(''); }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  {action === 'approve' && (
                    <Button variant="primary" className="bg-success-600 hover:bg-success-600/90" disabled={busy} onClick={() => void runAction('approve')}>
                      {processing === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Approve (stays in internal queue)
                    </Button>
                  )}
                  {action === 'publish' && (
                    <Button className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" disabled={busy} onClick={() => void runAction('publish')}>
                      {processing === 'publish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe2 className="h-4 w-4" />}
                      Publish to Public Site
                    </Button>
                  )}
                  {action === 'reject' && (
                    <Button variant="primary" className="bg-danger-600 hover:bg-danger-600/90" disabled={!rejectionValid || busy} onClick={() => void runAction('reject')}>
                      {processing === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Reject &amp; Notify Author
                    </Button>
                  )}
                  {action === 'unpublish' && (
                    <Button variant="primary" className="bg-warning-600 hover:bg-warning-600/90" disabled={busy} onClick={() => void runAction('unpublish')}>
                      {processing === 'unpublish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
                      Unpublish Immediately
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <History className="h-5 w-5 text-slateteal-500" />
                Review History &amp; Status Timeline
              </h3>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex" as="link" to="/admin/messages">
                <MessageSquare className="h-3.5 w-3.5" />
                Message Author
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3">Review Comments</h4>
                {pub.reviews.length === 0 ? (
                  <p className="text-sm text-ink-subtle">No editorial decisions recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {pub.reviews.map((r) => (
                      <div key={r.id} className="border border-paper-border rounded-lg p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <p className="text-xs font-medium text-ink">
                            {r.by} · <span className="text-ink-subtle">{formatDateTime(r.at)}</span>
                          </p>
                          <Badge variant={r.decision === 'Rejected' ? 'danger' : r.decision === 'Published' ? 'brass' : r.decision === 'Approved' ? 'success' : 'warning'}>{r.decision}</Badge>
                        </div>
                        <p className="text-sm text-ink-muted">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                {pub.history.map((h) => (
                  <li key={h.id} className="relative">
                    <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full ring-4 ring-paper-raised ${
                      h.to === 'Submitted' ? 'bg-forum-600' : h.to === 'Published' ? 'bg-brass-500' : h.to === 'Approved' ? 'bg-success-600' : h.to === 'Rejected' ? 'bg-danger-600' : 'bg-slateteal-500'
                    }`} />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-medium text-forum-900">
                        {h.from && <span className="text-ink-subtle font-normal">{h.from} → </span>}
                        <strong>{h.to}</strong>
                      </p>
                      <span className="text-[11px] text-ink-subtle">{formatDateTime(h.at)} · by {h.actor}</span>
                    </div>
                    {h.note && <p className="text-sm text-ink-muted mt-0.5">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Publication Stats</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-subtle">Public Views</span><span className="font-semibold text-ink">{pub.views.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Downloads</span><span className="font-semibold text-ink">{pub.downloads.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Files Attached</span><span className="font-semibold text-ink">{pub.files.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Total File Size</span><span className="font-semibold text-ink">{formatBytes(totalFileSize)}</span></div>
              {pub.publishedAt && (
                <div className="flex justify-between pt-2 mt-2 border-t border-paper-border"><span className="text-ink-subtle">Published</span><span className="font-semibold text-forum-700">{formatDate(pub.publishedAt)}</span></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Shortcut Actions</h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              <button
                disabled={!canMoveTo('Approved') || pub.status === 'Published' || busy}
                onClick={() => openAction('approve')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-forum-50 disabled:hover:text-forum-700"
              >
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Approve</span>
              </button>
              <button
                disabled={!canMoveTo('Published') || busy}
                onClick={() => openAction('publish')}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors disabled:opacity-40 disabled:hover:bg-brass-100 disabled:hover:text-brass-700"
              >
                <Globe2 className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Publish</span>
              </button>
              <Link to="/admin/messages" className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white transition-colors">
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Contact Author</span>
              </Link>
              <button
                disabled={pub.files.length === 0}
                onClick={() => { pub.files.forEach((f) => void downloadFile(f)); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border text-ink-muted hover:bg-paper transition-colors disabled:opacity-40"
              >
                <Download className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Download All</span>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-forum-600" />
                Author Profile
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to={`/admin/members?q=${encodeURIComponent(pub.memberId ?? authorName)}`} className="flex items-center gap-3 p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold shrink-0">
                  {initialsOf(authorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-forum-900 truncate">{authorName}</p>
                  <p className="text-[11px] text-ink-subtle font-mono truncate">{pub.memberId ?? '—'}</p>
                </div>
                <Eye className="h-4 w-4 text-ink-subtle shrink-0" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
