import { communityChanged, useCommunityFeed, useCommunityResource } from '../../hooks/useCommunityResource';
import CommunityLoadMore from '../../components/community/CommunityLoadMore';
import { CommunityAttachmentLink } from '../../components/community/CommunityMedia';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Edit3, Flag, LogOut, MessageSquare, Search, Trash2, UserPlus } from 'lucide-react';
import { normalizeError } from '../../api/client';
import Button from '../../components/common/Button';
import ChatComposer from '../../components/community/ChatComposer';
import CommunityAvatar from '../../components/community/CommunityAvatar';
import CommunityPageSkeleton from '../../components/community/CommunityPageSkeleton';
import ConfirmationDialog from '../../components/community/ConfirmationDialog';
import EmptyCommunityState from '../../components/community/EmptyCommunityState';
import MembershipStatusBadge from '../../components/community/MembershipStatusBadge';
import { CommunityToast, controlClass, formatDate, panelClass } from '../../components/community/AdminCommunityUi';
import { ExchangeModal } from '../../components/exchange/ExchangeDialog';
import { useAuth } from '../../context/AuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { communityService } from '../../services/communityService';
import type { Community, CommunityConversation, CommunityMessage } from '../../types/community';

export default function CommunityPage() {
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); const search = useDebouncedValue(query);
  const [visibility, setVisibility] = useState(''); const [mine, setMine] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<CommunityMessage | null>(null); const [editing, setEditing] = useState<CommunityMessage | null>(null); const [editText, setEditText] = useState(''); const [deleting, setDeleting] = useState<CommunityMessage | null>(null);
  const [reporting, setReporting] = useState<{ kind: 'message' | 'member'; id: string } | null>(null); const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState(''); const reportLock = useRef(false); const reportVersion = useRef(0);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null); const [mobileView, setMobileView] = useState<'list' | 'community' | 'chat'>('list');
  const list = useCommunityFeed(JSON.stringify(['member-communities', search, visibility, mine]), page => mine ? communityService.getMyCommunities({ page, search, visibility, limit: 50 }) : communityService.getCommunities({ page, search, visibility, limit: 50 }));
  const detail = useCommunityResource(selectedId ? `member-community:${selectedId}` : null, () => communityService.getCommunity(selectedId!), 8000);
  const selected = detail.data;
  const active = selected?.membershipStatus === 'ACTIVE' || user?.role === 'ADMIN';
  const chats = useCommunityFeed(selected && active ? `member-conversations:${selected.id}` : null, page => communityService.getConversations(selected!.id, { page, limit: 50 }), 8000);
  const directory = useCommunityFeed(selected && active ? `member-directory:${selected.id}` : null, page => communityService.getMembers(selected!.id, { page, limit: 50 }));
  const conversation = chats.items.find(item => item.id === conversationId) ?? null;
  const messageData = useCommunityFeed(conversation ? `member-messages:${conversation.id}` : null, page => communityService.getMessages(conversation!.id, { page, limit: 100 }), 8000, true);
  const communities = list.items, conversations = chats.items, members = directory.items, messages = messageData.items;
  const loading = list.loading, error = list.error;
  const loadCommunities = list.refresh;
  const scrollRef = useRef<HTMLDivElement>(null); const nearBottom = useRef(true); const olderHeight = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (olderHeight.current !== null) { el.scrollTop += el.scrollHeight - olderHeight.current; olderHeight.current = null; }
    else if (nearBottom.current) el.scrollTop = el.scrollHeight;
  }, [messageData.data]);
  useEffect(() => {
    setReply(null); setEditing(null); setDeleting(null); setReporting(null); setReportReason(''); setReportError(''); reportVersion.current++;
  }, [selectedId, conversationId, user?.id]);
  useEffect(() => {
    if (selectedId && !detail.loading && (!selected || !active)) { setConversationId(null); setReply(null); setEditing(null); setDeleting(null); }
  }, [selectedId, detail.loading, selected, active]);
  useEffect(() => {
    if (!messageData.loading && reply && !messages.some(m => m.id === reply.id && !m.isDeleted)) setReply(null);
    if (!messageData.loading && editing && !messages.some(m => m.id === editing.id && !m.isDeleted)) setEditing(null);
    if (!messageData.loading && deleting && !messages.some(m => m.id === deleting.id && !m.isDeleted)) setDeleting(null);
  }, [messageData.loading, messages, reply, editing, deleting]);
  const notify = (message: string, isError = false) => { setToast({ message, error: isError }); window.setTimeout(() => setToast(null), 3500); };
  const openCommunity = (community: Community) => { setSelectedId(community.id); setConversationId(null); setMobileView('community'); };
  const openConversation = (item: CommunityConversation) => { nearBottom.current = true; setConversationId(item.id); setMobileView('chat'); };
  const refresh = async () => { communityChanged(); await Promise.all([list.refresh(), detail.refresh(), chats.refresh(), directory.refresh(), messageData.refresh()]); };
  const membership = async (kind: 'join' | 'cancel' | 'leave') => { if (!selected || busy) return; setBusy(true); try { if (kind === 'join') await communityService.joinCommunity(selected.id); else if (kind === 'cancel') await communityService.cancelJoinRequest(selected.id); else await communityService.leaveCommunity(selected.id); notify(kind === 'leave' ? 'You left the community.' : kind === 'cancel' ? 'Join request cancelled.' : selected.visibility === 'PRIVATE' ? 'Join request sent.' : 'Community joined.'); setSelectedId(null); setConversationId(null); setMobileView('list'); await refresh(); } catch (failure) { notify(normalizeError(failure).message, true); } finally { setBusy(false); } };
  const send = async (content: string, files: File[]) => { if (!conversation || busy) return false; setBusy(true); try { await communityService.sendMessage(conversation.id, content, reply?.id, files); setReply(null); await refresh(); return true; } catch (failure) { notify(normalizeError(failure).message, true); return false; } finally { setBusy(false); } };
  const saveEdit = async () => { if (!editing || !editText.trim() || !conversation || busy) return; setBusy(true); try { await communityService.updateMessage(editing.id, editText.trim()); setEditing(null); await refresh(); notify('Message updated.'); } catch (failure) { notify(normalizeError(failure).message, true); } finally { setBusy(false); } };
  const removeMessage = async () => { if (!deleting || !conversation || busy) return; setBusy(true); try { await communityService.deleteMessage(deleting.id); setDeleting(null); await refresh(); notify('Message deleted.'); } catch (failure) { notify(normalizeError(failure).message, true); } finally { setBusy(false); } };
  const closeReport = () => { setReporting(null); setReportReason(''); setReportError(''); reportVersion.current++; };
  const openReport = (target: { kind: 'message' | 'member'; id: string }) => { if (busy || reportLock.current) return; setReportReason(''); setReportError(''); reportVersion.current++; setReporting(target); };
  useEffect(() => {
    if (!reporting) return;
    const unavailable = !detail.loading && (!selected || !active)
      || reporting.kind === 'message' && !messageData.loading && !messages.some(message => message.id === reporting.id && !message.isDeleted)
      || reporting.kind === 'member' && !directory.loading && !members.some(member => member.id === reporting.id);
    if (unavailable) { setReporting(null); setReportReason(''); setReportError(''); reportVersion.current++; }
  }, [reporting, detail.loading, selected, active, messageData.loading, messages, directory.loading, members]);
  const submitReport = async () => {
    if (!reporting || !selected || !reportReason.trim() || busy || reportLock.current) return;
    reportLock.current = true; setBusy(true); setReportError('');
    const version = reportVersion.current;
    try {
      if (reporting.kind === 'message') await communityService.reportMessage(reporting.id, reportReason);
      else await communityService.reportMember(reporting.id, selected.id, reportReason);
      if (version !== reportVersion.current) return;
      closeReport(); communityChanged(); notify('Report submitted for review.');
    } catch (failure) {
      if (version !== reportVersion.current) return;
      const problem = normalizeError(failure);
      if ([401, 403, 404].includes(problem.status ?? 0)) { closeReport(); communityChanged(); notify(problem.message, true); }
      else setReportError(problem.fieldErrors.reason ?? problem.message);
    } finally { reportLock.current = false; setBusy(false); }
  };
  const loadOlder = () => { if (!messageData.hasMore || messageData.loading) return; olderHeight.current = scrollRef.current?.scrollHeight ?? null; void messageData.loadMore(); };
  return <div className="space-y-6">
    <div><h1 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Community</h1><p className="mt-1 text-sm text-ink-muted">Browse groups, connect with members, and join conversations.</p></div>
    <div className={`${panelClass} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]`}><label className="relative"><span className="sr-only">Search communities</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" /><input className={`${controlClass} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" /></label><select aria-label="Visibility" className={controlClass} value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="">All visibility</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select><Button variant={mine ? 'primary' : 'outline'} onClick={() => setMine((value) => !value)}>My Communities</Button></div>
    <div className={`${panelClass} grid h-[620px] overflow-hidden lg:grid-cols-[280px_300px_minmax(0,1fr)]`}>
      <aside className={`${mobileView !== 'list' ? 'hidden lg:block' : ''} overflow-y-auto border-r border-paper-border p-3`}>{loading ? <CommunityPageSkeleton /> : error ? <EmptyCommunityState title="" error={error} retry={() => void loadCommunities()} /> : !communities.length ? <EmptyCommunityState title="No communities found" description="Try changing your search or visibility filter." /> : <div className="space-y-2">{communities.map((community) => <button key={community.id} type="button" onClick={() => void openCommunity(community)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${selected?.id === community.id ? 'bg-forum-50 ring-1 ring-forum-200' : 'hover:bg-forum-50'}`}><CommunityAvatar name={community.name} src={community.imageUrl} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-forum-900">{community.name}</span><span className="block text-xs text-ink-muted">{community.memberCount} members · {community.visibility}</span></span></button>)}<CommunityLoadMore more={list.hasMore} load={list.loadMore} /></div>}</aside>
      <section className={`${mobileView !== 'community' ? 'hidden lg:block' : ''} overflow-y-auto border-r border-paper-border p-4`}>{detail.loading ? <CommunityPageSkeleton /> : detail.error ? <EmptyCommunityState title="Community unavailable" error={detail.error} retry={() => void detail.refresh()} /> : selected ? <><Back onClick={() => setMobileView('list')} /><div className="flex items-center gap-3"><CommunityAvatar name={selected.name} src={selected.imageUrl} className="h-14 w-14" /><div><h2 className="font-semibold text-forum-900">{selected.name}</h2><p className="text-xs text-ink-muted">{selected.category}</p></div></div><p className="mt-4 text-sm text-ink-muted">{selected.description}</p><div className="mt-4 flex flex-wrap items-center gap-2">{selected.membershipStatus && <MembershipStatusBadge status={selected.membershipStatus} />}{user?.role === 'MEMBER' && <MembershipAction community={selected} busy={busy} act={(kind) => void membership(kind)} />}</div>{active && <><h3 className="mt-6 font-semibold text-forum-900">Conversations</h3><div className="mt-2 space-y-2">{chats.loading ? <CommunityPageSkeleton /> : chats.error ? <EmptyCommunityState title="" error={chats.error} retry={() => void chats.refresh()} /> : conversations.length ? conversations.map((item) => <button type="button" key={item.id} onClick={() => void openConversation(item)} className="w-full rounded-lg border border-paper-border p-3 text-left hover:bg-forum-50"><span className="block text-sm font-medium text-forum-900">{item.title}</span><span className="text-xs text-ink-muted">{item.messageCount} messages {item.isLocked ? '· Locked' : ''}</span></button>) : <p className="py-4 text-sm text-ink-muted">No conversations are available.</p>}<CommunityLoadMore more={chats.hasMore} load={chats.loadMore} /></div><h3 className="mt-6 font-semibold text-forum-900">Member directory</h3><div className="mt-2 space-y-2">{directory.loading && <CommunityPageSkeleton />}{directory.error && <EmptyCommunityState title="" error={directory.error} retry={() => void directory.refresh()} />}{members.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-lg border border-paper-border p-2"><CommunityAvatar name={member.fullName} src={member.profileImageUrl} className="h-8 w-8 rounded-full" /><span className="min-w-0 flex-1 truncate text-sm">{member.fullName}</span>{member.userId !== user?.id && <button title="Report member" aria-label={`Report ${member.fullName}`} onClick={() => openReport({ kind: 'member', id: member.id })} className="p-1 text-ink-muted"><Flag className="h-3.5 w-3.5" /></button>}</div>)}<CommunityLoadMore more={directory.hasMore} load={directory.loadMore} /></div></>}</> : <EmptyCommunityState title="Select a community" description="Choose a community to see its details." />}</section>
      <section className={`${mobileView !== 'chat' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col`}>{conversation ? <><header className="flex items-center gap-2 border-b border-paper-border p-3"><Back onClick={() => setMobileView('community')} /><div><h2 className="font-semibold text-forum-900">{conversation.title}</h2><p className="text-xs text-ink-muted">{conversation.communityName}</p></div></header><div ref={scrollRef} onScroll={e => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (el.scrollTop < 40 && !nearBottom.current) loadOlder(); }} className="flex-1 space-y-3 overflow-y-auto bg-forum-50/30 p-4">{messageData.loading ? <CommunityPageSkeleton /> : messageData.error && !messages.length ? <EmptyCommunityState title="" error={messageData.error} retry={() => void messageData.refresh()} /> : messages.length ? messages.map((message) => <article key={message.id} className="rounded-lg border border-paper-border bg-paper-raised p-3"><div className="flex items-center gap-2"><CommunityAvatar name={message.senderName} src={message.senderImageUrl} className="h-8 w-8 rounded-full" /><strong className="text-sm text-forum-900">{message.senderName}</strong><time className="ml-auto text-xs text-ink-subtle">{formatDate(message.createdAt)}</time></div>{message.replyTo && <p className="mt-2 border-l-2 border-forum-200 pl-2 text-xs text-ink-muted">Reply to {message.replyTo.senderName}: {message.replyTo.content}</p>}<p className="mt-2 whitespace-pre-wrap break-words text-sm text-forum-900">{message.isDeleted ? 'This message was deleted.' : message.content}</p>{message.attachments?.map((file) => <CommunityAttachmentLink key={file.id} file={file} className="mt-2 block text-xs text-forum-700 underline" />)}{!message.isDeleted && <div className="mt-2 flex gap-1"><Mini title="Reply" onClick={() => setReply(message)}><MessageSquare /></Mini>{message.senderId === user?.id && <><Mini title="Edit" onClick={() => { setEditing(message); setEditText(message.content); }}><Edit3 /></Mini><Mini title="Delete" onClick={() => setDeleting(message)}><Trash2 /></Mini></>}{message.senderId !== user?.id && <Mini title="Report" onClick={() => openReport({ kind: 'message', id: message.id })}><Flag /></Mini>}</div>}</article>) : <p className="p-8 text-center text-sm text-ink-muted">No messages yet.</p>}</div><ChatComposer key={conversation.id} locked={!messageData.data || conversation.isLocked || !active} busy={busy} replyTo={reply} cancelReply={() => setReply(null)} send={send} /></> : <div className="flex flex-1 items-center justify-center text-sm text-ink-muted"><MessageSquare className="mr-2 h-5 w-5" />Select a conversation</div>}</section>
    </div>
    {editing && <ExchangeModal title="Edit message" close={() => setEditing(null)} busy={busy}><textarea maxLength={10000} rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} className={`${controlClass} w-full`} /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy || !editText.trim()} onClick={() => void saveEdit()}>Save</Button></div></ExchangeModal>}
    {deleting && <ConfirmationDialog title="Delete message?" description="Your message will be removed from the conversation." confirmLabel="Delete" busy={busy} onClose={() => setDeleting(null)} onConfirm={() => void removeMessage()} />}
    {reporting && <ExchangeModal title={`Report ${reporting.kind}`} close={() => { if (!reportLock.current) closeReport(); }} busy={busy}><label className="block text-sm font-medium text-forum-900">Reason<textarea disabled={busy} maxLength={191} required rows={4} value={reportReason} onChange={(e) => { setReportReason(e.target.value); setReportError(''); }} className={`${controlClass} mt-1 w-full`} /></label>{reportError && <p role="alert" className="mt-2 text-sm text-danger-600">{reportError}</p>}<div className="mt-4 flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={closeReport}>Cancel</Button><Button disabled={busy || !reportReason.trim()} onClick={() => void submitReport()}>Submit report</Button></div></ExchangeModal>}
    {toast && <CommunityToast {...toast} close={() => setToast(null)} />}
  </div>;
}

function MembershipAction({ community, busy, act }: { community: Community; busy: boolean; act: (kind: 'join' | 'cancel' | 'leave') => void }) {
  if (community.membershipStatus === 'ACTIVE') return <Button size="sm" variant="outline" disabled={busy} onClick={() => act('leave')}><LogOut className="h-4 w-4" />Leave Community</Button>;
  if (community.membershipStatus === 'PENDING') return <Button size="sm" variant="outline" disabled={busy} onClick={() => act('cancel')}>Cancel Pending Request</Button>;
  if (community.membershipStatus === 'REJECTED') return <span className="text-sm text-danger-600">Membership Rejected</span>;
  if (community.membershipStatus === 'SUSPENDED') return <span className="text-sm text-danger-600">Membership Suspended</span>;
  if (community.membershipStatus === 'BLOCKED') return <span className="text-sm text-danger-600">Membership Blocked</span>;
  return <Button size="sm" disabled={busy} onClick={() => act('join')}><UserPlus className="h-4 w-4" />{community.visibility === 'PRIVATE' ? 'Request to Join' : 'Join Community'}</Button>;
}
function Mini({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: () => void }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className="rounded p-1.5 text-ink-muted hover:bg-forum-50 [&>svg]:h-3.5 [&>svg]:w-3.5">{children}</button>; }
function Back({ onClick }: { onClick: () => void }) { return <button type="button" title="Back" aria-label="Back" onClick={onClick} className="mb-3 rounded-md p-2 text-forum-700 hover:bg-forum-50 lg:hidden"><ArrowLeft className="h-4 w-4" /></button>; }
