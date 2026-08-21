import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  Clock,
  Send,
  ArrowLeft,
  ChevronRight,
  Users,
  ShieldCheck,
  AlertCircle,
  Ban,
  Hash,
  FileText,
  Eye,
  Building2,
  Mail,
  Calendar,
  MoreHorizontal,
  Plus,
  Link as LinkIcon,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type Category = 'Member Support' | 'Project Query' | 'Credential Issue' | 'Publication Problem' | 'Billing' | 'Report Content';
type Status = 'Open' | 'Awaiting Member' | 'Escalated' | 'Closed';
type Priority = 'Standard' | 'Escalated' | 'Flagged';

interface Message {
  id: string;
  who: 'member' | 'admin' | 'system';
  name: string;
  at: string;
  text: string;
  attachments?: { name: string; size: string; type: string }[];
  internal?: boolean;
}

interface Participant {
  name: string;
  role: string;
  joinedAt: string;
  email: string;
}

interface Conversation {
  id: string;
  subject: string;
  fromName: string;
  fromMemberId: string;
  fromEmail: string;
  fromInstitution: string;
  category: Category;
  createdAt: string;
  lastActivity: string;
  status: Status;
  priority: Priority;
  assignee: string;
  participants: Participant[];
  messages: Message[];
  linkedRecords: { label: 'Project' | 'Publication' | 'Support Request'; name: string; id: string }[];
  tags: string[];
  sla: string;
}

const conversationsById: Record<string, Conversation> = {
  'cm-00892': {
    id: 'CM-00892',
    subject: 'Publication approval delay — wearable EEG study',
    fromName: 'Dr. T. Mbeki',
    fromMemberId: 'IFSMHP-2024-000198',
    fromEmail: 't.mbeki@wits.ac.za',
    fromInstitution: 'Wits University · Psychiatry',
    category: 'Publication Problem',
    createdAt: 'Aug 18, 2026 09:12',
    lastActivity: '15 minutes ago',
    status: 'Open',
    priority: 'Escalated',
    assignee: 'Dr. A. Whitfield (CRO Lead)',
    participants: [
      { name: 'Dr. T. Mbeki', role: 'Member', joinedAt: 'Aug 18, 09:12', email: 't.mbeki@wits.ac.za' },
      { name: 'CRO Office', role: 'Administrator', joinedAt: 'Aug 18, 09:13', email: 'cro-office@ifsmhp.example' },
      { name: 'SAB — Reviewer 3', role: 'Scientific Advisory Board', joinedAt: 'Aug 19, 10:44', email: 'sab@ifsmhp.example' },
    ],
    messages: [
      { id: 'm1', who: 'member', name: 'Dr. T. Mbeki', at: 'Aug 18, 09:12', text: 'Dear CRO Office — My publication (#pub-00344) has been Under Review for 11 days. The study was completed and cleared by the CRO ethics delegate on August 10. Per §12 of the Publications Policy, review SLA is 7 working days for a low-risk wearable EEG study. Could you please advise on the hold and a realistic approval ETA? Full protocol, ethics number and reviewer names are attached.' , attachments: [{ name: 'Protocol-W-EEG-21b.pdf', size: '480 KB', type: 'PDF' }, { name: 'Ethics_Clearance_CRO-01023.pdf', size: '220 KB', type: 'PDF' }, { name: 'ReviewerNames.txt', size: '2 KB', type: 'TXT' }]},
      { id: 'm2', who: 'system', name: 'System', at: 'Aug 18, 09:13', text: 'Conversation auto-categorized as Publication Problem · cross-linked to PUB-00344 · triaged to CRO queue with standard priority.' },
      { id: 'm3', who: 'admin', name: 'CRO Office', at: 'Aug 18, 10:04', text: 'Thank you for the detailed message, Dr. Mbeki. I have cross-referenced with the related records and identified that SAB Reviewer 3 is on conference travel. I am taking this to the alternate reviewer pathway under §12.5 and will reply with their view within today.' },
      { id: 'm4', who: 'member', name: 'Dr. T. Mbeki', at: 'Aug 18, 15:22', text: 'Thanks for the quick reply — much appreciated. I understand the SAB travel angle and I am happy to provide any additional context if helpful. The university press office is holding a press release that mentions the study so a late-week signal would be valuable.' },
      { id: 'm5', who: 'admin', name: 'SAB — Reviewer 3', at: 'Aug 19, 10:44', text: 'I am back on deck. Apologies for the delay — I have run the alternate pathway this morning via the SAB alternate delegate and we have no objections. The study meets the criteria for Section 12. expedited review. Proceeding with an approval recommendation to CRO now, ETA within 4 hours.', internal: false },
    ],
    linkedRecords: [
      { label: 'Publication', name: 'PUB-00344: Wearable EEG biomarker study', id: 'pub-00344' },
      { label: 'Project', name: 'PA-00021 · Southern Africa Cohort Study', id: 'pa-00021' },
      { label: 'Support Request', name: 'SR-00240 · Letter of support request', id: 'sr-00240' },
    ],
    tags: ['SLA-exceeded', 'SAB-escalated', 'Press-office-sensitive'],
    sla: 'SLA exceeded by 4 days',
  },
  'cm-00891': {
    id: 'CM-00891',
    subject: 'Credential document viewer showing a 404 on file download',
    fromName: 'Dr. S. Wijaya',
    fromMemberId: 'IFSMHP-2024-000156',
    fromEmail: 's.wijaya@ui.ac.id',
    fromInstitution: 'Universitas Indonesia',
    category: 'Credential Issue',
    createdAt: 'Aug 19, 2026 11:02',
    lastActivity: '2 hours ago',
    status: 'Awaiting Member',
    priority: 'Flagged',
    assignee: 'System Operations (CRO)',
    participants: [
      { name: 'Dr. S. Wijaya', role: 'Member', joinedAt: 'Aug 19', email: 's.wijaya@ui.ac.id' },
      { name: 'CRO Operations', role: 'Administrator', joinedAt: 'Aug 19', email: 'ops@ifsmhp.example' },
    ],
    messages: [
      { id: 'm1', who: 'member', name: 'Dr. S. Wijaya', at: 'Aug 19, 11:02', text: 'When I click the "Secure Download" button on my MD credential I get a 404 page. Secure View works. Tested on 3 browsers.' },
      { id: 'm2', who: 'admin', name: 'CRO Operations', at: 'Aug 19, 13:15', text: 'Thanks Dr. Wijaya — storage endpoint was incorrectly routed. Can you please test the alternate download link I sent by email?' },
    ],
    linkedRecords: [],
    tags: ['storage-ops', 'p1-incident'],
    sla: 'Within 48h SLA',
  },
  'cm-00890': {
    id: 'CM-00890',
    subject: 'Moral Support pairing — follow-up on member check-in',
    fromName: 'Dr. E. Thompson',
    fromMemberId: 'IFSMHP-2024-000105',
    fromEmail: 'e.thompson@ox.ac.uk',
    fromInstitution: 'University of Oxford',
    category: 'Member Support',
    createdAt: 'Aug 15',
    lastActivity: '5 hours ago',
    status: 'Open',
    priority: 'Standard',
    assignee: 'Wellness Committee',
    participants: [],
    messages: [],
    linkedRecords: [],
    tags: [],
    sla: 'Within 72h SLA',
  },
};

const statusVariant: Record<Status, 'info' | 'success' | 'warning' | 'default'> = {
  Open: 'info',
  'Awaiting Member': 'warning',
  Escalated: 'warning',
  Closed: 'default',
};

const priorityVariant: Record<Priority, 'default' | 'warning' | 'danger'> = {
  Standard: 'default',
  Escalated: 'warning',
  Flagged: 'danger',
};

const categoryVariant: Record<Category, 'default' | 'info' | 'success' | 'brass' | 'warning' | 'danger'> = {
  'Member Support': 'success',
  'Project Query': 'info',
  'Credential Issue': 'warning',
  'Publication Problem': 'brass',
  Billing: 'default',
  'Report Content': 'warning',
};

export default function AdminMessagesDetailPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const conv = useMemo(() => (conversationsById[conversationId ?? ''] ?? conversationsById['cm-00892']!), [conversationId]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState<Status>(conv.status);
  const [newPriority, setNewPriority] = useState<Priority>(conv.priority);
  const [newAssignee, setNewAssignee] = useState(conv.assignee);
  const [addParticipantOpen, setAddParticipantOpen] = useState(false);
  const [participantName, setParticipantName] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [internalNote, setInternalNote] = useState('');
  const [showInternal, setShowInternal] = useState(true);
  const [signAs, setSignAs] = useState<'CRO Office' | 'SAB' | 'CRO Lead (signed)'>('CRO Office');

  useEffect(() => {
    setNewStatus(conv.status);
    setNewPriority(conv.priority);
    setNewAssignee(conv.assignee);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 100);
  }, [conversationId, conv.status, conv.priority, conv.assignee]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 700));
    setSending(false);
    setReply('');
  };

  const canSend = reply.trim().length > 0;
  const participants = conv.participants.length > 0 ? conv.participants : [
    { name: conv.fromName, role: 'Member', joinedAt: conv.createdAt, email: conv.fromEmail },
    { name: conv.assignee, role: 'Administrator', joinedAt: conv.createdAt, email: 'cro@ifsmhp.example' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />{DEMO_LABEL}</Badge>
            <Link to="/admin/messages" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to inbox
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{conv.subject}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
            <code className="font-mono text-[10px] text-ink-subtle bg-paper border border-paper-border px-1.5 py-0.5 rounded uppercase tracking-wider">{conv.id}</code>
            <Badge variant={statusVariant[newStatus]}>{newStatus}</Badge>
            <Badge variant={priorityVariant[newPriority]}>{newPriority === 'Escalated' && <AlertTriangle className="h-3 w-3 mr-0.5" />}{newPriority}</Badge>
            <Badge variant={categoryVariant[conv.category]}>{conv.category}</Badge>
            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{conv.sla}</span>
            <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />Created {conv.createdAt}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {newStatus !== 'Closed' && (
            <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setConfirmClose(true)}>
              <Ban className="h-4 w-4" /> Close Conversation
            </Button>
          )}
          {newStatus === 'Closed' && (
            <Button variant="primary" size="sm" onClick={() => setNewStatus('Open')}>
              <MessageSquare className="h-4 w-4" /> Re-open
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAddParticipantOpen(true)}>
            <Users className="h-4 w-4" /> Add Participant
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-paper-border bg-paper overflow-hidden shadow-sm">
            <div className="p-4 sm:p-6 border-b border-paper-border bg-forum-50/40">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold flex items-center justify-center">
                    {conv.fromName.split(' ').slice(1, 2).concat(conv.fromName.split(' ').slice(-1)).map((n) => n[0]).join('')}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-forum-900">{conv.fromName}</p>
                    <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-0.5"><Mail className="h-3 w-3" />{conv.fromEmail}</p>
                    <p className="text-xs text-ink-subtle mt-0.5 inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{conv.fromInstitution} · <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{conv.fromMemberId}</code></p>
                  </div>
                </div>
                <div className="text-right text-xs text-ink-subtle space-y-1">
                  <p className="inline-flex items-center gap-1 justify-end"><Clock className="h-3 w-3" />Last activity: {conv.lastActivity}</p>
                  <p className="inline-flex items-center gap-1 justify-end"><ShieldCheck className="h-3 w-3 text-forum-700" />Assigned to: <span className="font-medium text-ink">{conv.assignee}</span></p>
                </div>
              </div>
            </div>

            <div ref={scrollRef} className="p-4 sm:p-6 space-y-5 max-h-[520px] overflow-y-auto">
              {conv.messages.length === 0 ? (
                <div className="py-10 text-center text-ink-subtle text-sm">No message history in this view.</div>
              ) : (
                conv.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.who === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] sm:max-w-[85%] ${
                      m.internal ? 'bg-warning-50 border border-warning-200 rounded-2xl text-warning-800' :
                      m.who === 'system' ? 'bg-slateteal-100 text-slateteal-700 rounded-lg' :
                      m.who === 'admin' ? 'bg-forum-600 text-white rounded-2xl rounded-br-md' :
                      'bg-paper-raised border border-paper-border text-ink rounded-2xl rounded-bl-md'
                    } px-4 py-3`}>
                      <div className={`flex items-center gap-2 mb-1 ${
                        m.internal ? 'text-warning-700' :
                        m.who === 'admin' ? 'text-forum-200' : m.who === 'system' ? 'text-slateteal-700/70' : 'text-ink-subtle'
                      }`}>
                        <span className="text-xs font-semibold flex items-center gap-1">
                          {m.internal && <Eye className="h-3.5 w-3.5" />}
                          {m.who === 'admin' && <ShieldCheck className="h-3.5 w-3.5" />}
                          {m.name}
                          {m.internal && <Badge variant="warning" className="!text-[10px] !py-0 !px-1.5 ml-1">INTERNAL ONLY</Badge>}
                        </span>
                        <span className="text-[10px]">· {m.at}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                      {m.attachments && m.attachments.length > 0 && (
                        <div className={`mt-3 flex flex-wrap gap-2`}>
                          {m.attachments.map((a) => (
                            <div key={a.name} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] ${
                              m.internal ? 'bg-warning-100/60' :
                              m.who === 'admin' ? 'bg-white/10 text-forum-100' : 'bg-forum-50 text-forum-700 border border-forum-100'
                            }`}>
                              <FileText className="h-3.5 w-3.5" />
                              <span className="font-medium">{a.name}</span>
                              <span className="opacity-70">· {a.size}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-paper-border p-4 sm:p-6 space-y-3 bg-paper/70">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <SelectInput value={signAs as string} onChange={(e) => setSignAs(e.target.value as any)} className="w-auto [&>select]:text-xs">
                  <option>Sign as CRO Office</option>
                  <option>Sign as SAB</option>
                  <option>Sign as CRO Lead (signed)</option>
                </SelectInput>
                <div className="flex items-center gap-1.5 text-ink-subtle">
                  <ShieldCheck className="h-4 w-4 text-forum-700" /> Signed as {signAs} · audit entry created
                </div>
              </div>
              <TextArea
                rows={3}
                label={null as any}
                placeholder={`Write your reply — signed as ${signAs}. Visible to all conversation participants.`}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className="mb-0"
              />
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm"><Plus className="h-3.5 w-3.5" />Attach File</Button>
                  <Button variant="ghost" size="sm"><LinkIcon className="h-3.5 w-3.5" />Link Record</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowInternal((v) => !v)}>
                    <AlertCircle className="h-3.5 w-3.5" />
                    {showInternal ? 'Hide Internal Note' : 'Add Internal Note (admins only)'}
                  </Button>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" className="border-warning-600/30 text-warning-600 hover:bg-warning-100">
                    <AlertTriangle className="h-4 w-4" /> Escalate to SAB
                  </Button>
                  <Button variant="primary" onClick={sendReply} disabled={sending || !canSend}>
                    {sending ? <Clock className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Reply
                  </Button>
                </div>
              </div>
              {showInternal && (
                <div className="rounded-lg border border-warning-500/30 bg-warning-50/50 p-4 mt-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-warning-700 mb-2 flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" /> Internal Note — Admins only, never shared with member
                  </p>
                  <TextArea rows={2} placeholder="Triage notes, follow-ups, decision rationale." value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className="mb-0" />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setInternalNote(''); }}>Clear</Button>
                    <Button variant="primary" size="sm" className="bg-warning-600 hover:bg-warning-600/90" disabled={!internalNote.trim()}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Save Internal
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-forum-600" /> Linked Records
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Cross-referenced items in the IFSMHP registry</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {conv.linkedRecords.length === 0 ? (
                <p className="text-sm text-ink-subtle py-4 text-center">No linked records for this conversation.</p>
              ) : conv.linkedRecords.map((lr) => (
                <Link
                  key={lr.id}
                  to={
                    lr.label === 'Project' ? `/admin/projects/${lr.id}` :
                    lr.label === 'Publication' ? `/admin/publications/${lr.id}` :
                    `/admin/support/${lr.id}`
                  }
                  className="block"
                >
                  <div className="flex items-center justify-between p-3.5 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 shrink-0 flex items-center justify-center rounded-md bg-forum-50 text-forum-700">
                        {lr.label === 'Project' ? <FileText className="h-4 w-4" /> : lr.label === 'Publication' ? <FileText className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle">{lr.label}</p>
                        <p className="text-sm font-medium text-forum-900 truncate">{lr.name}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0" />
                  </div>
                </Link>
              ))}
              {conv.linkedRecords.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full mt-2">
                  <Plus className="h-3.5 w-3.5" /> Link additional record…
                </Button>
              )}
            </CardContent>
          </Card>

          {conv.tags.length > 0 && (
            <Card>
              <CardHeader>
                <h3 className="font-display text-lg font-semibold text-forum-900">Tags &amp; Classification</h3>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {conv.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-forum-50 text-forum-700 px-3 py-1 text-xs font-medium border border-forum-100">
                      <Hash className="h-3 w-3" />{t}
                    </span>
                  ))}
                  <Button variant="ghost" size="sm"><Plus className="h-3.5 w-3.5" />Add tag</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900">Conversation Admin</h3>
              <p className="text-xs text-ink-subtle mt-0.5">Re-classify, re-assign, and update workflow.</p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block">Status</label>
                <SelectInput value={newStatus} onChange={(e) => setNewStatus(e.target.value as Status)}>
                  {(['Open', 'Awaiting Member', 'Escalated', 'Closed'] as Status[]).map((s) => <option key={s}>{s}</option>)}
                </SelectInput>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block">Priority</label>
                <SelectInput value={newPriority} onChange={(e) => setNewPriority(e.target.value as Priority)}>
                  {(['Standard', 'Escalated', 'Flagged'] as Priority[]).map((p) => <option key={p}>{p}</option>)}
                </SelectInput>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block">Category</label>
                <SelectInput value={conv.category} onChange={() => {}}>
                  {(['Member Support', 'Project Query', 'Credential Issue', 'Publication Problem', 'Billing', 'Report Content'] as Category[]).map((c) => <option key={c}>{c}</option>)}
                </SelectInput>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block">Assignee</label>
                <SelectInput value={newAssignee} onChange={(e) => setNewAssignee(e.target.value)}>
                  <option>Dr. A. Whitfield (CRO Lead)</option>
                  <option>System Operations (CRO)</option>
                  <option>CRO Office (triage)</option>
                  <option>Wellness Committee</option>
                  <option>Publications Queue</option>
                  <option>SAB — Alternate Reviewer</option>
                </SelectInput>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> SLA Target
                </label>
                <div className="text-sm p-2.5 rounded-lg bg-paper border border-paper-border">
                  <span className={conv.sla.includes('exceeded') ? 'text-danger-600 font-semibold' : 'text-success-600 font-semibold'}>{conv.sla}</span>
                </div>
              </div>
              <Button variant="primary" size="sm" className="w-full justify-center">
                <CheckCircle2 className="h-4 w-4" /> Save Admin Updates
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-forum-600" /> Participants ({participants.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setAddParticipantOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {participants.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-paper-border hover:bg-forum-50/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-forum-500 to-slateteal-400 text-white text-[10px] font-bold flex items-center justify-center">
                      {p.name.split(' ').slice(-1).map((n) => n[0]).join('')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-forum-900 truncate">{p.name}</p>
                      <p className="text-[11px] text-ink-subtle truncate"><Badge variant="default" className="!py-0 !text-[10px] mr-1">{p.role}</Badge>{p.email}</p>
                    </div>
                  </div>
                  {p.role === 'Member' ? (
                    <Badge variant="default" className="!py-0 !text-[10px]">{p.joinedAt}</Badge>
                  ) : (
                    <button className="p-1 rounded text-ink-muted hover:bg-paper"><MoreHorizontal className="h-4 w-4" /></button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900">Conversation Summary</h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-md bg-paper">
                <p className="font-display text-xl font-bold text-forum-900">{conv.messages.filter((m) => m.who !== 'system').length}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Messages</p>
              </div>
              <div className="p-2 rounded-md bg-paper">
                <p className="font-display text-xl font-bold text-brass-700">{participants.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Participants</p>
              </div>
              <div className="p-2 rounded-md bg-paper">
                <p className="font-display text-xl font-bold text-slateteal-700">{conv.linkedRecords.length}</p>
                <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Links</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-paper-raised border border-paper-border shadow-2xl">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Close Conversation?</h3>
                  <p className="text-xs text-ink-subtle mt-0.5">{conv.subject}</p>
                </div>
              </div>
              <button onClick={() => setConfirmClose(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <TextArea rows={3} label={
                <span>Closing summary <span className="text-ink-subtle font-normal text-[11px]">(visible in audit)</span></span>
              } placeholder="Resolution, outcome, and any follow-up." />
              <Checkbox name="notify" id="notify" label="Notify the member by email that the conversation has been closed." defaultChecked />
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60 rounded-b-2xl">
              <Button variant="ghost" size="sm" onClick={() => setConfirmClose(false)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" onClick={() => { setNewStatus('Closed'); setConfirmClose(false); navigate('/admin/messages'); }}>
                <CheckCircle2 className="h-4 w-4" /> Confirm Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {addParticipantOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900">Add Participant</h3>
                <p className="text-xs text-ink-subtle mt-0.5">Add admins or second reviewers to the conversation.</p>
              </div>
              <button onClick={() => setAddParticipantOpen(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><ChevronDown className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <TextInput label="Search staff or member" placeholder="Name, member ID, or email address…" value={participantName} onChange={(e) => setParticipantName(e.target.value)} />
              <SelectInput label="Role in conversation">
                <option>Administrator (CRO)</option>
                <option>Scientific Advisory Board</option>
                <option>Second Reviewer</option>
                <option>Observer (read-only)</option>
              </SelectInput>
              <Checkbox id="notify-add" name="notify-add" label="Send invitation email to the participant." defaultChecked />
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60 rounded-b-2xl">
              <Button variant="ghost" size="sm" onClick={() => setAddParticipantOpen(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!participantName.trim()}>
                <Users className="h-4 w-4" /> Add Participant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
