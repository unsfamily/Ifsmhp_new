import { useEffect, useMemo, useState } from 'react';
import {
  MessageSquare,
  Search,
  Eye,
  Clock,
  Send,
  ChevronRight,
  User,
  Users,
  ShieldCheck,
  AlertCircle,
  Hash,
  CheckCircle2,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { adminApi } from '../../api/admin';
import type { ConversationDetail, ConversationMessage, ConversationRow, ConversationsResult } from '../../api/messaging';
import { formatRelative, formatResponseTime, openAttachmentInTab } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAttachments } from '../../hooks/useAttachments';
import { Avatar, MessageThread } from '../../components/messaging/MessageThread';
import { ComposerAttachments } from '../../components/messaging/ComposerAttachments';

type Tab = 'all' | 'open' | 'escalated' | 'closed';
type Filter = 'All' | 'Member Support' | 'Project Query' | 'Credential Issue' | 'Publication Problem' | 'Billing' | 'Report Content';

const CATEGORIES: Filter[] = ['All', 'Member Support', 'Project Query', 'Credential Issue', 'Publication Problem', 'Billing', 'Report Content'];

const statusVariant: Record<string, 'info' | 'success' | 'warning' | 'default'> = {
  Open: 'info',
  'Awaiting Member': 'warning',
  Escalated: 'warning',
  Closed: 'default',
};

/** How often the inbox refreshes itself while the tab is in front. */
const LIST_POLL_MS = 30_000;
const THREAD_POLL_MS = 10_000;

export default function AdminMessagesPage() {
  const [tab, setTab] = useState<Tab>('open');
  const [category, setCategory] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addParticipantName, setAddParticipantName] = useState('');
  const [result, setResult] = useState<null | { kind: 'sent' | 'added' }>(null);

  const {
    data,
    initialLoading,
    error,
    refresh,
  } = usePolledApiData<ConversationsResult>(() => adminApi.conversations({ limit: 100 }), [], LIST_POLL_MS);

  const conversations = useMemo(() => data?.items ?? [], [data]);

  const { data: stats } = useApiData<{ messagesAwaitingReply: number }>(
    () => adminApi.stats() as Promise<{ messagesAwaitingReply: number }>,
    [],
  );

  // Keep a selection once the first page lands, and drop one that disappears.
  useEffect(() => {
    if (!conversations.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && conversations.some((c) => c.id === current) ? current : conversations[0]!.id));
  }, [conversations]);

  const {
    data: thread,
    initialLoading: threadLoading,
    error: threadError,
    refresh: refreshThread,
  } = usePolledApiData<ConversationDetail>(
    () => (selectedId ? adminApi.conversation(selectedId) : Promise.resolve(null as unknown as ConversationDetail)),
    [selectedId],
    THREAD_POLL_MS,
    { enabled: Boolean(selectedId) },
  );

  // Opening a thread clears its unread badge.
  useEffect(() => {
    if (!selectedId) return;
    adminApi.markConversationRead(selectedId).then(refresh).catch(() => undefined);
  }, [selectedId]);

  const isEscalated = (c: ConversationRow) => c.priority === 'Escalated' || c.priority === 'Flagged';

  const tabCounts = {
    all: conversations.length,
    open: conversations.filter((c) => ['Open', 'Awaiting Member'].includes(c.status)).length,
    escalated: conversations.filter(isEscalated).length,
    closed: conversations.filter((c) => c.status === 'Closed').length,
  };

  // The service exposes no server-side filters for conversations, so the tabs,
  // search and category narrow the fetched page rather than issuing a query.
  const filtered = conversations.filter((c) => {
    if (tab === 'open' && !['Open', 'Awaiting Member'].includes(c.status)) return false;
    if (tab === 'escalated' && !isEscalated(c)) return false;
    if (tab === 'closed' && c.status !== 'Closed') return false;
    if (category !== 'All' && c.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!c.subject.toLowerCase().includes(s) && !c.from.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);

  const replyFiles = useAttachments({ upload: adminApi.uploadFile });

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await adminApi.sendMessage(selectedId, reply.trim(), false, {
        fileIds: replyFiles.fileIds(),
        links: replyFiles.linkPayload(),
      });
      setReply('');
      replyFiles.reset();
      setResult({ kind: 'sent' });
      refreshThread();
      refresh();
    } catch (err) {
      setSendError(normalizeError(err).message || 'Could not send that reply.');
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (attachment: ConversationMessage['attachments'][number]) => {
    setSendError(null);
    try {
      await openAttachmentInTab(attachment.id);
    } catch (err) {
      setSendError(normalizeError(err).message || 'Could not open that attachment.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Link to="/admin" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ChevronRight className="h-3 w-3 rotate-180" /> Admin home
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Admin Messages &amp; Conversations</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Review, triage and reply to member conversations. Pick a row for the inline split view, or open the full thread for participants and linked records.
          </p>
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-success-600/30 bg-success-50 p-3.5 flex items-start gap-2.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-success-600" />
          <div className="text-sm">
            {result.kind === 'sent' && <><p className="font-semibold text-success-800">Reply sent</p><p className="text-xs text-success-700/90 mt-0.5">Delivered to every participant in this conversation.</p></>}
            {result.kind === 'added' && <><p className="font-semibold text-success-800">Participant added</p><p className="text-xs text-success-700/90 mt-0.5">Shared the full thread history with the new participant.</p></>}
          </div>
          <button onClick={() => setResult(null)} className="ml-auto p-1 rounded-md text-ink-muted hover:bg-white/80 self-start"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Open Conversations', value: tabCounts.open.toString(), icon: MessageSquare, color: 'forum', note: `${tabCounts.escalated} escalated` },
          { label: 'New Messages', value: totalUnread.toString(), icon: Eye, color: 'brass', note: 'Unread by you' },
          {
            label: 'Avg. Response',
            value: formatResponseTime(thread?.analytics.avgResponseMinutes ?? null),
            icon: Clock,
            color: 'slateteal',
            note: thread ? 'Selected conversation' : 'Select a conversation',
          },
          // Presence would need realtime tracking we do not have; the queue depth
          // is the honest number for this slot.
          { label: 'Awaiting Reply', value: String(stats?.messagesAwaitingReply ?? '—'), icon: Users, color: 'forum', note: 'Member spoke last' },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="border-b border-paper-border">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-1 rounded-lg bg-forum-50 p-1 w-fit">
                  {(['all', 'open', 'escalated', 'closed'] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'}`}>
                      {t} ({tabCounts[t]})
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative w-full sm:w-44">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                    <TextInput placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
                  </div>
                  <SelectInput value={category} onChange={(e) => setCategory(e.target.value as Filter)} className="w-full sm:w-44">
                    {CATEGORIES.map((v) => <option key={v} value={v}>{v}</option>)}
                  </SelectInput>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              <div className="divide-y divide-paper-border max-h-[650px] overflow-y-auto">
                {initialLoading ? (
                  <div className="p-10 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-7 w-7 animate-spin text-forum-600" />
                    <p className="text-sm text-ink-muted">Loading conversations…</p>
                  </div>
                ) : error ? (
                  <div className="p-10 flex flex-col items-center gap-3 text-center">
                    <div className="h-12 w-12 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-6 w-6" /></div>
                    <p className="text-sm font-semibold text-forum-900">Couldn't load the inbox</p>
                    <p className="text-xs text-ink-muted max-w-xs">{error}</p>
                    <Button size="sm" variant="outline" onClick={refresh}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="p-10 text-center text-sm text-ink-subtle">
                    {conversations.length === 0
                      ? 'No conversations yet. Threads appear here as members write in.'
                      : 'No conversations match the current filters.'}
                  </div>
                ) : filtered.map((c) => {
                  const isSel = c.id === selectedId;
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full text-left p-4 transition-colors ${isSel ? 'bg-forum-50/70 border-l-4 border-forum-600' : 'hover:bg-forum-50/40 border-l-4 border-transparent'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <Avatar name={c.from} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-semibold text-forum-900 truncate max-w-[180px]">{c.from}</p>
                              {c.unreadCount > 0 && <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-forum-600 text-white text-[10px] font-bold">{c.unreadCount}</span>}
                              {c.priority === 'Escalated' && <Badge variant="danger" className="!text-[10px] !px-1.5 !py-0">ESCALATED</Badge>}
                              {c.priority === 'Flagged' && <Badge variant="warning" className="!text-[10px] !px-1.5 !py-0">FLAGGED</Badge>}
                            </div>
                            <p className="text-xs text-ink-muted mt-0.5">{c.subject}</p>
                            <p className="text-xs text-ink-subtle mt-1 line-clamp-2">{c.lastPreview}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-ink-subtle flex-wrap">
                              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatRelative(c.lastActivity)}</span>
                              <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{c.totalMessages} msgs</span>
                              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{c.participantCount}</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight className={`h-4 w-4 shrink-0 mt-2 ${isSel ? 'text-forum-700' : 'text-paper-border'}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {selected ? (
            <>
          <Card>
            <CardHeader className="border-b border-paper-border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={selected.from} size="lg" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-semibold text-forum-900">{selected.subject}</h3>
                      <Badge variant={statusVariant[selected.status] ?? 'default'}>{selected.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-ink-muted flex-wrap">
                      <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{selected.from} · <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{selected.memberId}</code></span>
                      <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{selected.category}</span>
                      <code className="font-mono text-[10px] text-ink-subtle bg-paper border border-paper-border px-1.5 py-0.5 rounded uppercase tracking-wider">{selected.id}</code>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" as="link" to={`/admin/messages/${selected.id}`} size="sm">
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Open full thread
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddParticipant(true)}>
                    <Users className="h-4 w-4" />
                    Add Participant
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              {threadLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                  <Loader2 className="h-5 w-5 animate-spin text-forum-600" />
                  Loading thread…
                </div>
              ) : threadError ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <div className="h-12 w-12 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-6 w-6" /></div>
                  <p className="text-sm text-ink-muted max-w-xs">{threadError}</p>
                  <Button size="sm" variant="outline" onClick={refreshThread}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
                </div>
              ) : (
                <MessageThread
                  messages={thread?.messages ?? []}
                  conversationId={selected.id}
                  className="max-h-[400px] p-4 sm:p-6"
                  onOpenAttachment={openAttachment}
                />
              )}
              <div className="border-t border-paper-border p-4 sm:p-6">
                {sendError && (
                  <div className="mb-3 rounded-lg border border-danger-600/20 bg-danger-100 p-3">
                    <p className="text-sm text-danger-600">{sendError}</p>
                  </div>
                )}
                <TextInput
                  placeholder="Write your reply (sent as CRO Office — visible to all participants)."
                  className="mb-3"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                />
                <div className="mb-3">
                  <ComposerAttachments
                    attachments={replyFiles.attachments}
                    fileError={replyFiles.fileError}
                    links={replyFiles.links}
                    disabled={sending}
                    onAddFiles={replyFiles.addFiles}
                    onRemoveFile={replyFiles.remove}
                    onRetryFile={replyFiles.retry}
                    onAddLink={replyFiles.addLink}
                    onRemoveLink={replyFiles.removeLink}
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
                    <ShieldCheck className="h-4 w-4 text-forum-700" />
                    Signed as CRO Office · visible to all participants
                    {reply && <span className="text-forum-700 font-medium">· {reply.length} chars</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button as="link" to={`/admin/messages/${selected.id}`} variant="ghost" size="sm">
                      <ChevronRight className="h-4 w-4" />
                      Full thread
                    </Button>
                    <Button variant="primary" disabled={!reply.trim() || sending || replyFiles.blocked} onClick={() => void sendReply()}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Reply
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Participants</p>
                <p className="mt-2 font-display text-2xl font-semibold text-forum-900">{selected.participantCount}</p>
                <p className="text-xs text-ink-subtle mt-0.5 truncate">
                  {thread?.participants.map((p) => p.role).join(' · ') ?? '—'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Total Messages</p>
                <p className="mt-2 font-display text-2xl font-semibold text-forum-900">{selected.totalMessages}</p>
                <p className="text-xs text-ink-subtle mt-0.5">last {formatRelative(selected.lastActivity)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Related Records</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {thread && thread.linkedRecords.length > 0 ? (
                    thread.linkedRecords.map((lr) => {
                      const to = lr.label === 'Project' ? `/admin/projects/${lr.recordId}`
                        : lr.label === 'Publication' ? `/admin/publications/${lr.recordId}`
                        : `/admin/support/${lr.recordId}`;
                      const variant = lr.label === 'Project' ? 'brass' : lr.label === 'Publication' ? 'info' : 'default';
                      return (
                        <Button key={lr.id} as="link" to={to} variant="ghost" size="sm" className="!px-2 !py-1 h-auto">
                          <Badge variant={variant} className="!text-[11px]">{lr.label}</Badge>
                        </Button>
                      );
                    })
                  ) : (
                    <p className="text-xs text-ink-subtle">No linked records</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
            </>
          ) : (
            <Card>
              <CardContent className="p-10 text-center text-ink-subtle text-sm">
                Select a conversation to view details.
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showAddParticipant && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-forum-50 text-forum-700 flex items-center justify-center"><Users className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Add participant to conversation</h3>
                  <p className="text-xs text-ink-subtle mt-0.5">They will see the full thread history going back.</p>
                </div>
              </div>
              <button onClick={() => setShowAddParticipant(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <TextInput label="Search member by name, email or member ID" placeholder="e.g. DR-IFSMHP-000086" value={addParticipantName} onChange={(e) => setAddParticipantName(e.target.value)} />
              <div className="rounded-lg border border-paper-border bg-paper-raised divide-y divide-paper-border max-h-56 overflow-y-auto">
                {[
                  { id: 'DR-IFSMHP-000086', name: 'Dr. Lindberg, Karin', role: 'SAB · Senior Reviewer' },
                  { id: 'DR-IFSMHP-000102', name: 'Dr. Okafor, Chinaza', role: 'SAB Track Lead: Scientists' },
                  { id: 'CL-IFSMHP-000244', name: 'Ms. al-Rashid, Layla', role: 'Wellness Committee' },
                ].map((p) => (
                  <label key={p.id} className="flex items-start gap-3 p-3 hover:bg-forum-50/60 cursor-pointer">
                    <input type="radio" name="add-member" className="mt-0.5 accent-forum-600" checked={addParticipantName === p.id} onChange={() => setAddParticipantName(p.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-forum-900">{p.name}</span>
                        <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{p.id}</code>
                      </div>
                      <p className="text-xs text-ink-subtle mt-0.5">{p.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setShowAddParticipant(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!addParticipantName.trim()} onClick={() => { setShowAddParticipant(false); setResult({ kind: 'added' }); setAddParticipantName(''); }}>
                <Users className="h-4 w-4" />Add &amp; Share History
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
