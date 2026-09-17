import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Hash,
  Users,
  Send,
  ShieldCheck,
  Eye,
  EyeOff,
  Mail,
  Building2,
  Link as LinkIcon,
  ChevronRight,
  FileText,
  FolderKanban,
  MessageSquare,
  Loader2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';
import { adminApi } from '../../api/admin';
import type { ConversationDetail, ConversationMessage } from '../../api/messaging';
import { formatRelative, formatResponseTime, openAttachmentInTab } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAttachments } from '../../hooks/useAttachments';
import { Avatar, MessageThread } from '../../components/messaging/MessageThread';
import { ComposerAttachments } from '../../components/messaging/ComposerAttachments';

const THREAD_POLL_MS = 10_000;

const statusVariant: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'default'> = {
  Open: 'info',
  'Awaiting Member': 'warning',
  Escalated: 'warning',
  Closed: 'default',
};

const priorityVariant: Record<string, 'default' | 'warning' | 'danger'> = {
  Standard: 'default',
  Escalated: 'danger',
  Flagged: 'warning',
};

function formatStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminMessagesDetailPage() {
  const { conversationId } = useParams();
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showInternal, setShowInternal] = useState(false);
  const [sending, setSending] = useState<'reply' | 'internal' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    data: conv,
    initialLoading,
    error,
    refresh,
  } = usePolledApiData<ConversationDetail>(
    () => adminApi.conversation(conversationId!),
    [conversationId],
    THREAD_POLL_MS,
    { enabled: Boolean(conversationId) },
  );

  // Opening the thread clears its unread badge in the inbox.
  useEffect(() => {
    if (!conversationId) return;
    adminApi.markConversationRead(conversationId).catch(() => undefined);
  }, [conversationId]);

  const replyFiles = useAttachments({ upload: adminApi.uploadFile });
  const noteFiles = useAttachments({ upload: adminApi.uploadFile });

  const send = async (kind: 'reply' | 'internal') => {
    const body = (kind === 'reply' ? reply : internalNote).trim();
    if (!body || !conversationId) return;
    const files = kind === 'reply' ? replyFiles : noteFiles;
    setSending(kind);
    setActionError(null);
    try {
      await adminApi.sendMessage(conversationId, body, kind === 'internal', {
        fileIds: files.fileIds(),
        links: files.linkPayload(),
      });
      if (kind === 'reply') setReply('');
      else setInternalNote('');
      files.reset();
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not post that message.');
    } finally {
      setSending(null);
    }
  };

  const openAttachment = async (attachment: ConversationMessage['attachments'][number]) => {
    setActionError(null);
    try {
      await openAttachmentInTab(attachment.id, attachment.attachmentId);
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open that attachment.');
    }
  };

  if (initialLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-forum-600" />
        <p className="text-sm font-medium text-forum-900">Loading conversation…</p>
      </div>
    );
  }

  // An unknown id used to silently render a fixture; now it reads as missing.
  if (error || !conv) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div className="text-center max-w-md">
          <p className="text-base font-semibold text-forum-900">Conversation not found</p>
          <p className="text-sm text-ink-muted mt-1">{error ?? 'This conversation may have been removed.'}</p>
        </div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={refresh}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
          <Button as="link" to="/admin/messages" size="sm" variant="ghost"><ArrowLeft className="h-3.5 w-3.5" />Back to inbox</Button>
        </div>
      </div>
    );
  }

  const { analytics } = conv;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Link to="/admin/messages" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to inbox
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{conv.subject}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <Badge variant={statusVariant[conv.status] ?? 'default'}>{conv.status}</Badge>
            <Badge variant={priorityVariant[conv.priority] ?? 'default'}>{conv.priority}</Badge>
            <Badge variant="info">{conv.category}</Badge>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Last activity {formatRelative(conv.lastActivity)}</span>
            <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />Created {formatStamp(conv.createdAt)}</span>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4">
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-paper-border bg-paper overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-paper-border bg-forum-50/40 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={conv.fromName ?? conv.from} size="lg" />
                <div className="min-w-0">
                  <p className="font-semibold text-forum-900 truncate">{conv.fromName ?? conv.from}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-muted">
                    {conv.fromEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{conv.fromEmail}</span>}
                    {conv.fromInstitution && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{conv.fromInstitution}</span>}
                    {conv.fromMemberId && <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{conv.fromMemberId}</code>}
                  </div>
                </div>
              </div>
              {conv.assignee && (
                <p className="text-xs text-ink-muted inline-flex items-center gap-1 shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5 text-forum-700" />
                  Assigned to {conv.assignee}
                </p>
              )}
            </div>

            <MessageThread
              messages={conv.messages}
              conversationId={conv.id}
              className="max-h-[520px]"
              emptyLabel="No message history in this conversation."
              onOpenAttachment={openAttachment}
            />

            <div className="border-t border-paper-border p-4 sm:p-5">
              <TextArea
                rows={3}
                placeholder="Write your reply — signed as CRO Office. Visible to all conversation participants."
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="mt-3">
                <ComposerAttachments
                  attachments={replyFiles.attachments}
                  fileError={replyFiles.fileError}
                  links={replyFiles.links}
                  disabled={sending !== null}
                  onAddFiles={replyFiles.addFiles}
                  onRemoveFile={replyFiles.remove}
                  onRetryFile={replyFiles.retry}
                  onAddLink={replyFiles.addLink}
                  onRemoveLink={replyFiles.removeLink}
                />
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowInternal((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-forum-900"
                >
                  {showInternal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showInternal ? 'Hide internal note' : 'Add internal note (admins only)'}
                </button>
                <div className="flex items-center gap-3">
                  {replyFiles.blocked && (
                    <p className="text-xs text-ink-subtle">
                      {replyFiles.busy ? 'Waiting for uploads…' : 'Retry or remove the failed attachment.'}
                    </p>
                  )}
                  <Button
                    variant="primary"
                    disabled={!reply.trim() || sending !== null || replyFiles.blocked}
                    onClick={() => void send('reply')}
                  >
                    {sending === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Reply
                  </Button>
                </div>
              </div>

              {showInternal && (
                <div className="mt-4 rounded-lg border border-warning-600/30 bg-warning-100/50 p-3">
                  <p className="text-xs font-semibold text-warning-700 flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    Internal note — admins only, never shared with the member
                  </p>
                  <TextArea
                    rows={2}
                    className="mt-2"
                    placeholder="Context for the CRO team…"
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                  />
                  <div className="mt-2">
                    <ComposerAttachments
                      attachments={noteFiles.attachments}
                      fileError={noteFiles.fileError}
                      links={noteFiles.links}
                      disabled={sending !== null}
                      onAddFiles={noteFiles.addFiles}
                      onRemoveFile={noteFiles.remove}
                      onRetryFile={noteFiles.retry}
                      onAddLink={noteFiles.addLink}
                      onRemoveLink={noteFiles.removeLink}
                    />
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setInternalNote(''); noteFiles.reset(); }}>Clear</Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!internalNote.trim() || sending !== null || noteFiles.blocked}
                      onClick={() => void send('internal')}
                    >
                      {sending === 'internal' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      Save Internal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                <LinkIcon className="h-4.5 w-4.5 text-forum-600" />
                Linked Records
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Cross-referenced items in the IFSMHP registry</p>
            </CardHeader>
            <CardContent className="pt-0">
              {conv.linkedRecords.length === 0 ? (
                <p className="text-sm text-ink-muted">No linked records for this conversation.</p>
              ) : (
                <div className="space-y-2">
                  {conv.linkedRecords.map((lr) => {
                    const to = lr.label === 'Project' ? `/admin/projects/${lr.recordId}`
                      : lr.label === 'Publication' ? `/admin/publications/${lr.recordId}`
                      : `/admin/support/${lr.recordId}`;
                    const Icon = lr.label === 'Project' ? FolderKanban : lr.label === 'Publication' ? FileText : MessageSquare;
                    return (
                      <Link key={lr.id} to={to} className="flex items-center gap-3 rounded-lg border border-paper-border p-3 hover:bg-forum-50/40 transition-colors">
                        <div className="h-9 w-9 shrink-0 rounded-md bg-forum-50 text-forum-700 flex items-center justify-center">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-subtle">{lr.label}</p>
                          <p className="text-sm font-medium text-forum-900 truncate">{lr.name}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-paper-border shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-forum-600" />
                Participants ({conv.participants.length})
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {conv.participants.map((p) => (
                <div key={p.email} className="flex items-center gap-3 rounded-lg p-2 hover:bg-paper transition-colors">
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-forum-900 truncate">{p.name}</p>
                    <p className="text-[11px] text-ink-subtle truncate">{p.email}</p>
                  </div>
                  <Badge variant={p.role === 'Member' ? 'info' : 'brass'} className="!text-[10px] shrink-0">{p.role}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Conversation Summary</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-xl font-bold text-forum-900">{conv.totalMessages}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Messages</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-xl font-bold text-brass-700">{analytics.participantCount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Participants</p>
                </div>
                <div className="p-2 rounded-md bg-paper">
                  <p className="font-display text-xl font-bold text-slateteal-700">{analytics.linkedRecordCount}</p>
                  <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Links</p>
                </div>
              </div>

              <div className="space-y-2 border-t border-paper-border pt-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-subtle">First response</span>
                  <span className="font-medium text-ink">{formatResponseTime(analytics.firstResponseMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-subtle">Avg. response</span>
                  <span className="font-medium text-ink">{formatResponseTime(analytics.avgResponseMinutes)}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-subtle">Exchanges</span>
                  <span className="font-medium text-ink">{analytics.responseCount}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-ink-subtle">Last activity</span>
                  <span className="font-medium text-ink">{formatRelative(analytics.lastActivityAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
