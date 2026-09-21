import { useMemo, useState } from 'react';
import { ArrowLeft, Edit3, Flag, LogOut, MessageSquare, Search, Trash2, UserPlus } from 'lucide-react';
import Button from '../../components/common/Button';
import ChatComposer from '../../components/community/ChatComposer';
import CommunityAvatar from '../../components/community/CommunityAvatar';
import ConfirmationDialog from '../../components/community/ConfirmationDialog';
import EmptyCommunityState from '../../components/community/EmptyCommunityState';
import MembershipStatusBadge from '../../components/community/MembershipStatusBadge';
import { CommunityToast, controlClass, formatDate, panelClass } from '../../components/community/AdminCommunityUi';
import { ExchangeModal } from '../../components/exchange/ExchangeDialog';
import { useAuth } from '../../context/AuthContext';
import { buildMemberSample, selfMemberRow } from '../../data/communityMemberData';
import type { Community, CommunityConversation, CommunityMember, CommunityMessage, MembershipStatus } from '../../types/community';

/**
 * Member community hub. Renders from the local sample dataset until the /community/* routes exist;
 * every mutation (membership, messages, reports) only touches React state and resets on reload.
 */
export default function CommunityPage() {
  const { user } = useAuth();
  const sample = useMemo(() => buildMemberSample(user), [user]);
  const identity = sample.identity;
  const [communities, setCommunities] = useState<Community[]>(sample.communities);
  const [threads, setThreads] = useState<Record<string, CommunityMessage[]>>(sample.messagesByConversation);
  const [selected, setSelected] = useState<Community | null>(null);
  const [conversations, setConversations] = useState<CommunityConversation[]>([]);
  const [conversation, setConversation] = useState<CommunityConversation | null>(null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('');
  const [mine, setMine] = useState(false);
  const [reply, setReply] = useState<CommunityMessage | null>(null);
  const [editing, setEditing] = useState<CommunityMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [deleting, setDeleting] = useState<CommunityMessage | null>(null);
  const [reporting, setReporting] = useState<{ kind: 'message' | 'member'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'community' | 'chat'>('list');
  const notify = (message: string) => { setToast({ message, error: false }); window.setTimeout(() => setToast(null), 3500); };
  const messages = conversation ? threads[conversation.id] ?? [] : [];
  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    return communities.filter((community) =>
      (!mine || Boolean(community.membershipStatus))
      && (!visibility || community.visibility === visibility)
      && (!term || [community.name, community.category, community.description].some((value) => value.toLowerCase().includes(term))));
  }, [communities, mine, query, visibility]);
  const openCommunity = (community: Community) => { setSelected(community); setConversation(null); setMobileView('community'); setConversations(community.membershipStatus === 'ACTIVE' ? sample.conversationsByCommunity[community.id] ?? [] : []); setMembers(community.membershipStatus === 'ACTIVE' ? sample.membersByCommunity[community.id] ?? [] : []); };
  const openConversation = (item: CommunityConversation) => { setConversation(item); setReply(null); setMobileView('chat'); };
  const membership = (kind: 'join' | 'cancel' | 'leave') => {
    if (!selected) return;
    if (kind === 'join') {
      const status: MembershipStatus = selected.visibility === 'PRIVATE' ? 'PENDING' : 'ACTIVE';
      const updated: Community = { ...selected, membershipStatus: status, membershipId: `memb-${selected.id}-${Date.now()}` };
      setSelected(updated); setCommunities((items) => items.map((item) => (item.id === selected.id ? updated : item)));
      if (status === 'ACTIVE') { setConversations(sample.conversationsByCommunity[selected.id] ?? []); setMembers([...(sample.membersByCommunity[selected.id] ?? []), selfMemberRow(updated, identity)]); }
      notify(status === 'PENDING' ? 'Join request sent.' : 'Community joined.');
      return;
    }
    const updated: Community = { ...selected, membershipStatus: undefined, membershipId: undefined };
    setSelected(updated); setCommunities((items) => items.map((item) => (item.id === selected.id ? updated : item)));
    setConversations([]); setMembers([]); setConversation(null);
    notify(kind === 'cancel' ? 'Join request cancelled.' : 'You left the community.');
  };
  // Local stand-in for POST /community/conversations/:id/messages.
  const send = async (content: string, files: File[]): Promise<boolean> => {
    if (!conversation) return false;
    const createdAt = new Date().toISOString();
    const message: CommunityMessage = { id: `msg-${Date.now()}`, conversationId: conversation.id, senderId: identity.id, senderName: identity.fullName, senderRole: 'MEMBER', content, replyTo: reply, attachments: files.map((file, index) => ({ id: `att-${Date.now()}-${index}`, fileName: file.name, fileUrl: URL.createObjectURL(file), fileType: file.type || 'application/octet-stream', fileSize: file.size })), isPinned: false, isHidden: false, isDeleted: false, isRead: true, createdAt, updatedAt: createdAt };
    setThreads((all) => ({ ...all, [conversation.id]: [...(all[conversation.id] ?? []), message] }));
    setReply(null);
    return true;
  };
  const saveEdit = () => { if (!editing || !editText.trim() || !conversation) return; const updatedAt = new Date().toISOString(); setThreads((all) => ({ ...all, [conversation.id]: (all[conversation.id] ?? []).map((item) => (item.id === editing.id ? { ...item, content: editText.trim(), updatedAt } : item)) })); setEditing(null); notify('Message updated.'); };
  const removeMessage = () => { if (!deleting || !conversation) return; setThreads((all) => ({ ...all, [conversation.id]: (all[conversation.id] ?? []).map((item) => (item.id === deleting.id ? { ...item, isDeleted: true, attachments: [] } : item)) })); setDeleting(null); notify('Message deleted.'); };
  // The real flow posts to communityService.reportMessage / reportMember once those routes exist.
  const submitReport = () => { if (!reporting || !reportReason.trim()) return; setReporting(null); setReportReason(''); notify('Report submitted for review.'); };
  return <div className="space-y-6">
    <div><h1 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">Community</h1><p className="mt-1 text-sm text-ink-muted">Browse groups, connect with members, and join conversations.</p></div>
    <div className={`${panelClass} grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]`}><label className="relative"><span className="sr-only">Search communities</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" /><input className={`${controlClass} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search communities" /></label><select aria-label="Visibility" className={controlClass} value={visibility} onChange={(e) => setVisibility(e.target.value)}><option value="">All visibility</option><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select><Button variant={mine ? 'primary' : 'outline'} onClick={() => setMine((value) => !value)}>My Communities</Button></div>
    <div className={`${panelClass} grid min-h-[620px] overflow-hidden lg:grid-cols-[280px_300px_minmax(0,1fr)]`}>
      <aside className={`${mobileView !== 'list' ? 'hidden lg:block' : ''} border-r border-paper-border p-3`}>{!visible.length ? <EmptyCommunityState title={mine ? 'No communities joined yet' : 'No communities found'} description={mine ? 'Turn off the My Communities filter to browse all groups.' : 'Try changing your search or visibility filter.'} /> : <div className="space-y-2">{visible.map((community) => <button key={community.id} type="button" onClick={() => openCommunity(community)} className={`flex w-full items-center gap-3 rounded-lg p-3 text-left ${selected?.id === community.id ? 'bg-forum-50 ring-1 ring-forum-200' : 'hover:bg-forum-50'}`}><CommunityAvatar name={community.name} src={community.imageUrl} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-forum-900">{community.name}</span><span className="block text-xs text-ink-muted">{community.memberCount} members · {community.visibility.toLowerCase()}</span></span>{community.membershipStatus && <MembershipStatusBadge status={community.membershipStatus} />}</button>)}</div>}</aside>
      <section className={`${mobileView !== 'community' ? 'hidden lg:block' : ''} border-r border-paper-border p-4`}>{selected ? <><Back onClick={() => setMobileView('list')} /><div className="flex items-center gap-3"><CommunityAvatar name={selected.name} src={selected.imageUrl} className="h-14 w-14" /><div><h2 className="font-semibold text-forum-900">{selected.name}</h2><p className="text-xs text-ink-muted">{selected.category}</p></div></div><p className="mt-4 text-sm text-ink-muted">{selected.description}</p><div className="mt-4 flex flex-wrap items-center gap-2">{selected.membershipStatus && <MembershipStatusBadge status={selected.membershipStatus} />}<MembershipAction community={selected} act={membership} /></div>{selected.membershipStatus === 'ACTIVE' && <><h3 className="mt-6 font-semibold text-forum-900">Conversations</h3><div className="mt-2 space-y-2">{conversations.length ? conversations.map((item) => <button type="button" key={item.id} onClick={() => openConversation(item)} className="w-full rounded-lg border border-paper-border p-3 text-left hover:bg-forum-50"><span className="block text-sm font-medium text-forum-900">{item.title}</span><span className="text-xs text-ink-muted">{threads[item.id]?.length ?? item.messageCount} messages {item.isLocked ? '· Locked' : ''}</span></button>) : <p className="py-4 text-sm text-ink-muted">No conversations are available.</p>}</div><h3 className="mt-6 font-semibold text-forum-900">Member directory</h3><div className="mt-2 space-y-2">{members.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-lg border border-paper-border p-2"><CommunityAvatar name={member.fullName} src={member.profileImageUrl} className="h-8 w-8 rounded-full" /><span className="min-w-0 flex-1 truncate text-sm">{member.fullName}{member.userId === identity.id ? ' (you)' : ''}</span>{member.userId !== identity.id && <button title="Report member" aria-label={`Report ${member.fullName}`} onClick={() => setReporting({ kind: 'member', id: member.id })} className="p-1 text-ink-muted"><Flag className="h-3.5 w-3.5" /></button>}</div>)}</div></>}</> : <EmptyCommunityState title="Select a community" description="Choose a community to see its details." />}</section>
      <section className={`${mobileView !== 'chat' ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col`}>{conversation ? <><header className="flex items-center gap-2 border-b border-paper-border p-3"><Back onClick={() => setMobileView('community')} /><div><h2 className="font-semibold text-forum-900">{conversation.title}</h2><p className="text-xs text-ink-muted">{conversation.communityName}</p></div></header><div className="flex-1 space-y-3 overflow-y-auto bg-forum-50/30 p-4">{messages.length ? messages.map((message) => <article key={message.id} className="rounded-lg border border-paper-border bg-paper-raised p-3"><div className="flex items-center gap-2"><CommunityAvatar name={message.senderName} src={message.senderImageUrl} className="h-8 w-8 rounded-full" /><strong className="text-sm text-forum-900">{message.senderName}{message.senderId === identity.id ? ' (you)' : ''}</strong><time className="ml-auto text-xs text-ink-subtle">{formatDate(message.createdAt)}</time></div>{message.replyTo && <p className="mt-2 border-l-2 border-forum-200 pl-2 text-xs text-ink-muted">Reply to {message.replyTo.senderName}: {message.replyTo.content}</p>}<p className="mt-2 whitespace-pre-wrap break-words text-sm text-forum-900">{message.isDeleted ? 'This message was deleted.' : message.content}</p>{message.attachments?.map((file) => <a key={file.id} href={file.fileUrl} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-forum-700 underline">{file.fileName}</a>)}{!message.isDeleted && <div className="mt-2 flex gap-1"><Mini title="Reply" onClick={() => setReply(message)}><MessageSquare /></Mini>{message.senderId === identity.id && <><Mini title="Edit" onClick={() => { setEditing(message); setEditText(message.content); }}><Edit3 /></Mini><Mini title="Delete" onClick={() => setDeleting(message)}><Trash2 /></Mini></>}<Mini title="Report" onClick={() => setReporting({ kind: 'message', id: message.id })}><Flag /></Mini></div>}</article>) : <p className="p-8 text-center text-sm text-ink-muted">No messages yet.</p>}</div><ChatComposer locked={conversation.isLocked || selected?.membershipStatus !== 'ACTIVE'} busy={false} replyTo={reply} cancelReply={() => setReply(null)} send={send} /></> : <div className="flex flex-1 items-center justify-center text-sm text-ink-muted"><MessageSquare className="mr-2 h-5 w-5" />Select a conversation</div>}</section>
    </div>
    {editing && <ExchangeModal title="Edit message" close={() => setEditing(null)} busy={false}><textarea rows={5} value={editText} onChange={(e) => setEditText(e.target.value)} className={`${controlClass} w-full`} /><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button disabled={!editText.trim()} onClick={saveEdit}>Save</Button></div></ExchangeModal>}
    {deleting && <ConfirmationDialog title="Delete message?" description="Your message will be removed from the conversation." confirmLabel="Delete" busy={false} onClose={() => setDeleting(null)} onConfirm={removeMessage} />}
    {reporting && <ExchangeModal title={`Report ${reporting.kind}`} close={() => setReporting(null)} busy={false}><label className="block text-sm font-medium text-forum-900">Reason<textarea required rows={4} value={reportReason} onChange={(e) => setReportReason(e.target.value)} className={`${controlClass} mt-1 w-full`} /></label><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setReporting(null)}>Cancel</Button><Button disabled={!reportReason.trim()} onClick={submitReport}>Submit report</Button></div></ExchangeModal>}
    {toast && <CommunityToast {...toast} close={() => setToast(null)} />}
  </div>;
}

function MembershipAction({ community, act }: { community: Community; act: (kind: 'join' | 'cancel' | 'leave') => void }) {
  if (community.membershipStatus === 'ACTIVE') return <Button size="sm" variant="outline" onClick={() => act('leave')}><LogOut className="h-4 w-4" />Leave Community</Button>;
  if (community.membershipStatus === 'PENDING') return <Button size="sm" variant="outline" onClick={() => act('cancel')}>Cancel Pending Request</Button>;
  if (community.membershipStatus === 'REJECTED') return <span className="text-sm text-danger-600">Membership Rejected</span>;
  if (community.membershipStatus === 'SUSPENDED') return <span className="text-sm text-danger-600">Membership Suspended</span>;
  if (community.membershipStatus === 'BLOCKED') return <span className="text-sm text-danger-600">Membership Blocked</span>;
  return <Button size="sm" onClick={() => act('join')}><UserPlus className="h-4 w-4" />{community.visibility === 'PRIVATE' ? 'Request to Join' : 'Join Community'}</Button>;
}
function Mini({ title, children, onClick }: { title: string; children: React.ReactNode; onClick: () => void }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className="rounded p-1.5 text-ink-muted hover:bg-forum-50 [&>svg]:h-3.5 [&>svg]:w-3.5">{children}</button>; }
function Back({ onClick }: { onClick: () => void }) { return <button type="button" title="Back" aria-label="Back" onClick={onClick} className="mb-3 rounded-md p-2 text-forum-700 hover:bg-forum-50 lg:hidden"><ArrowLeft className="h-4 w-4" /></button>; }
