import { useMemo, useState } from 'react';
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

type ConnectionStatus = 'none' | 'requested' | 'connected';
type GroupStatus = 'not-joined' | 'requested' | 'joined';

interface Member {
  id: string;
  name: string;
  title: string;
  institution: string;
  country: string;
  type: string;
  interests: string[];
  projects: number;
  pubs: number;
}

interface InterestGroup {
  id: string;
  name: string;
  members: number;
  active: string;
  tag: 'Trending' | 'Active' | 'New';
  isPrivate?: boolean;
}

const members: Member[] = [
  { id: 'm1', name: 'Prof. Marcus Whitfield', title: 'Professor of Psychiatry', institution: 'Oxford University', country: 'UK', type: 'Scientist', interests: ['Depression', 'Pharmacology'], projects: 11, pubs: 48 },
  { id: 'm2', name: 'Dr. Amara Patel', title: 'Neuroimaging Researcher', institution: 'NIMHANS', country: 'India', type: 'Scientist', interests: ['EEG', 'Neurotech'], projects: 5, pubs: 19 },
  { id: 'm3', name: 'Dr. James Okafor', title: 'Clinical Psychologist', institution: 'Lagos State University', country: 'Nigeria', type: 'Professional', interests: ['Global MH', 'Service Delivery'], projects: 7, pubs: 14 },
  { id: 'm4', name: 'Dr. Elena Rodriguez', title: 'Mindfulness Research Lead', institution: 'Universidad de Barcelona', country: 'Spain', type: 'Scientist', interests: ['Mindfulness', 'RCTs'], projects: 6, pubs: 22 },
  { id: 'm5', name: 'Prof. Naomi Hargrove', title: 'AI Safety Researcher', institution: 'MIT', country: 'USA', type: 'Scientist', interests: ['AI Safety', 'Chatbots'], projects: 9, pubs: 31 },
  { id: 'm6', name: 'Dr. Liam Sutherland', title: 'Youth Mental Health', institution: 'University of Melbourne', country: 'Australia', type: 'Professional', interests: ['Youth', 'Health Policy'], projects: 8, pubs: 27 },
];

const interestGroups: InterestGroup[] = [
  { id: 'g1', name: 'Digital Mental Health Tech', members: 62, active: '12 online', tag: 'Trending' },
  { id: 'g2', name: 'Treatment-Resistant Depression', members: 48, active: '8 online', tag: 'Active', isPrivate: true },
  { id: 'g3', name: 'Global Health Disparities', members: 35, active: '5 online', tag: 'New' },
  { id: 'g4', name: 'Psychedelic Research', members: 29, active: '6 online', tag: 'Trending' },
  { id: 'g5', name: 'Telehealth Policy & Ethics', members: 41, active: '4 online', tag: 'Active' },
  { id: 'g6', name: 'Youth & Adolescent MH', members: 53, active: '9 online', tag: 'Active' },
];

const discussionThreads = [
  { id: 'd1', title: 'Best practices for IRB applications across multiple countries?', replies: 14, lastPost: '1h ago', category: 'Methodology', author: 'Dr. Rodriguez' },
  { id: 'd2', title: 'Open-access publication funding sources for low-income researchers', replies: 22, lastPost: '4h ago', category: 'Funding', author: 'Dr. Okafor' },
  { id: 'd3', title: 'Wearable device validity: which EEG products do you trust?', replies: 37, lastPost: 'Yesterday', category: 'Technology', author: 'Dr. Patel' },
  { id: 'd4', title: 'Symposium 2026 submission deadline extension request', replies: 5, lastPost: '2d ago', category: 'Events', author: 'Prof. Whitfield' },
];

function initials(name: string) {
  return name.replace(/^(Prof\.|Dr\.)\s+/, '').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function CommunityPage() {
  const [query, setQuery] = useState('');
  const [interest, setInterest] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(4);
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({});
  const [groups, setGroups] = useState<Record<string, GroupStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ title: string; message: string; run: () => void } | null>(null);
  const [newDiscussionOpen, setNewDiscussionOpen] = useState(false);
  const [discussionTitle, setDiscussionTitle] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<InterestGroup | null>(null);
  const [selectedThread, setSelectedThread] = useState<(typeof discussionThreads)[number] | null>(null);
  const [messageMember, setMessageMember] = useState<Member | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sentMessages, setSentMessages] = useState<Record<string, string[]>>({});
  const [replyText, setReplyText] = useState('');

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const filteredMembers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return members.filter((member) => {
      const matchesText = !term || [member.name, member.title, member.institution, member.country, member.type, ...member.interests]
        .some((value) => value.toLowerCase().includes(term));
      const matchesInterest = !interest || member.interests.includes(interest);
      return matchesText && matchesInterest;
    });
  }, [query, interest]);

  const runBusyAction = (key: string, action: () => void) => {
    setBusy(key);
    window.setTimeout(() => {
      action();
      setBusy(null);
    }, 450);
  };

  const handleConnect = (member: Member) => {
    const status = connections[member.id] ?? 'none';
    if (status === 'none') {
      runBusyAction(`connect-${member.id}`, () => {
        setConnections((current) => ({ ...current, [member.id]: 'requested' }));
        notify(`Connection request sent to ${member.name}.`);
      });
      return;
    }

    setConfirmAction({
      title: status === 'requested' ? 'Cancel connection request?' : 'Remove connection?',
      message: status === 'requested'
        ? `Cancel the request sent to ${member.name}?`
        : `Remove ${member.name} from your connections?`,
      run: () => runBusyAction(`connect-${member.id}`, () => {
        setConnections((current) => ({ ...current, [member.id]: 'none' }));
        notify(status === 'requested' ? 'Connection request cancelled.' : 'Connection removed.');
      }),
    });
  };

  const handleMessage = (member: Member) => {
    setMessageMember(member);
    setMessageText('');
  };

  const sendMessage = () => {
    if (!messageMember || !messageText.trim()) return;
    setSentMessages((current) => ({
      ...current,
      [messageMember.id]: [...(current[messageMember.id] ?? []), messageText.trim()],
    }));
    setMessageText('');
    notify(`Message sent to ${messageMember.name}.`);
  };

  const handleGroupAction = (group: InterestGroup) => {
    const status = groups[group.id] ?? 'not-joined';
    if (status === 'not-joined') {
      runBusyAction(`group-${group.id}`, () => {
        setGroups((current) => ({ ...current, [group.id]: group.isPrivate ? 'requested' : 'joined' }));
        notify(group.isPrivate ? 'Your request to join was sent.' : `You joined ${group.name}.`);
      });
      return;
    }
    if (status === 'requested') {
      setConfirmAction({
        title: 'Cancel join request?',
        message: `Cancel your request to join ${group.name}?`,
        run: () => {
          setGroups((current) => ({ ...current, [group.id]: 'not-joined' }));
          notify('Join request cancelled.');
        },
      });
      return;
    }
    setConfirmAction({
      title: 'Leave this group?',
      message: `Are you sure you want to leave ${group.name}?`,
      run: () => {
        setGroups((current) => ({ ...current, [group.id]: 'not-joined' }));
        notify(`You left ${group.name}.`);
      },
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total Members', value: '277', icon: Users, bg: 'bg-forum-50 text-forum-700' },
          { label: 'Countries', value: '34', icon: Globe2, bg: 'bg-slateteal-100 text-slateteal-700' },
          { label: 'Interest Groups', value: '18', icon: Sparkles, bg: 'bg-brass-100 text-brass-700' },
          { label: 'Online Now', value: '42', icon: TrendingUp, bg: 'bg-forum-50 text-forum-700' },
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
            {filteredMembers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-paper-border px-6 py-12 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-ink-subtle" />
                <p className="mt-3 font-medium text-forum-900">No members found</p>
                <p className="mt-1 text-sm text-ink-muted">Try a different name, institution or interest.</p>
                <Button className="mt-4" variant="outline" onClick={() => { setQuery(''); setInterest(null); }}>Clear filters</Button>
              </div>
            ) : filteredMembers.slice(0, visibleCount).map((member) => {
              const status = connections[member.id] ?? 'none';
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
                    <Button size="sm" variant="ghost" onClick={() => handleMessage(member)}><MessageCircle className="h-3.5 w-3.5" />Message</Button>
                  </div>
                </div>
              );
            })}
            {visibleCount < filteredMembers.length && <Button variant="ghost" className="w-full justify-center" onClick={() => setVisibleCount((count) => count + 4)}>Load More Members<ChevronRight className="h-4 w-4" /></Button>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><Sparkles className="h-5 w-5 text-brass-700" />Interest Groups</h3>
            <p className="mt-0.5 text-xs text-ink-subtle">Join focused discussions</p>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {interestGroups.map((group) => {
              const status = groups[group.id] ?? 'not-joined';
              return (
                <div key={group.id} className="rounded-xl border border-paper-border p-3.5 transition-colors hover:border-forum-300 hover:bg-forum-50/40">
                  <button onClick={() => setSelectedGroup(group)} className="flex w-full items-center gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700"><Users className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><p className="truncate text-sm font-medium text-forum-900">{group.name}</p><Badge variant={group.tag === 'Trending' ? 'brass' : group.tag === 'New' ? 'warning' : 'info'}>{group.tag}</Badge></div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle"><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{group.members + (status === 'joined' ? 1 : 0)}</span><span className="inline-flex items-center gap-1 text-success-600"><span className="h-1.5 w-1.5 rounded-full bg-success-600" />{group.active}</span></div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-subtle" />
                  </button>
                  <Button size="sm" variant={status === 'joined' ? undefined : 'ghost'} className="mt-2 w-full justify-center" disabled={busy === `group-${group.id}`} onClick={() => handleGroupAction(group)}>
                    {busy === `group-${group.id}` && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {status === 'joined' ? 'Joined' : status === 'requested' ? 'Requested' : group.isPrivate ? 'Request to Join' : 'Join Group'}
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
          {discussionThreads.map((thread) => (
            <div key={thread.id} className="-mx-4 flex flex-col items-start gap-4 rounded-lg px-4 py-4 transition-colors hover:bg-forum-50/30 sm:flex-row">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 font-semibold text-forum-700">{initials(thread.author)}</div>
              <button onClick={() => setSelectedThread(thread)} className="min-w-0 flex-1 text-left">
                <div className="flex flex-wrap items-center gap-2"><Badge variant={thread.category === 'Funding' ? 'brass' : thread.category === 'Events' ? 'warning' : thread.category === 'Technology' ? 'info' : 'default'}>{thread.category}</Badge><span className="text-[11px] text-ink-subtle">Started by <span className="font-medium text-ink-muted">{thread.author}</span></span></div>
                <h4 className="mt-1.5 font-medium text-forum-900 hover:text-forum-700 hover:underline">{thread.title}</h4>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-ink-subtle"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{thread.replies} replies</span><span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{thread.lastPost}</span></div>
              </button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedThread(thread)}>View Thread<ChevronRight className="h-3.5 w-3.5" /></Button>
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
            <div className="flex items-center justify-between"><h3 id="discussion-title" className="font-display text-lg font-semibold text-forum-900">Start a Discussion</h3><button aria-label="Close" onClick={() => setNewDiscussionOpen(false)}><X className="h-5 w-5" /></button></div>
            <label className="mt-5 block text-sm font-medium text-forum-900" htmlFor="new-discussion">Discussion title</label>
            <textarea id="new-discussion" value={discussionTitle} onChange={(event) => setDiscussionTitle(event.target.value)} rows={4} placeholder="What would you like to discuss?" className="mt-2 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" />
            <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setNewDiscussionOpen(false)}>Cancel</Button><Button disabled={!discussionTitle.trim()} onClick={() => { notify('Discussion created successfully.'); setDiscussionTitle(''); setNewDiscussionOpen(false); }}>Publish Discussion</Button></div>
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
            <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => handleConnect(selectedMember)}><UserPlus className="h-4 w-4" />{(connections[selectedMember.id] ?? 'none') === 'none' ? 'Connect' : (connections[selectedMember.id] ?? 'none') === 'requested' ? 'Requested' : 'Connected'}</Button><Button onClick={() => { setSelectedMember(null); handleMessage(selectedMember); }}><MessageCircle className="h-4 w-4" />Message</Button></div>
          </div>
        </div>
      )}

      {messageMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="message-title">
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-center justify-between"><div><h3 id="message-title" className="font-display text-lg font-semibold text-forum-900">Message {messageMember.name}</h3><p className="text-xs text-ink-subtle">Direct community conversation</p></div><button aria-label="Close message" onClick={() => setMessageMember(null)}><X className="h-5 w-5" /></button></div>
            <div className="my-5 min-h-32 flex-1 space-y-2 overflow-y-auto rounded-xl bg-forum-50/60 p-4">
              {(sentMessages[messageMember.id] ?? []).length === 0 ? <p className="py-8 text-center text-sm text-ink-subtle">No messages yet. Start the conversation.</p> : (sentMessages[messageMember.id] ?? []).map((message, index) => <div key={`${message}-${index}`} className="ml-auto max-w-[80%] rounded-xl rounded-br-sm bg-forum-700 px-3 py-2 text-sm text-white">{message}</div>)}
            </div>
            <div className="flex gap-2"><input value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') sendMessage(); }} placeholder="Type your message..." className="min-w-0 flex-1 rounded-lg border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /><Button disabled={!messageText.trim()} onClick={sendMessage}>Send</Button></div>
          </div>
        </div>
      )}

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="group-title">
          <div className="w-full max-w-lg rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><Badge variant={selectedGroup.tag === 'Trending' ? 'brass' : selectedGroup.tag === 'New' ? 'warning' : 'info'}>{selectedGroup.tag}</Badge><h3 id="group-title" className="mt-2 font-display text-xl font-semibold text-forum-900">{selectedGroup.name}</h3></div><button aria-label="Close group" onClick={() => setSelectedGroup(null)}><X className="h-5 w-5" /></button></div>
            <p className="mt-3 text-sm text-ink-muted">A focused community space for members to exchange research, professional experience and practical resources.</p>
            <div className="mt-5 flex gap-6 rounded-xl bg-forum-50/60 p-4 text-sm"><span><strong className="text-forum-900">{selectedGroup.members + ((groups[selectedGroup.id] ?? 'not-joined') === 'joined' ? 1 : 0)}</strong> members</span><span className="text-success-600">● {selectedGroup.active}</span></div>
            <div className="mt-5"><h4 className="font-medium text-forum-900">Group rules</h4><ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ink-muted"><li>Keep discussions professional and relevant.</li><li>Respect member privacy and research ownership.</li><li>Do not post promotional spam.</li></ul></div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelectedGroup(null)}>Close</Button><Button onClick={() => handleGroupAction(selectedGroup)}>{(groups[selectedGroup.id] ?? 'not-joined') === 'joined' ? 'Leave Group' : (groups[selectedGroup.id] ?? 'not-joined') === 'requested' ? 'Cancel Request' : selectedGroup.isPrivate ? 'Request to Join' : 'Join Group'}</Button></div>
          </div>
        </div>
      )}

      {selectedThread && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="thread-title">
          <div className="w-full max-w-2xl rounded-xl bg-paper p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><Badge variant="default">{selectedThread.category}</Badge><h3 id="thread-title" className="mt-2 font-display text-xl font-semibold text-forum-900">{selectedThread.title}</h3><p className="mt-1 text-xs text-ink-subtle">Started by {selectedThread.author} · {selectedThread.lastPost}</p></div><button aria-label="Close discussion" onClick={() => setSelectedThread(null)}><X className="h-5 w-5" /></button></div>
            <p className="mt-6 rounded-xl bg-forum-50/60 p-4 text-sm leading-6 text-ink-muted">This discussion is open to the community. Members can share relevant experience, references and constructive recommendations here.</p>
            <div className="mt-5"><label htmlFor="thread-reply" className="text-sm font-medium text-forum-900">Add your reply</label><textarea id="thread-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder="Write a constructive reply..." className="mt-2 w-full rounded-lg border border-paper-border bg-paper p-3 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /></div>
            <div className="mt-4 flex items-center justify-between"><span className="text-sm text-ink-subtle">{selectedThread.replies} replies</span><Button disabled={!replyText.trim()} onClick={() => { notify('Your reply was posted.'); setReplyText(''); }}><MessageCircle className="h-4 w-4" />Post Reply</Button></div>
          </div>
        </div>
      )}
    </div>
  );
}
