import { useState } from 'react';
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
  Ban,
  Hash,
  Filter,
  CheckCircle2,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

type Tab = 'all' | 'open' | 'escalated' | 'closed';
type Filter = 'All' | 'Member Support' | 'Project Query' | 'Credential Issue' | 'Publication Problem' | 'Billing' | 'Report Content';

interface Conversation {
  id: string;
  subject: string;
  from: string;
  memberId: string;
  category: Exclude<Filter, 'All'>;
  lastActivity: string;
  unreadCount: number;
  participantCount: number;
  totalMessages: number;
  lastPreview: string;
  status: 'Open' | 'Awaiting Member' | 'Escalated' | 'Closed';
  priority?: 'Standard' | 'Escalated' | 'Flagged';
}

const conversations: Conversation[] = [
  { id: 'cm-00892', subject: 'Publication approval delay — wearable EEG study', from: 'Dr. T. Mbeki', memberId: 'IFSMHP-2024-000198', category: 'Publication Problem', lastActivity: '15 minutes ago', unreadCount: 4, participantCount: 2, totalMessages: 7, lastPreview: 'My publication has been in Under Review for 11 days. The study was…', status: 'Open', priority: 'Escalated' },
  { id: 'cm-00891', subject: 'Credential document viewer showing a 404 on file download', from: 'Dr. S. Wijaya', memberId: 'IFSMHP-2024-000156', category: 'Credential Issue', lastActivity: '2 hours ago', unreadCount: 2, participantCount: 3, totalMessages: 9, lastPreview: 'Thanks CRO team — the alternate endpoint does work. Any idea why the first one…', status: 'Awaiting Member', priority: 'Flagged' },
  { id: 'cm-00890', subject: 'Moral Support pairing — follow-up on member check-in', from: 'Dr. E. Thompson', memberId: 'IFSMHP-2024-000105', category: 'Member Support', lastActivity: '5 hours ago', unreadCount: 1, participantCount: 2, totalMessages: 4, lastPreview: 'The pairing is going well. We have a follow-up call this Friday. If there is anything…', status: 'Open' },
  { id: 'cm-00889', subject: 'Project PA-00014 — scope change request for funding line item', from: 'Dr. A. Kapoor', memberId: 'IFSMHP-2024-000176', category: 'Project Query', lastActivity: 'Yesterday', unreadCount: 0, participantCount: 4, totalMessages: 22, lastPreview: 'SAB reviewed the scope change and it is approved in principle. I will prepare the updated…', status: 'Awaiting Member' },
  { id: 'cm-00888', subject: 'REPORT: Public comment on publication #pub243 appears to be spam', from: 'Dr. S. Chen', memberId: 'IFSMHP-2024-000142', category: 'Report Content', lastActivity: 'Yesterday', unreadCount: 0, participantCount: 2, totalMessages: 3, lastPreview: 'Link: /research/biomarker-mdd-2026#comment-198 — the account has no publications and repeated…', status: 'Closed', priority: 'Escalated' },
  { id: 'cm-00887', subject: 'Membership annual dues — help renewing multi-year invoice', from: 'Prof. H. Lindberg', memberId: 'IFSMHP-2024-000092', category: 'Billing', lastActivity: '3 days ago', unreadCount: 0, participantCount: 2, totalMessages: 6, lastPreview: 'Perfect, multi-year invoice received and paid. Thank you for the assistance!', status: 'Closed' },
];

const statusVariant: Record<Conversation['status'], 'info' | 'success' | 'warning' | 'default'> = {
  Open: 'info',
  'Awaiting Member': 'warning',
  Escalated: 'warning',
  Closed: 'default',
};

export default function AdminMessagesPage() {
  const [tab, setTab] = useState<Tab>('open');
  const [category, setCategory] = useState<Filter>('All');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [reply, setReply] = useState('');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [addParticipantName, setAddParticipantName] = useState('');
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [result, setResult] = useState<null | { kind: 'sent' | 'closed' | 'reopened' | 'escalated' | 'added' }>(null);

  const tabCounts = {
    all: conversations.length,
    open: conversations.filter((c) => ['Open', 'Awaiting Member'].includes(c.status)).length,
    escalated: conversations.filter((c) => c.priority === 'Escalated' || c.priority === 'Flagged').length,
    closed: conversations.filter((c) => c.status === 'Closed').length,
  };

  const filtered = conversations
    .filter((c) => {
      if (tab === 'open' && !['Open', 'Awaiting Member'].includes(c.status)) return false;
      if (tab === 'escalated' && c.priority !== 'Escalated' && c.priority !== 'Flagged') return false;
      if (tab === 'closed' && c.status !== 'Closed') return false;
      if (category !== 'All' && c.category !== category) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!c.subject.toLowerCase().includes(s) && !c.from.toLowerCase().includes(s)) return false;
      }
      return true;
    });

  const selected = conversations.find((c) => c.id === selectedId) ?? conversations[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />[DEMO DATA — API pending]</Badge>
            <Link to="/admin" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ChevronRight className="h-3 w-3 rotate-180" /> Admin home
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Admin Messages &amp; Conversations</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Review, triage and reply to member conversations. Click a conversation row for the inline split view or use the full-thread view to close a conversation or add participants.
          </p>
        </div>
      </div>

      {result && (
        <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 ${
          result.kind === 'sent' || result.kind === 'added' ? 'border-success-600/30 bg-success-50' :
          result.kind === 'closed' ? 'border-danger-600/30 bg-danger-50' :
          result.kind === 'reopened' ? 'border-forum-600/30 bg-forum-50' :
          'border-warning-600/30 bg-warning-50'
        }`}>
          <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${
            result.kind === 'sent' || result.kind === 'added' ? 'text-success-600' :
            result.kind === 'closed' ? 'text-danger-600' :
            result.kind === 'reopened' ? 'text-forum-700' :
            'text-warning-600'
          }`} />
          <div className="text-sm">
            {result.kind === 'sent' && <><p className="font-semibold text-success-800">Reply sent</p><p className="text-xs text-success-700/90 mt-0.5">Delivered to all participants. Audit entry created.</p></>}
            {result.kind === 'closed' && <><p className="font-semibold text-danger-800">Conversation closed</p><p className="text-xs text-danger-700/90 mt-0.5">Members can reopen by replying; CRO can reopen manually at any time.</p></>}
            {result.kind === 'reopened' && <><p className="font-semibold text-forum-900">Conversation re-opened</p><p className="text-xs text-ink-muted mt-0.5">Added to Open queue with you as the assignee.</p></>}
            {result.kind === 'escalated' && <><p className="font-semibold text-warning-800">Escalated to Scientific Advisory Board</p><p className="text-xs text-warning-700/90 mt-0.5">An escalation memo with context has been sent to all SAB members.</p></>}
            {result.kind === 'added' && <><p className="font-semibold text-success-800">Participant added</p><p className="text-xs text-success-700/90 mt-0.5">Shared the full thread history with the new participant.</p></>}
          </div>
          <button onClick={() => setResult(null)} className="ml-auto p-1 rounded-md text-ink-muted hover:bg-white/80 self-start"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Open Conversations', value: tabCounts.open.toString(), icon: MessageSquare, color: 'forum', note: `${tabCounts.escalated} escalated` },
          { label: 'New Messages', value: conversations.reduce((a, b) => a + b.unreadCount, 0).toString(), icon: Eye, color: 'brass', note: 'Require reply' },
          { label: 'Avg. Response', value: '2.1 h', icon: Clock, color: 'slateteal', note: 'Working hours' },
          { label: 'Active CROs', value: '3 online', icon: Users, color: 'forum', note: '42 members online' },
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
                    {(['All', 'Member Support', 'Project Query', 'Credential Issue', 'Publication Problem', 'Billing', 'Report Content'] as Filter[]).map((v) => <option key={v} value={v}>{v}</option>)}
                  </SelectInput>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              <div className="divide-y divide-paper-border max-h-[650px] overflow-y-auto">
                {filtered.map((c) => {
                  const isSel = c.id === selectedId;
                  return (
                    <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full text-left p-4 transition-colors ${isSel ? 'bg-forum-50/70 border-l-4 border-forum-600' : 'hover:bg-forum-50/40 border-l-4 border-transparent'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                            {c.from.split(' ').slice(1, 2).concat(c.from.split(' ').slice(-1)).map((n) => n[0]).join('')}
                          </div>
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
                              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.lastActivity}</span>
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
                {filtered.length === 0 && (
                  <div className="p-10 text-center text-sm text-ink-subtle">No conversations match the current filters.</div>
                )}
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
                  <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold flex items-center justify-center">
                    {selected.from.split(' ').slice(1, 2).concat(selected.from.split(' ').slice(-1)).map((n: string) => n[0]).join('')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-semibold text-forum-900">{selected.subject}</h3>
                      <Badge variant={statusVariant[selected.status]}>{selected.status}</Badge>
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
                  {selected.status !== 'Closed' && (
                    <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setShowCloseConfirm(true)}>
                      <Ban className="h-4 w-4" />
                      Close Conversation
                    </Button>
                  )}
                  {selected.status === 'Closed' && (
                    <Button variant="primary" size="sm" onClick={() => setResult({ kind: 'reopened' })}>
                      <MessageSquare className="h-4 w-4" />
                      Re-open
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowAddParticipant(true)}>
                    <Users className="h-4 w-4" />
                    Add Participant
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 p-0">
              <div className="p-4 sm:p-6 space-y-4 max-h-[400px] overflow-y-auto">
                {[
                  { who: 'member', name: selected.from, at: 'Aug 18, 09:12', text: selected.lastPreview },
                  { who: 'system', name: 'System', at: 'Aug 18, 09:13', text: `Conversation tagged: ${selected.category}. Auto-assigned to CRO queue.` },
                  { who: 'admin', name: 'CRO Office', at: 'Aug 18, 10:04', text: 'Thank you for the detailed message. I have cross-referenced with the related records and I am taking this to the Scientific Advisory Board (SAB) for a quick check. I will reply with their view today.' },
                  { who: 'member', name: selected.from, at: 'Aug 18, 15:22', text: 'Thanks for the quick reply — much appreciated. I understand the SAB angle and I am happy to provide any additional context if helpful.' },
                ].map((m, i) => (
                  <div key={i} className={`flex ${m.who === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${
                      m.who === 'system' ? 'bg-slateteal-100 text-slateteal-700 rounded-lg' :
                      m.who === 'admin' ? 'bg-forum-600 text-white rounded-2xl rounded-br-md' :
                      'bg-paper-raised border border-paper-border text-ink rounded-2xl rounded-bl-md'
                    } px-4 py-3`}>
                      <div className={`flex items-center gap-2 mb-1 ${
                        m.who === 'admin' ? 'text-forum-200' : m.who === 'system' ? 'text-slateteal-700/70' : 'text-ink-subtle'
                      }`}>
                        <span className="text-xs font-semibold flex items-center gap-1">
                          {m.who === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                          {m.name}
                        </span>
                        <span className="text-[10px]">· {m.at}</span>
                      </div>
                      <p className="text-sm leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-paper-border p-4 sm:p-6">
                <TextInput placeholder="Write your reply (sent as CRO Office — visible to all participants)." className="mb-3" value={reply} onChange={(e) => setReply(e.target.value)} />
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
                    <ShieldCheck className="h-4 w-4 text-forum-700" />
                    Signed as CRO Office · creates audit entry
                    {reply && <span className="text-forum-700 font-medium">· {reply.length} chars</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" disabled={!selectedId} onClick={() => setShowEscalateConfirm(true)}>
                      <AlertCircle className="h-4 w-4" />
                      Escalate to SAB
                    </Button>
                    <Button variant="primary" disabled={!reply.trim()} onClick={() => { setResult({ kind: 'sent' }); setReply(''); }}>
                      <Send className="h-4 w-4" />
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
                <p className="text-xs text-ink-subtle mt-0.5">2 admins · {selected.participantCount - 2} members</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Total Messages</p>
                <p className="mt-2 font-display text-2xl font-semibold text-forum-900">{selected.totalMessages}</p>
                <p className="text-xs text-ink-subtle mt-0.5">last {selected.lastActivity}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Related Records</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Button as="link" to="/admin/projects" variant="ghost" size="sm" className="!px-2 !py-1 h-auto">
                    <Badge variant="brass" className="!text-[11px]">1 Project</Badge>
                  </Button>
                  <Button as="link" to="/admin/publications" variant="ghost" size="sm" className="!px-2 !py-1 h-auto">
                    <Badge variant="info" className="!text-[11px]">1 Publication</Badge>
                  </Button>
                  <Button as="link" to="/admin/support" variant="ghost" size="sm" className="!px-2 !py-1 h-auto">
                    <Badge variant="default" className="!text-[11px]">1 SR</Badge>
                  </Button>
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

      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-danger-100 text-danger-600 flex items-center justify-center"><Ban className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Close this conversation?</h3>
                  {selected && <p className="text-xs text-ink-subtle mt-0.5 font-mono truncate max-w-[22rem]">{selected.id} · {selected.subject}</p>}
                </div>
              </div>
              <button onClick={() => setShowCloseConfirm(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 text-sm text-ink-muted space-y-2">
              <p>Closing will remove this thread from the Open queue. The member can still reopen by replying to the original email, or you can reopen manually at any time.</p>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" defaultChecked className="mt-0.5 accent-forum-600" /><span>Email a closing summary to all participants.</span></label>
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setShowCloseConfirm(false)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" onClick={() => { setShowCloseConfirm(false); setResult({ kind: 'closed' }); }}>
                <CheckCircle2 className="h-4 w-4" />Confirm Close
              </Button>
            </div>
          </div>
        </div>
      )}

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

      {showEscalateConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Escalate to Scientific Advisory Board?</h3>
                  {selected && <p className="text-xs text-ink-subtle mt-0.5 font-mono truncate max-w-[22rem]">{selected.id}</p>}
                </div>
              </div>
              <button onClick={() => setShowEscalateConfirm(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 text-sm text-ink-muted space-y-2">
              <p>A sealed escalation memo with this conversation, related records, and the member identity will be emailed to all current SAB members. Priority will be set to <Badge variant="danger" className="!text-[10px] !py-0 inline-flex">ESCALATED</Badge>.</p>
              <TextInput label="Escalation note (visible to SAB only)" placeholder="Summarize the guidance you are asking for." />
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setShowEscalateConfirm(false)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => { setShowEscalateConfirm(false); setResult({ kind: 'escalated' }); }}>
                <AlertCircle className="h-4 w-4" />Send Escalation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
