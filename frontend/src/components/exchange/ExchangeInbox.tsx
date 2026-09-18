import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye, FileText, Image as ImageIcon, FileSpreadsheet, Loader2, RefreshCw, Search, Send, X } from 'lucide-react';
import { exchangeApi, documentKind, type ExchangeView, type ExchangeResult, type ExchangeDocument, type ExchangeConversation, type ExchangeVideo, type ExchangeAnnouncement } from '../../api/documentExchange';
import { memberApi } from '../../api/member';
import { downloadAttachment } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAttachments } from '../../hooks/useAttachments';
import { MessageThread } from '../messaging/MessageThread';
import { ComposerAttachments } from '../messaging/ComposerAttachments';
import Button from '../common/Button';
import Badge from '../common/Badge';
import { Card, CardContent } from '../common/Card';
import ExchangePreview, { type PreviewDocument } from './ExchangePreview';
import { formatBytes } from '../../utils/formatBytes';
import MemberAnnouncementList from '../announcements/MemberAnnouncementList';

const titles: Record<ExchangeView, string> = { documents: 'Shared Documents', messages: 'Messages from CRO', videos: 'Video Links', announcements: 'Announcements' };
const inputClass = 'min-w-0 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm text-ink';
const stamp = (value: string) => new Date(value).toLocaleString();
type Item = ExchangeDocument | ExchangeConversation | ExchangeVideo | ExchangeAnnouncement;

function Thread({ id, back, preview, changed }: { id: string; back: () => void; preview: (file: PreviewDocument) => void; changed: () => void }) {
  const thread = usePolledApiData(() => memberApi.conversation(id), [id], 15000);
  const [reply, setReply] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const files = useAttachments({ upload: memberApi.uploadFile });
  const last = thread.data?.messages.at(-1)?.id;
  useEffect(() => {
    if (last) void memberApi.markConversationRead(id).then(changed).catch(() => setError('Could not mark this conversation as read.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, last]);
  const send = async () => {
    if (lock.current || files.blocked) return;
    if (!reply.trim()) { setError('Write a reply.'); return; }
    lock.current = true; setBusy(true); setError(''); setSuccess(false);
    try { await memberApi.sendMessage(id, reply.trim(), { fileIds: files.fileIds(), links: files.linkPayload() }); setReply(''); files.reset(); thread.refresh(); changed(); setSuccess(true); }
    catch (e) { setError(normalizeError(e).message); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    <Button variant="ghost" size="sm" onClick={back}><ArrowLeft className="h-4 w-4" />All conversations</Button>
    {thread.initialLoading && <p role="status" className="py-6 text-sm">Loading conversation...</p>}
    {thread.error && <p role="alert" className="py-4 text-sm text-danger-600">{thread.error}<Button variant="ghost" size="sm" onClick={thread.refresh}><RefreshCw className="h-4 w-4" />Retry</Button></p>}
    {thread.data && <><h3 className="mt-4 break-words font-semibold">{thread.data.subject}</h3><MessageThread messages={thread.data.messages} conversationId={id} onOpenAttachment={preview} />
      <form className="space-y-3 border-t border-paper-border pt-4" onSubmit={e => { e.preventDefault(); void send(); }}>
        <textarea aria-label="Reply" value={reply} disabled={busy} maxLength={10000} onChange={e => { setReply(e.target.value); setError(''); setSuccess(false); }} className={`${inputClass} min-h-24 w-full`} placeholder="Write a reply..." />
        <ComposerAttachments attachments={files.attachments} fileError={files.fileError} links={files.links} disabled={busy} onAddFiles={files.addFiles} onRemoveFile={files.remove} onRetryFile={files.retry} onAddLink={files.addLink} onRemoveLink={files.removeLink} />
        {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}{success && <p role="status" className="text-sm text-success-600">Reply sent.</p>}
        <Button type="submit" disabled={busy || files.blocked}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Reply</Button>
      </form></>}
  </>;
}

type InboxProps = { view: ExchangeView; revision: number; close: () => void; changed: () => void };
export default function ExchangeInbox(props: InboxProps) {
  if (props.view !== 'announcements') return <OtherExchangeInbox {...props} />;
  return <Card><CardContent className="p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-forum-900">Announcements</h2><button title="Close view" aria-label="Close view" onClick={props.close} className="shrink-0 text-ink-muted"><X className="h-5 w-5" /></button></div>
    <MemberAnnouncementList />
  </CardContent></Card>;
}
function OtherExchangeInbox({ view, revision, close, changed }: InboxProps) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('All');
  const [direction, setDirection] = useState('all');
  const [opened, setOpened] = useState('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDocument | null>(null);
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  useEffect(() => { const timer = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const list = usePolledApiData<ExchangeResult<Item>>(() => view === 'documents' ? exchangeApi.documents({ q, type, direction, opened, page, limit }) : exchangeApi.items(view, page, limit),
    [view, q, type, direction, opened, page, limit, revision], 30000, { enabled: !selected });
  const data = list.data;
  useEffect(() => { if (data && !list.loading && page > data.pagination.pages) setPage(data.pagination.pages); }, [data, list.loading, page]);
  const refresh = () => { list.refresh(); changed(); };
  const download = async (doc: ExchangeDocument) => {
    setBusyId(doc.attachmentId); setActionError('');
    try { await downloadAttachment(doc.id, doc.name, doc.attachmentId); refresh(); }
    catch { setActionError('Could not download this document. It may no longer be available. Please retry.'); }
    finally { setBusyId(''); }
  };
  return <Card><CardContent className="p-6">
    <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-semibold text-forum-900">{titles[view]}</h2><button title="Close view" aria-label="Close view" onClick={close} className="shrink-0 text-ink-muted"><X className="h-5 w-5" /></button></div>
    {selected ? <Thread key={selected} id={selected} back={() => { setSelected(null); refresh(); }} preview={setPreview} changed={refresh} /> : <>
      {view === 'documents' && <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`flex items-center gap-2 ${inputClass}`}><Search className="h-4 w-4 shrink-0 text-ink-muted" /><input aria-label="Search documents" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents" maxLength={220} className="min-w-0 w-full bg-transparent outline-none" /></label>
        <select aria-label="File type" value={type} onChange={e => { setType(e.target.value); setPage(1); }} className={inputClass}>{['All', 'PDF', 'DOC', 'SHEET', 'SLIDES', 'IMAGE', 'FILE'].map(value => <option key={value} value={value}>{value === 'All' ? 'All file types' : value}</option>)}</select>
        <select aria-label="Direction" value={direction} onChange={e => { setDirection(e.target.value); setPage(1); }} className={inputClass}><option value="all">Sent &amp; Received</option><option value="incoming">Received</option><option value="outgoing">Sent</option></select>
        <select aria-label="Opening status" value={opened} onChange={e => { setOpened(e.target.value); setPage(1); }} className={inputClass}><option value="all">All opening statuses</option><option value="opened">Opened</option><option value="unopened">Unopened</option></select>
      </div>}
      <div aria-live="polite">{list.initialLoading && <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" />Loading...</p>}</div>
      {list.error && <p role="alert" className="my-4 text-sm text-danger-600">{list.error}<Button size="sm" variant="ghost" onClick={list.refresh}><RefreshCw className="h-4 w-4" />Retry</Button></p>}
      {actionError && <p role="alert" className="my-3 text-sm text-danger-600">{actionError}</p>}
      {!list.loading && !list.error && data?.items.length === 0 && <div className="py-8 text-center text-ink-muted"><FileText className="mx-auto mb-3 h-12 w-12 text-forum-100" /><p>{q || type !== 'All' || direction !== 'all' || opened !== 'all' ? 'No documents match these filters.' : `No ${view} yet.`}</p></div>}
      <div className="divide-y divide-paper-border" aria-busy={list.loading}>
        {data?.items.map(item => {
          if ('attachmentId' in item) {
            const kind = documentKind(item.type);
            const Icon = kind === 'IMAGE' ? ImageIcon : kind === 'SHEET' ? FileSpreadsheet : FileText;
            const color = kind === 'PDF' ? 'bg-brass-100 text-brass-700' : kind === 'SHEET' ? 'bg-success-100 text-success-600' : kind === 'IMAGE' || kind === 'SLIDES' ? 'bg-slateteal-100 text-slateteal-700' : 'bg-forum-50 text-forum-700';
            return <div key={item.attachmentId} className="flex items-start gap-3 rounded px-3 py-3 transition-colors hover:bg-forum-50/30">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${color}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-medium text-forum-900" title={item.name}>{item.name}</p><p className="mt-0.5 text-xs text-ink-muted">{formatBytes(item.size)} / {stamp(item.date)}</p><p className="mt-1 line-clamp-2 break-words text-xs text-ink-muted">{item.note}</p>
                <div className="mt-2 flex flex-wrap gap-2"><Badge>{item.direction === 'outgoing' ? 'Sent' : 'Received'}</Badge><Badge variant={item.opened ? 'success' : 'default'}>{item.opened ? 'Opened' : 'Unopened'}</Badge><span className="text-xs text-ink-muted">{item.sender}</span></div></div>
              <div className="flex shrink-0 gap-1"><button title="Preview" aria-label={`Preview ${item.name}`} onClick={() => setPreview(item)} className="rounded p-1.5 text-ink-muted hover:bg-forum-50"><Eye className="h-4 w-4" /></button><button title="Download" aria-label={`Download ${item.name}`} disabled={!!busyId} onClick={() => void download(item)} className="rounded p-1.5 text-ink-muted hover:bg-forum-50 disabled:opacity-50">{busyId === item.attachmentId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</button></div>
            </div>;
          }
          if ('lastPreview' in item) return <button key={item.id} onClick={() => setSelected(item.id)} className="block w-full px-3 py-4 text-left hover:bg-forum-50/30"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 break-words font-medium text-forum-900">{item.subject}</span>{item.unreadCount > 0 && <Badge>{item.unreadCount} unread</Badge>}</div><p className="mt-1 line-clamp-2 break-words text-sm text-ink-muted">{item.lastPreview}</p><p className="mt-2 text-xs text-ink-muted">{stamp(item.lastActivity)} / {item.totalMessages} messages</p></button>;
          if ('url' in item) return <div key={item.id} className="px-3 py-4"><a href={/^https?:\/\//i.test(item.url) ? item.url : undefined} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-forum-700 underline">{item.label || item.url}</a><p className="mt-2 text-xs text-ink-muted">{item.direction === 'outgoing' ? 'Sent' : 'Received'} / {item.sender} / {stamp(item.date)}</p></div>;
          return <article key={item.id} className="px-3 py-4"><h3 className="break-words font-semibold text-forum-900">{item.subject}</h3><p className="my-2 text-xs text-ink-muted">{item.sentAt && stamp(item.sentAt)}</p><p className="whitespace-pre-wrap break-words text-sm text-ink">{item.body}</p></article>;
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper-border pt-4 text-xs text-ink-muted">
        <span>{data ? `${data.pagination.total} ${view}` : 'Loading...'}</span>
        <div className="flex items-center gap-2"><label>Rows <select aria-label="Rows per page" value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }} className="ml-1 rounded border border-paper-border bg-paper p-1">{[10, 25, 50].map(n => <option key={n}>{n}</option>)}</select></label>
          <Button size="sm" variant="ghost" title="Previous page" aria-label="Previous page" disabled={page <= 1 || list.loading} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>{page} / {data?.pagination.pages ?? 1}</span><Button size="sm" variant="ghost" title="Next page" aria-label="Next page" disabled={!data || page >= data.pagination.pages || list.loading} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
    </>}
    {preview && <ExchangePreview key={preview.attachmentId ?? preview.id} file={preview} close={() => setPreview(null)} opened={refresh} />}
  </CardContent></Card>;
}
