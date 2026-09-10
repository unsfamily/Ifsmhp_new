import { useEffect, useMemo, useState } from 'react';
import {
  Inbox,
  Send,
  Search,
  Clock,
  Bell,
  User,
  MessageSquare,
  Building2,
  ChevronRight,
  Loader2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Hash,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextArea, TextInput } from '../../components/common/Input';
import { memberApi } from '../../api/member';
import type { ConversationDetail, ConversationMessage, ConversationsResult } from '../../api/messaging';
import { formatRelative, formatResponseTime, openAttachmentInTab } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAttachments } from '../../hooks/useAttachments';
import { MessageThread } from '../../components/messaging/MessageThread';
import { ComposerAttachments } from '../../components/messaging/ComposerAttachments';

const LIST_POLL_MS = 30_000;
const THREAD_POLL_MS = 10_000;

/** Matches the categories the CRO inbox filters by. */
const CATEGORIES = ['Member Support', 'Project Query', 'Credential Issue', 'Publication Problem', 'Billing', 'Report Content'];

export default function MessagesPage() {
  const [tab, setTab] = useState<'inbox' | 'compose'>('inbox');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // New-thread form.
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [firstMessage, setFirstMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const {
    data,
    initialLoading,
    error,
    refresh,
  } = usePolledApiData<ConversationsResult>(() => memberApi.conversations({ limit: 100 }), [], LIST_POLL_MS);

  const conversations = useMemo(() => data?.items ?? [], [data]);

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
    () => (selectedId ? memberApi.conversation(selectedId) : Promise.resolve(null as unknown as ConversationDetail)),
    [selectedId],
    THREAD_POLL_MS,
    { enabled: Boolean(selectedId) && tab === 'inbox' },
  );

  // Opening a thread clears its unread badge, here and in the sidebar count.
  useEffect(() => {
    if (!selectedId) return;
    memberApi.markConversationRead(selectedId).then(refresh).catch(() => undefined);
  }, [selectedId]);

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.subject.toLowerCase().includes(s) || c.lastPreview.toLowerCase().includes(s);
  });

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  const replyFiles = useAttachments({ upload: memberApi.uploadFile });
  const composeFiles = useAttachments({ upload: memberApi.uploadFile });

  const sendReply = async () => {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setActionError(null);
    try {
      await memberApi.sendMessage(selectedId, reply.trim(), {
        fileIds: replyFiles.fileIds(),
        links: replyFiles.linkPayload(),
      });
      setReply('');
      replyFiles.reset();
      refreshThread();
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not send that message.');
    } finally {
      setSending(false);
    }
  };

  const startConversation = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const conversation = await memberApi.createConversation({
        subject: subject.trim(),
        category,
        body: firstMessage.trim(),
        fileIds: composeFiles.fileIds(),
        links: composeFiles.linkPayload(),
      });
      setSubject('');
      setFirstMessage('');
      composeFiles.reset();
      setCreated(true);
      refresh();
      setSelectedId(conversation.id);
      setTab('inbox');
    } catch (err) {
      setCreateError(normalizeError(err).message || 'Could not start that conversation.');
    } finally {
      setCreating(false);
    }
  };

  const openAttachment = async (attachment: ConversationMessage['attachments'][number]) => {
    setActionError(null);
    try {
      await openAttachmentInTab(attachment.id);
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open that attachment.');
    }
  };

  // A failed upload blocks send: the member believes the file is attached, and
  // sending would silently drop it.
  const canCreate = subject.trim().length >= 4 && firstMessage.trim().length > 0 && !composeFiles.blocked;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forum-900">Messages from CRO</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your conversations with the Chief Research Office. Replies usually arrive within a working day.
        </p>
      </div>

      {created && (
        <div className="rounded-lg border border-success-600/30 bg-success-100 p-3.5 flex items-start gap-2.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-success-600" />
          <div className="text-sm">
            <p className="font-semibold text-success-600">Message sent to the CRO</p>
            <p className="text-xs text-success-600/90 mt-0.5">You will get a notification here as soon as they reply.</p>
          </div>
          <button onClick={() => setCreated(false)} className="ml-auto p-1 rounded-md text-ink-muted hover:bg-white/60 self-start">×</button>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4">
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <div className="flex border-b border-paper-border">
              <button
                onClick={() => setTab('inbox')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === 'inbox' ? 'border-b-2 border-forum-600 bg-forum-50/40 text-forum-900' : 'text-ink-muted hover:text-forum-900'
                }`}
              >
                <Inbox className="h-4 w-4" />
                Inbox
                {totalUnread > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-white">
                    {totalUnread}
                  </span>
                )}
              </button>
              <button
                onClick={() => setTab('compose')}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === 'compose' ? 'border-b-2 border-forum-600 bg-forum-50/40 text-forum-900' : 'text-ink-muted hover:text-forum-900'
                }`}
              >
                <Send className="h-4 w-4" />
                Send to CRO
              </button>
            </div>

            {tab === 'inbox' ? (
              <>
                <div className="border-b border-paper-border p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                    <TextInput
                      placeholder="Search messages..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="[&>input]:pl-9"
                    />
                  </div>
                </div>

                <div className="divide-y divide-paper-border max-h-[600px] overflow-y-auto">
                  {initialLoading ? (
                    <div className="p-10 flex flex-col items-center gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-forum-600" />
                      <p className="text-sm text-ink-muted">Loading messages…</p>
                    </div>
                  ) : error ? (
                    <div className="p-10 flex flex-col items-center gap-3 text-center">
                      <div className="h-12 w-12 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-6 w-6" /></div>
                      <p className="text-sm font-semibold text-forum-900">Couldn't load your messages</p>
                      <p className="text-xs text-ink-muted max-w-xs">{error}</p>
                      <Button size="sm" variant="outline" onClick={refresh}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="p-10 flex flex-col items-center gap-3 text-center">
                      <div className="h-12 w-12 flex items-center justify-center rounded-full bg-forum-50 text-forum-700"><Inbox className="h-6 w-6" /></div>
                      <p className="text-sm font-semibold text-forum-900">
                        {conversations.length === 0 ? 'No messages yet' : 'No messages match your search'}
                      </p>
                      {conversations.length === 0 && (
                        <>
                          <p className="text-xs text-ink-muted max-w-xs">Start a conversation and the CRO office will pick it up.</p>
                          <Button size="sm" variant="primary" onClick={() => setTab('compose')}>
                            <Send className="h-3.5 w-3.5" />Send to CRO
                          </Button>
                        </>
                      )}
                    </div>
                  ) : filtered.map((c) => {
                    const isSel = c.id === selectedId;
                    const unread = c.unreadCount > 0;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        className={`w-full p-4 text-left transition-colors ${
                          isSel ? 'bg-forum-50/60 border-l-4 border-l-forum-600 pl-3' : `border-l-4 border-transparent hover:bg-forum-50/40 ${unread ? 'bg-brass-100/20' : ''}`
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${unread ? 'bg-brass-500 text-white' : 'bg-forum-100 text-forum-700'}`}>
                            {unread ? <Bell className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm truncate ${unread ? 'font-bold text-forum-900' : 'font-medium text-ink'}`}>CRO Office</p>
                              <span className="inline-flex items-center gap-1 shrink-0 text-[11px] text-ink-subtle">
                                <Clock className="h-3 w-3" />{formatRelative(c.lastActivity)}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-sm text-ink-muted">{c.subject}</p>
                            <p className="mt-1 line-clamp-2 text-xs text-ink-subtle">{c.lastPreview}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <Badge variant="default" className="!text-[10px]">{c.category}</Badge>
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
                                <Hash className="h-3 w-3" />{c.totalMessages} msgs
                              </span>
                              {unread && <span className="h-1.5 w-1.5 rounded-full bg-brass-500" />}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="p-4 space-y-4">
                <p className="text-sm text-ink-muted">
                  Write to the Chief Research Office. Your message opens a new conversation the CRO team can reply to.
                </p>
                {createError && (
                  <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-3">
                    <p className="text-sm text-danger-600">{createError}</p>
                  </div>
                )}
                <TextInput
                  label="Subject"
                  placeholder="What is this about?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  hint="At least 4 characters."
                />
                <SelectInput label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
                <TextArea
                  label="Message"
                  rows={6}
                  placeholder="Write your message to the CRO office…"
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                />
                <ComposerAttachments
                  attachments={composeFiles.attachments}
                  fileError={composeFiles.fileError}
                  links={composeFiles.links}
                  disabled={creating}
                  onAddFiles={composeFiles.addFiles}
                  onRemoveFile={composeFiles.remove}
                  onRetryFile={composeFiles.retry}
                  onAddLink={composeFiles.addLink}
                  onRemoveLink={composeFiles.removeLink}
                />
                <Button className="w-full" variant="primary" disabled={!canCreate || creating} onClick={() => void startConversation()}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send to CRO
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col">
          {selected ? (
            <>
              <CardHeader className="border-b border-paper-border">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forum-600 text-xs font-bold text-white">
                    CRO
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-display text-lg font-semibold text-forum-900">{selected.subject}</h3>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Chief Research Office</span>
                      <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{selected.category}</span>
                      <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{formatRelative(selected.lastActivity)}</span>
                      <Badge variant="info" className="!text-[10px]">{selected.status}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0">
                {threadLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-muted">
                    <Loader2 className="h-5 w-5 animate-spin text-forum-600" />
                    Loading conversation…
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
                    className="max-h-[460px]"
                    onOpenAttachment={openAttachment}
                  />
                )}

                {thread && thread.analytics.avgResponseMinutes !== null && (
                  <div className="mx-4 mb-2 grid grid-cols-3 gap-2 rounded-lg bg-paper p-2 text-center">
                    <div>
                      <p className="font-display text-base font-bold text-forum-900">{thread.totalMessages}</p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Messages</p>
                    </div>
                    <div>
                      <p className="font-display text-base font-bold text-brass-700">{formatResponseTime(thread.analytics.avgResponseMinutes)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Avg. reply</p>
                    </div>
                    <div>
                      <p className="font-display text-base font-bold text-slateteal-700">{formatRelative(thread.analytics.lastActivityAt)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Last activity</p>
                    </div>
                  </div>
                )}

                <div className="border-t border-paper-border p-4 sm:p-5">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-forum-900">
                    <MessageSquare className="h-4 w-4 text-forum-600" />
                    Reply
                  </p>
                  <TextArea
                    rows={4}
                    placeholder="Write your reply..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <div className="mt-3">
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
                  <div className="mt-3 flex items-center justify-end gap-3">
                    {replyFiles.blocked && (
                      <p className="text-xs text-ink-subtle">
                        {replyFiles.busy ? 'Waiting for uploads to finish…' : 'Retry or remove the failed attachment.'}
                      </p>
                    )}
                    <Button
                      variant="primary"
                      disabled={!reply.trim() || sending || replyFiles.blocked}
                      onClick={() => void sendReply()}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Send Reply
                      {!sending && <ChevronRight className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="flex flex-1 items-center justify-center p-10 text-center text-sm text-ink-subtle">
              {initialLoading ? 'Loading…' : 'Select a conversation to read it.'}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
