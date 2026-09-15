import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Award,
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Globe2,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import {
  DISCUSSION_TITLE_MAX,
  DISCUSSION_TITLE_MIN,
  memberApi,
  type CommunityGroup,
  type CommunityMember,
  type CommunityResult,
  type CommunityThread,
  type CommunityThreadDetail,
  type DirectConversation,
} from '../../api/member';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';

type Member = CommunityMember;
type InterestGroup = CommunityGroup;

const PAGE_SIZE = 4;

/**
 * The error banner, rendered inside whichever modal is open.
 *
 * The page-level one sits behind the modal backdrop, so an action that failed
 * from inside a dialog used to look like it simply did nothing.
 */
function ModalError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="mt-4 flex items-start gap-3 rounded-lg border border-danger-600/20 bg-danger-100 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600" />
      <p className="text-sm text-danger-600">{message}</p>
    </div>
  );
}

function initials(name: string) {
  return name.replace(/^(Prof\.|Dr\.)\s+/, '').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

/** "1h ago" / "Yesterday" / a date, matching what the cards used to show. */
function relativeTime(value: string) {
  const then = new Date(value).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  if (hours < 48) return 'Yesterday';
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CommunityPage() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [interest, setInterest] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; run: () => void } | null>(null);
  const [newDiscussionOpen, setNewDiscussionOpen] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<InterestGroup | null>(null);
  const [selectedThread, setSelectedThread] = useState<CommunityThread | null>(null);
  const [threadDetail, setThreadDetail] = useState<CommunityThreadDetail | null>(null);
  const [messageMember, setMessageMember] = useState<Member | null>(null);
  const [messageText, setMessageText] = useState('');
  const [conversation, setConversation] = useState<DirectConversation | null>(null);
  const [replyText, setReplyText] = useState('');

  // One request per pause in typing, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [debouncedQuery, interest]);

  const { data, loading, error } = useApiData<CommunityResult>(
    () => memberApi.community({
      q: debouncedQuery || undefined,
      interest: interest || undefined,
      limit: 50,
    }),
    [debouncedQuery, interest, reloadKey],
  );

  const members = data?.members.items ?? [];
  const groupList = data?.groups ?? [];
  const threads = data?.threads ?? [];
  const stats = data?.stats ?? null;
  const firstLoad = loading && !data;

  const refresh = () => setReloadKey((key) => key + 1);

  const trimmedTitle = discussionTitle.trim();
  const titleShortBy = DISCUSSION_TITLE_MIN - trimmedTitle.length;
  const titleValid = titleShortBy <= 0;
  // A dialog covers the page banner, so its errors have to render inside it.
  const modalOpen = Boolean(newDiscussionOpen || selectedThread || messageMember);

  const notify = (message: string) => {
    setActionError(null);
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  /**
   * Runs one community action, then reloads so what renders is what was stored
   * rather than an optimistic guess.
   */
  const runBusyAction = async (key: string, action: () => Promise<unknown>, success: string, failure: string) => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      notify(success);
      refresh();
      return true;
    } catch (err) {
      setActionError(normalizeError(err).message || failure);
      setToast(null);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = (member: Member) => {
    const status = member.connectionStatus;
    if (status === 'none') {
      void runBusyAction(
        `connect-${member.id}`,
        () => memberApi.connect(member.id),
        `Connection request sent to ${member.name}.`,
        'Could not send that connection request.',
      );
      return;
    }

    setConfirmAction({
      title: status === 'requested' ? 'Cancel connection request?' : 'Remove connection?',
      message: status === 'requested'
        ? `Cancel the request sent to ${member.name}?`
        : `Remove ${member.name} from your connections?`,
      run: () => void runBusyAction(
        `connect-${member.id}`,
        () => memberApi.disconnect(member.id),
        status === 'requested' ? 'Connection request cancelled.' : 'Connection removed.',
        'Could not update that connection.',
      ),
    });
  };

  const handleMessage = async (member: Member) => {
    setMessageMember(member);
    setMessageText('');
    setConversation(null);
    setActionError(null);
    try {
      setConversation(await memberApi.directMessages(member.userId));
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open that conversation.');
    }
  };

  const sendMessage = async () => {
    if (!messageMember || !messageText.trim() || busy) return;
    setBusy('message');
    setActionError(null);
    try {
      setConversation(await memberApi.sendDirectMessage(messageMember.userId, messageText.trim()));
      setMessageText('');
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not send that message.');
    } finally {
      setBusy(null);
    }
  };

  const openThread = async (thread: CommunityThread) => {
    setSelectedThread(thread);
    setThreadDetail(null);
    setReplyText('');
    setActionError(null);
    try {
      setThreadDetail(await memberApi.thread(thread.id));
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not open that discussion.');
    }
  };

  const postReply = async () => {
    if (!selectedThread || !replyText.trim() || busy) return;
    setBusy('reply');
    setActionError(null);
    try {
      setThreadDetail(await memberApi.replyToThread(selectedThread.id, replyText.trim()));
      setReplyText('');
      notify('Your reply was posted.');
      refresh();
    } catch (err) {
      setActionError(normalizeError(err).message || 'Could not post that reply.');
    } finally {
      setBusy(null);
    }
  };

  const publishDiscussion = () =>
    void runBusyAction(
      'new-discussion',
      async () => {
        await memberApi.createThread(discussionTitle.trim());
        setDiscussionTitle('');
        setNewDiscussionOpen(false);
      },
      'Discussion created successfully.',
      'Could not start that discussion.',
    );

  const handleGroupAction = (group: InterestGroup) => {
    if (!group.joined) {
      void runBusyAction(
        `group-${group.id}`,
        () => memberApi.joinGroup(group.id),
        `You joined ${group.name}.`,
        'Could not join that group.',
      );
      return;
    }
    setConfirmAction({
      title: 'Leave this group?',
      message: `Are you sure you want to leave ${group.name}?`,
      run: () => void runBusyAction(
        `group-${group.id}`,
        () => memberApi.leaveGroup(group.id),
        `You left ${group.name}.`,
        'Could not leave that group.',
      ),
    });
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div role="status" className="fixed right-4 top-4 z-50 flex max-w-sm items-center gap-2 rounded-lg bg-forum-900 px-4 py-3 text-sm text-white shadow-xl">
          <Check className="h-4 w-4 text-success-400" />
          <span>{toast}</span>
          <button aria-label="Close notification" onClick={() => setToast(null)} className="ml-2 rounded p-0.5 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>
      )}

      {actionError && !modalOpen && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger-600/20 bg-danger-100 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" />
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Members', value: stats ? stats.totalMembers.toLocaleString() : '—', icon: Users, bg: 'bg-forum-50 text-forum-700' },
          { label: 'Countries', value: stats ? stats.countries.toString() : '—', icon: Globe2, bg: 'bg-slateteal-100 text-slateteal-700' },
          { label: 'Interest Groups', value: stats ? stats.groups.toString() : '—', icon: Sparkles, bg: 'bg-brass-100 text-brass-700' },
          { label: 'Online Now', value: stats ? stats.online.toString() : '—', icon: TrendingUp, bg: 'bg-forum-50 text-forum-700' },
        ].map(({ label, value, icon: Icon, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${bg}`}><Icon className="h-5 w-5" /></div>
              <p className="mt-4 font-display text-2xl font-semibold text-forum-900">{value}</p>
              <p className="mt-0.5 text-sm text-ink-muted">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><Users className="h-5 w-5 text-forum-600" />Member Directory</h3>
              <p className="mt-0.5 text-xs text-ink-subtle">Connect with peers across the global community</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(4); }}
                type="search"
                aria-label="Search community members"
                placeholder="Search name, institution, interest..."
                className="w-full rounded-md border border-paper-border bg-paper py-2 pl-9 pr-9 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600"
              />
              {query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-forum-800"><X className="h-4 w-4" /></button>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {interest && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <span>Filtered by:</span>
                <button onClick={() => setInterest(null)} className="inline-flex items-center gap-1 rounded-full bg-forum-50 px-3 py-1 text-forum-700 hover:bg-forum-100">{interest}<X className="h-3 w-3" /></button>
              </div>
            )}
            {firstLoad ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading members">
                {[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-xl border border-paper-border bg-paper" />)}
              </div>
            ) : error ? (
              <div className="rounded-xl border border-dashed border-paper-border px-6 py-12 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-danger-600" />
                <p className="mt-3 font-medium text-forum-900">Couldn&apos;t load the directory</p>
                <p className="mt-1 text-sm text-ink-muted">{error}</p>
                <Button className="mt-4" variant="outline" onClick={refresh}>Try again</Button>
              </div>
            ) : members.length === 0 ? (
              <div className="rounded-xl border border-dashed border-paper-border px-6 py-12 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-ink-subtle" />
                <p className="mt-3 font-medium text-forum-900">
                  {query || interest ? 'No members found' : 'No other members yet'}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {query || interest
                    ? 'Try a different name, institution or interest.'
                    : 'Approved members appear here as the community grows.'}
                </p>
                {(query || interest) && <Button className="mt-4" variant="outline" onClick={() => { setQuery(''); setInterest(null); }}>Clear filters</Button>}
              </div>
            ) : members.slice(0, visibleCount).map((member) => {
              const status = member.connectionStatus;
              const isBusy = busy === `connect-${member.id}`;
              return (
                <div key={member.id} className="flex flex-col gap-4 rounded-xl border border-paper-border p-4 transition-colors hover:border-forum-200 hover:bg-forum-50/30 sm:flex-row sm:items-center">
                  <button aria-label={`View ${member.name}'s profile`} onClick={() => setSelectedMember(member)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-2">{initials(member.name)}</button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => setSelectedMember(member)} className="font-semibold text-forum-900 hover:underline">{member.name}</button>
                      <Badge variant={member.type === 'Scientist' ? 'default' : 'info'}>{member.type === 'Scientist' ? <BookOpen className="mr-1 h-2.5 w-2.5" /> : <HeartHandshake className="mr-1 h-2.5 w-2.5" />}{member.type}</Badge>
                    </div>
                    <p className="text-sm text-ink-muted">{member.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                      <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{member.institution}</span>
                      <span className="inline-flex items-center gap-1.5"><Globe2 className="h-3.5 w-3.5" />{member.country}</span>
                      <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{member.pubs} pubs</span>
                      <span className="inline-flex items-center gap-1.5"><Award className="h-3.5 w-3.5" />{member.projects} projects</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {member.interests.map((item) => <button key={item} onClick={() => { setInterest(item); setVisibleCount(4); }} className="rounded-full border border-paper-border bg-paper px-2 py-0.5 text-[11px] text-ink-muted hover:border-forum-300 hover:text-forum-700">{item}</button>)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col">
                    <Button size="sm" variant={status === 'connected' ? undefined : 'outline'} onClick={() => handleConnect(member)} disabled={isBusy}>
                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status === 'connected' ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                      {status === 'none' ? 'Connect' : status === 'requested' ? 'Requested' : 'Connected'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void handleMessage(member)}><MessageCircle className="h-3.5 w-3.5" />Message</Button>
                  </div>
                </div>
              );
            })}
            {visibleCount < members.length && <Button variant="ghost" className="w-full justify-center" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Load More Members<ChevronRight className="h-4 w-4" /></Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><Sparkles className="h-5 w-5 text-brass-700" />Interest Groups</h3>
            <p className="mt-0.5 text-xs text-ink-subtle">Join focused discussions</p>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {groupList.length === 0 && !firstLoad && (
              <p className="rounded-xl border border-dashed border-paper-border px-4 py-8 text-center text-sm text-ink-muted">No interest groups yet.</p>
            )}
            {groupList.map((group) => {
              return (
                <div key={group.id} className="rounded-xl border border-paper-border p-3.5 transition-colors hover:border-forum-300 hover:bg-forum-50/40">
                  <button onClick={() => setSelectedGroup(group)} className="flex w-full items-center gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700"><Users className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-forum-900">{group.name}</p><Badge variant={group.tag === 'Trending' ? 'brass' : group.tag === 'New' ? 'warning' : 'info'}>{group.tag}</Badge></div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle"><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{group.members} {group.members === 1 ? 'member' : 'members'}</span>{group.joined && <span className="inline-flex items-center gap-1 text-success-600"><span className="h-1.5 w-1.5 rounded-full bg-success-600" />Joined</span>}</div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </button>
                  <Button size="sm" variant={group.joined ? undefined : 'ghost'} className="mt-2 w-full justify-center" disabled={busy === `group-${group.id}`} onClick={() => handleGroupAction(group)}>
                    {busy === `group-${group.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {group.joined ? 'Joined' : 'Join Group'}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><MessageCircle className="h-5 w-5 text-slateteal-500" />Community Discussions</h3><p className="mt-0.5 text-xs text-ink-subtle">Active threads from members worldwide</p></div>
          <Button onClick={() => setNewDiscussionOpen(true)}><MessageCircle className="h-4 w-4" />Start Discussion</Button>
        </CardHeader>
        <CardContent className="divide-y divide-paper-border pt-0">
          {!firstLoad && threads.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-muted">No discussions yet. Start the first one.</p>
          )}
          {threads.map((thread) => (
            <div key={thread.id} className="-mx-4 flex flex-col items-start gap-4 rounded-lg px-4 py-4 transition-colors hover:bg-forum-50/30 sm:flex-row">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 font-semibold text-forum-700">{initials(thread.author)}</div>
              <button onClick={() => void openThread(thread)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={thread.category === 'Funding' ? 'brass' : thread.category === 'Events' ? 'warning' : thread.category === 'Technology' ? 'info' : 'default'}>{thread.category}</Badge><span className="text-[11px] text-ink-subtle">Started by <span className="font-medium text-ink-muted">{thread.author}</span></span></div>
                <h4 className="mt-1.5 font-medium text-forum-900 hover:text-forum-700 hover:underline">{thread.title}</h4>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-ink-subtle"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{thread.replies} replies</span><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{relativeTime(thread.lastPost)}</span></div>
              </button>
              <Button variant="ghost" size="sm" onClick={() => void openThread(thread)}>View Thread<ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-xl bg-paper p-6 shadow-2xl">
            <h3 id="confirm-title" className="font-display text-lg font-semibold text-forum-900">{confirmAction.title}</h3>
            <p className="mt-2 text-sm text-ink-muted">{confirmAction.message}</p>
            <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setConfirmAction(null)}>Keep</Button><Button onClick={() => { confirmAction.run(); setConfirmAction(null); }}>Confirm</Button></div>
          </div>
        </div>
      )}

      {newDiscussionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="discussion-title">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between"><h3 id="discussion-title" className="font-display text-lg font-semibold text-forum-900">Start a Discussion</h3><button aria-label="Close" onClick={() => { setNewDiscussionOpen(false); setActionError(null); }}><X className="h-5 w-5" /></button></div>
            <label className="mt-5 block text-sm font-medium text-forum-900" htmlFor="new-discussion">Discussion title</label>
            <textarea id="new-discussion" value={discussionTitle} onChange={(event) => setDiscussionTitle(event.target.value)} rows={4} maxLength={DISCUSSION_TITLE_MAX} placeholder="What would you like to discuss?" className="mt-2 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" />
            <div className="mt-1.5 flex justify-between text-xs">
              <span className="text-danger-600">{trimmedTitle.length > 0 && !titleValid ? `${titleShortBy} more character${titleShortBy === 1 ? '' : 's'} needed` : ''}</span>
              <span className="text-ink-subtle">{discussionTitle.length}/{DISCUSSION_TITLE_MAX}</span>
            </div>
            <ModalError message={actionError} />
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => { setNewDiscussionOpen(false); setActionError(null); }}>Cancel</Button><Button disabled={!titleValid || busy === 'new-discussion'} onClick={publishDiscussion}>{busy === 'new-discussion' && <Loader2 className="h-4 w-4 animate-spin" />}Publish Discussion</Button></div>
          </div>
        </div>
      )}

      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="member-profile-title">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-xl font-semibold text-white">{initials(selectedMember.name)}</div>
                <div><h3 id="member-profile-title" className="font-display text-xl font-semibold text-forum-900">{selectedMember.name}</h3><p className="text-sm text-ink-muted">{selectedMember.title}</p></div>
              </div>
              <button aria-label="Close profile" onClick={() => setSelectedMember(null)} className="rounded p-1 hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-3 rounded-xl bg-forum-50/60 p-4 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-ink-muted"><Building2 className="h-4 w-4" />{selectedMember.institution}</p>
              <p className="flex items-center gap-2 text-ink-muted"><Globe2 className="h-4 w-4" />{selectedMember.country}</p>
              <p className="flex items-center gap-2 text-ink-muted"><FileText className="h-4 w-4" />{selectedMember.pubs} publications</p>
              <p className="flex items-center gap-2 text-ink-muted"><Award className="h-4 w-4" />{selectedMember.projects} projects</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{selectedMember.interests.map((item) => <button key={item} onClick={() => { setInterest(item); setSelectedMember(null); }} className="rounded-full border border-paper-border px-3 py-1 text-xs text-ink-muted hover:border-forum-300">{item}</button>)}</div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => { handleConnect(selectedMember); setSelectedMember(null); }}><UserPlus className="h-4 w-4" />{selectedMember.connectionStatus === 'none' ? 'Connect' : selectedMember.connectionStatus === 'requested' ? 'Requested' : 'Connected'}</Button><Button onClick={() => { setSelectedMember(null); void handleMessage(selectedMember); }}><MessageCircle className="h-4 w-4" />Message</Button></div>
          </div>
        </div>
      )}

      {messageMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="message-title">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h3 id="message-title" className="font-display text-lg font-semibold text-forum-900">Message {messageMember.name}</h3><p className="text-xs text-ink-subtle">Direct community conversation</p></div><button aria-label="Close message" onClick={() => { setMessageMember(null); setActionError(null); }}><X className="h-5 w-5" /></button></div>
            <div className="my-5 min-h-32 flex-1 space-y-2 overflow-y-auto rounded-xl bg-forum-50/60 p-4">
              {!conversation ? <p className="py-8 text-center text-sm text-ink-subtle">Loading conversation...</p> : conversation.messages.length === 0 ? <p className="py-8 text-center text-sm text-ink-subtle">No messages yet. Start the conversation.</p> : conversation.messages.map((message) => <div key={message.id} className={message.mine ? 'ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-forum-700 px-3 py-2 text-sm text-white' : 'mr-auto max-w-[80%] rounded-xl rounded-bl-sm bg-paper-raised px-3 py-2 text-sm text-ink ring-1 ring-paper-border'}>{message.body}</div>)}
            </div>
            <ModalError message={actionError} />
            <div className="mt-3 flex gap-2"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void sendMessage(); }} placeholder="Type your message..." className="min-w-0 flex-1 rounded-lg border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /><Button disabled={!messageText.trim() || busy === 'message'} onClick={() => void sendMessage()}>{busy === 'message' && <Loader2 className="h-4 w-4 animate-spin" />}Send</Button></div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="group-title">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><Badge variant={selectedGroup.tag === 'Trending' ? 'brass' : selectedGroup.tag === 'New' ? 'warning' : 'info'}>{selectedGroup.tag}</Badge><h3 id="group-title" className="mt-2 font-display text-xl font-semibold text-forum-900">{selectedGroup.name}</h3></div><button aria-label="Close group" onClick={() => setSelectedGroup(null)}><X className="h-5 w-5" /></button></div>
            <p className="mt-3 text-sm text-ink-muted">A focused community space for members to exchange research, professional experience and practical resources.</p>
            <div className="mt-5 flex gap-6 rounded-xl bg-forum-50/60 p-4 text-sm"><span><strong className="text-forum-900">{groupList.find((g) => g.id === selectedGroup.id)?.members ?? selectedGroup.members}</strong> members</span>{(groupList.find((g) => g.id === selectedGroup.id)?.joined ?? selectedGroup.joined) && <span className="text-success-600">● You are a member</span>}</div>
            <div className="mt-5"><h4 className="font-medium text-forum-900">Group rules</h4><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted"><li>Keep discussions professional and relevant.</li><li>Respect member privacy and research ownership.</li><li>Do not post promotional spam.</li></ul></div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelectedGroup(null)}>Close</Button><Button onClick={() => { handleGroupAction(groupList.find((g) => g.id === selectedGroup.id) ?? selectedGroup); setSelectedGroup(null); }}>{(groupList.find((g) => g.id === selectedGroup.id)?.joined ?? selectedGroup.joined) ? 'Leave Group' : 'Join Group'}</Button></div>
          </div>
        </div>
      )}

      {selectedThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="thread-title">
          <div className="w-full max-w-2xl rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><Badge variant="default">{selectedThread.category}</Badge><h3 id="thread-title" className="mt-2 font-display text-xl font-semibold text-forum-900">{selectedThread.title}</h3><p className="mt-1 text-xs text-ink-subtle">Started by {selectedThread.author} · {relativeTime(selectedThread.lastPost)}</p></div><button aria-label="Close discussion" onClick={() => { setSelectedThread(null); setThreadDetail(null); setActionError(null); }}><X className="h-5 w-5" /></button></div>
            <div className="mt-6 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-forum-50/60 p-4">
              {!threadDetail ? (
                <p className="py-6 text-center text-sm text-ink-subtle">Loading discussion...</p>
              ) : threadDetail.replies.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-subtle">No replies yet. Be the first to respond.</p>
              ) : threadDetail.replies.map((reply) => (
                <div key={reply.id} className="rounded-lg bg-paper p-3 ring-1 ring-paper-border">
                  <p className="text-[11px] text-ink-subtle"><span className="font-medium text-ink-muted">{reply.author}</span> · {relativeTime(reply.at)}</p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink">{reply.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5"><label htmlFor="thread-reply" className="text-sm font-medium text-forum-900">Add your reply</label><textarea id="thread-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder="Write a constructive reply..." className="mt-2 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /></div>
            <ModalError message={actionError} />
            <div className="mt-4 flex items-center justify-between"><span className="text-sm text-ink-subtle">{threadDetail ? threadDetail.replies.length : selectedThread.replies} replies</span><Button disabled={!replyText.trim() || busy === 'reply'} onClick={() => void postReply()}>{busy === 'reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}Post Reply</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
