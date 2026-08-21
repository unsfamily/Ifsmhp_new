import { useMemo, useState } from 'react';
import {
  Mail,
  Search,
  Clock,
  Send,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  User,
  Building2,
  Phone,
  XCircle,
  MessageSquare,
  Filter,
  Plus,
  Save,
  X,
  AlertTriangle,
  Flag,
  Users,
  ShieldCheck,
  ArrowRight,
  Eye,
  Ban,
  Sparkles,
  FileText,
  Check,
  Trash2,
  History as HistoryIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

type Status = 'All' | 'New' | 'Assigned' | 'Responded' | 'Closed' | 'Spam';
type Topic = 'All' | 'General Question' | 'Membership' | 'Events' | 'Publications' | 'Press / Media' | 'Partnership';
type Priority = 'Urgent' | 'High' | 'Normal' | 'Low';

interface InternalNote {
  id: string;
  author: string;
  at: string;
  text: string;
  private: boolean;
}

interface StatusHistoryEntry {
  at: string;
  from: Exclude<Status, 'All'>;
  to: Exclude<Status, 'All'>;
  by: string;
  reason?: string;
}

interface ReplyMessage {
  id: string;
  author: string;
  authorType: 'member' | 'admin';
  at: string;
  text: string;
}

interface Inquiry {
  id: string;
  name: string;
  email: string;
  organization: string;
  country: string;
  phone?: string;
  topic: Exclude<Topic, 'All'>;
  subject: string;
  message: string;
  receivedAt: string;
  status: Exclude<Status, 'All'>;
  replies: number;
  assignee?: string;
  priority: Priority;
  internalNotes: InternalNote[];
  statusHistory: StatusHistoryEntry[];
  replyThread: ReplyMessage[];
  attachmentCount: number;
  lastActivity: string;
}

const ASSIGNEES = [
  'Unassigned', 'CRO Office', 'Communications', 'Publications Queue', 'Events Committee', 'Grants Office', 'Wellness Committee', 'Support Queue',
];

const PRIORITY_VARIANT: Record<Priority, 'danger' | 'warning' | 'default' | 'info'> = {
  Urgent: 'danger', High: 'warning', Normal: 'default', Low: 'info',
};

const statusVariant: Record<Exclude<Status, 'All'>, 'info' | 'warning' | 'success' | 'default' | 'brass' | 'danger'> = {
  New: 'info', Assigned: 'warning', Responded: 'brass', Closed: 'default', Spam: 'danger',
};

const initialInquiries: Inquiry[] = [
  {
    id: 'inq-0148', name: 'Ariana Varga', email: 'avarga@example.hu', organization: 'ELTE Budapest · Dept. of Psychology', country: 'Hungary',
    phone: '+36 1 381 3400', topic: 'Membership', subject: 'Can I apply if my PhD is currently being examined?',
    message: 'Good morning — my PhD viva is scheduled for late September. The application asks for confirmed degree date. May I apply with a letter from my supervisor confirming the submission, and submit the official document once the exam is complete?',
    receivedAt: 'Today · 08:44 UTC', status: 'New', replies: 0,
    priority: 'High', attachmentCount: 1, lastActivity: '3 minutes ago',
    internalNotes: [
      { id: 'n1', author: 'CRO · E. Whitfield', at: '2h ago', text: 'Per §3.2 of the credential guide — a supervisor letter IS acceptable for in-progress PhDs. Application template 3b applies, but the candidate should be instructed to upload the final document within 30 days of award.', private: false },
    ],
    statusHistory: [
      { at: 'Today · 08:44 UTC', from: 'New', to: 'New', by: 'system' },
    ],
    replyThread: [],
  },
  {
    id: 'inq-0147', name: 'Dr. Kwame Asante', email: 'k.asante@example.gh', organization: 'University of Ghana Medical School', country: 'Ghana',
    topic: 'Partnership', subject: 'Proposed partnership for a mental health workforce training program',
    message: 'We are writing to propose a joint 18-month training program for community mental health workers in three regions of Ghana. We would value IFSMHP endorsement and a possible SAB member on our scientific advisory committee.',
    receivedAt: 'Yesterday · 16:02 UTC', status: 'Assigned', replies: 1, assignee: 'CRO Office',
    priority: 'Urgent', attachmentCount: 3, lastActivity: '11 hours ago',
    internalNotes: [
      { id: 'n2', author: 'Communications · K. Patel', at: 'Yesterday', text: 'Escalated to CRO Lead. High potential for LMIC track impact. Recommend scheduling 30-min intro call with Ghana lead + 1 SAB member + Grants Office.', private: false },
      { id: 'n3', author: 'CRO · E. Whitfield', at: '14h ago', text: 'Flagged to SAB Chair (Lindberg) for SAB member. Likely candidate: public health track, Prof. Owusu. Budget implications: 1-2 small grants earmarked for year-2 of the partnership.', private: true },
    ],
    statusHistory: [
      { at: 'Yesterday · 16:02 UTC', from: 'New', to: 'New', by: 'system' },
      { at: 'Yesterday · 16:31 UTC', from: 'New', to: 'Assigned', by: 'Communications · K. Patel', reason: 'Triaged to CRO Office — LMIC partnership request per SOP §7.' },
    ],
    replyThread: [
      { id: 'r1', authorType: 'admin', author: 'CRO Office', at: 'Yesterday · 16:40 UTC', text: 'Thank you, Dr. Asante — your partnership proposal has been received and is under triage. The CRO Office will reply with an introductory call proposal within 3 working days. Reference: INQ-0147.' },
    ],
  },
  {
    id: 'inq-0146', name: 'Yuki Yamada', email: 'y.yamada@example.jp', organization: 'University of Tokyo · press office', country: 'Japan',
    topic: 'Press / Media', subject: 'Press accreditation — 2026 Annual Scientific Symposium',
    message: 'Press officer at the University of Tokyo, writing on behalf of Prof. Tanaka. Requesting press accreditation and interview access at the Stockholm symposium for our university media outlet and a journalist from Nature Japan.',
    receivedAt: 'Yesterday · 10:18 UTC', status: 'Assigned', replies: 1, assignee: 'Communications',
    priority: 'High', attachmentCount: 2, lastActivity: '6 hours ago',
    internalNotes: [
      { id: 'n4', author: 'Events Committee · M. Novak', at: 'Yesterday', text: 'Standard press protocol applies. Two press badges OK; interview slots allocated on Thu Sept 17 (SAB day). Nature Japan journalist: request editorial pitch first per §8.2.', private: false },
    ],
    statusHistory: [
      { at: 'Yesterday · 10:18 UTC', from: 'New', to: 'New', by: 'system' },
      { at: 'Yesterday · 11:02 UTC', from: 'New', to: 'Assigned', by: 'Events Committee · M. Novak', reason: 'Press accreditation.' },
    ],
    replyThread: [
      { id: 'r2', authorType: 'admin', author: 'Communications', at: 'Today · 03:11 UTC', text: 'Ms. Yamada — thank you for your request. We are coordinating with the press office and will confirm within 48 hours for the UTokyo representative. For the Nature Japan journalist, kindly provide a 150-word editorial pitch and a list of requested interviewees.' },
    ],
  },
  {
    id: 'inq-0145', name: 'Dr. Imani Hussein', email: 'ihussein@example.ke', organization: 'Moi University · Psychiatry Residency', country: 'Kenya',
    topic: 'Publications', subject: 'Public listing request — recent publication on postpartum screening',
    message: 'Our cross-sectional paper published in BMC Psychiatry should appear in the public publications listing. It was uploaded by my co-author (Dr. Wanjiru, IFSMHP-2024-000089) three weeks ago but is not yet visible.',
    receivedAt: '3 days ago', status: 'Responded', replies: 3, assignee: 'Publications Queue',
    priority: 'Normal', attachmentCount: 0, lastActivity: 'Yesterday',
    internalNotes: [
      { id: 'n5', author: 'Publications Queue · R. Mehta', at: '2 days ago', text: 'Investigated. Uploaded as PUB-00344, awaiting SAB reviewer sign-off on the journal tiering (BMC Psychiatry = Tier 3). Assigned to SAB member Okafor; ETA 48h.', private: false },
    ],
    statusHistory: [
      { at: '3 days ago', from: 'New', to: 'New', by: 'system' },
      { at: '3 days ago', from: 'New', to: 'Assigned', by: 'system' },
      { at: '2 days ago', from: 'Assigned', to: 'Responded', by: 'Publications Queue · R. Mehta', reason: 'Acknowledged and SAB reviewer assigned.' },
    ],
    replyThread: [
      { id: 'r3', authorType: 'admin', author: 'Publications Queue', at: '2 days ago', text: 'Dr. Hussein — thank you for following up. I located the submission: PUB-00344 (BMC Psychiatry). It is under SAB tiering review and expected to be published within 48 hours.' },
      { id: 'r4', authorType: 'member', author: 'Dr. Imani Hussein', at: 'Yesterday · 08:22 UTC', text: 'Thank you. Does "Tier 3" affect IFSMHP listing, or just the award eligibility? The paper is part of a grant final report, so visibility matters to my program officer.' },
      { id: 'r5', authorType: 'admin', author: 'Publications Queue', at: 'Yesterday · 10:09 UTC', text: 'Tiering only affects the medal/award process. Public listing is unaffected — the paper will appear in the member and public portals at the same time. We will send a confirmation once live.' },
    ],
  },
  {
    id: 'inq-0144', name: 'The Independent Publishers Group', email: 'info@ipg.example', organization: 'IPG · mailing list purchase', country: 'Unknown',
    topic: 'General Question', subject: 'Mailing list rental for scientific events promotion',
    message: 'We offer targeted email campaigns to mental health researchers. Can you share rate card for 1x dedicated mailing to the IFSMHP member list?',
    receivedAt: '4 days ago', status: 'Spam', replies: 0,
    priority: 'Low', attachmentCount: 0, lastActivity: '4 days ago',
    internalNotes: [
      { id: 'n6', author: 'CRO Office', at: '4 days ago', text: 'Known spam domain. DO NOT respond. Reject and mark as spam, add email address to bounce list.', private: true },
    ],
    statusHistory: [
      { at: '4 days ago', from: 'New', to: 'New', by: 'system' },
      { at: '4 days ago', from: 'New', to: 'Spam', by: 'CRO Office', reason: 'Unsolicited commercial mailing list vendor — non-IFSMHP, known spam pattern.' },
    ],
    replyThread: [],
  },
  {
    id: 'inq-0143', name: 'Maria Santos', email: 'm.santos@example.pt', organization: 'Independent Researcher', country: 'Portugal',
    topic: 'General Question', subject: 'Researcher without institutional affiliation — eligible?',
    message: 'I left my last position six months ago to raise a child and work on independent research. Can I still apply for membership, and what kind of support documents would be accepted?',
    receivedAt: '5 days ago', status: 'Responded', replies: 2,
    priority: 'Normal', attachmentCount: 1, lastActivity: '4 days ago',
    internalNotes: [
      { id: 'n7', author: 'Membership Queue', at: '5 days ago', text: '§3.3 Carer / Independent Scholar pathway: 1 peer letter of support (from any current member or non-affiliated scholar holding a PhD or equivalent) + proof of 1 peer-reviewed publication in the last 5 years. Track: Researchers, but Scientists acceptable if publications meet the bar. Consider hardship waiver.', private: false },
    ],
    statusHistory: [
      { at: '5 days ago', from: 'New', to: 'New', by: 'system' },
      { at: '5 days ago', from: 'New', to: 'Responded', by: 'Membership Queue' },
    ],
    replyThread: [
      { id: 'r6', authorType: 'admin', author: 'Membership Queue', at: '5 days ago', text: 'Hello Ms. Santos — thank you for reaching out. The Carer & Independent Scholar pathway under Membership rules §3.3 applies here. You will need (1) one peer letter of support and (2) proof of at least one peer-reviewed publication in the last five years. Application fee hardship waiver is available.' },
      { id: 'r7', authorType: 'member', author: 'Maria Santos', at: '4 days ago', text: 'Thank you — very helpful. I have one paper as first author, and a past supervisor (IFSMHP member, Prof. A. Costa) has offered the letter. I will submit next week via the regular form with the pathway box ticked. All good!' },
    ],
  },
  {
    id: 'inq-0142', name: 'Dr. Stefan Müller', email: 'stefan.mueller@example.de', organization: 'TU Munich · Research Center for Neuroengineering', country: 'Germany',
    topic: 'Events', subject: 'Request — speaker slot at next Workshop on Digital Mental Health',
    message: 'We published a validation study of a novel multimodal system. Would it be possible to propose a 20-minute talk for the digital mental health workshop scheduled for November?',
    receivedAt: '1 week ago', status: 'Closed', replies: 5, assignee: 'Events Committee',
    priority: 'Normal', attachmentCount: 2, lastActivity: '5 days ago',
    internalNotes: [
      { id: 'n8', author: 'Events Committee · M. Novak', at: '6 days ago', text: 'Digital MH workshop agenda is already set. Recommended the authors instead submit to the Poster Hall — and contact Prof. Lindberg for a short lightning-talk slot (unfunded) if a full talk opens up.', private: false },
    ],
    statusHistory: [
      { at: '1 week ago', from: 'New', to: 'New', by: 'system' },
      { at: '6 days ago', from: 'New', to: 'Assigned', by: 'Events Committee · M. Novak' },
      { at: '5 days ago', from: 'Responded', to: 'Closed', by: 'Events Committee · M. Novak', reason: 'Poster Hall offer accepted; case closed.' },
    ],
    replyThread: [
      { id: 'r8', authorType: 'admin', author: 'Events Committee', at: '6 days ago', text: 'Dr. Müller — thanks. The November workshop agenda is set, but Poster Hall is still open for submissions, and we can offer a lightning talk should any full speaker cancel.' },
      { id: 'r9', authorType: 'member', author: 'Dr. Stefan Müller', at: '5 days ago', text: 'Poster Hall accepted. When should I submit the 2-page poster abstract?' },
      { id: 'r10', authorType: 'admin', author: 'Events Committee', at: '5 days ago', text: 'Deadline Sept 15. Submission instructions have been sent. Contact us if you need a bursary for travel.' },
    ],
  },
];

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(initialInquiries);
  const [status, setStatus] = useState<Status>('All');
  const [topic, setTopic] = useState<Topic>('All');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(inquiries[0]?.id ?? null);
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');

  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [notePrivate, setNotePrivate] = useState<Record<string, boolean>>({});
  const [assignTarget, setAssignTarget] = useState<Record<string, string>>({});
  const [priorityTarget, setPriorityTarget] = useState<Record<string, Priority>>({});
  const [statusTarget, setStatusTarget] = useState<Record<string, Exclude<Status, 'All'>>>({});
  const [statusReason, setStatusReason] = useState<Record<string, string>>({});
  const [showStatusModal, setShowStatusModal] = useState<string | null>(null);
  const [confirmSpam, setConfirmSpam] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  const [saved, setSaved] = useState<string | null>(null);
  const flashSaved = (k: string) => { setSaved(k); setTimeout(() => setSaved(null), 2200); };

  const filtered = useMemo(() => inquiries.filter((i) => {
    if (status !== 'All' && i.status !== status) return false;
    if (topic !== 'All' && i.topic !== topic) return false;
    if (priorityFilter !== 'All' && i.priority !== priorityFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!i.subject.toLowerCase().includes(s) && !i.name.toLowerCase().includes(s) && !i.email.toLowerCase().includes(s) && !i.message.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [inquiries, status, topic, priorityFilter, search]);

  const newCount = inquiries.filter((i) => i.status === 'New').length;
  const spamCount = inquiries.filter((i) => i.status === 'Spam').length;
  const urgentCount = inquiries.filter((i) => i.priority === 'Urgent' && i.status !== 'Closed' && i.status !== 'Spam').length;

  const open = inquiries.find((i) => i.id === openId) ?? null;

  const sendReply = (id: string) => {
    const draft = (replyDraft[id] ?? '').trim();
    if (!draft) return;
    setInquiries((all) => all.map((i) => {
      if (i.id !== id) return i;
      const nextHistory = [...i.statusHistory];
      const patchStatus: Inquiry['status'] = i.status === 'New' || i.status === 'Assigned' ? 'Responded' : i.status;
      if (patchStatus !== i.status) {
        nextHistory.push({ at: 'Just now', from: i.status, to: patchStatus, by: 'CRO Office (you)' });
      }
      return {
        ...i,
        replies: i.replies + 1,
        replyThread: [...i.replyThread, { id: `r${Math.random()}`, authorType: 'admin', author: 'CRO Office (you)', at: 'Just now', text: draft }],
        lastActivity: 'Just now',
        status: patchStatus,
        statusHistory: nextHistory,
      };
    }));
    setReplyDraft((d) => ({ ...d, [id]: '' }));
    flashSaved(`reply-${id}`);
  };

  const addNote = (id: string) => {
    const draft = (noteDraft[id] ?? '').trim();
    if (!draft) return;
    setInquiries((all) => all.map((i) => i.id !== id ? i : {
      ...i,
      internalNotes: [...i.internalNotes, { id: `n${Math.random()}`, author: 'CRO Office (you)', at: 'Just now', text: draft, private: !!notePrivate[id] }],
      lastActivity: 'Just now',
    }));
    setNoteDraft((d) => ({ ...d, [id]: '' }));
    setNotePrivate((d) => ({ ...d, [id]: false }));
    flashSaved(`note-${id}`);
  };

  const doAssign = (id: string) => {
    const target = assignTarget[id] ?? 'Unassigned';
    setInquiries((all) => all.map((i) => i.id !== id ? i : {
      ...i,
      assignee: target === 'Unassigned' ? undefined : target,
      status: target === 'Unassigned' ? (i.status === 'Assigned' ? 'New' : i.status) : (i.status === 'New' ? 'Assigned' : i.status),
      lastActivity: 'Just now',
      statusHistory: [...i.statusHistory, {
        at: 'Just now', from: i.status,
        to: target === 'Unassigned' && i.status === 'Assigned' ? 'New' : (i.status === 'New' && target !== 'Unassigned' ? 'Assigned' : i.status),
        by: 'CRO Office (you)', reason: target === 'Unassigned' ? 'Unassigned' : `Assigned to ${target}`
      }],
    }));
    flashSaved(`assign-${id}`);
  };

  const changePriority = (id: string) => {
    const target = priorityTarget[id] ?? 'Normal';
    setInquiries((all) => all.map((i) => i.id !== id ? i : { ...i, priority: target, lastActivity: 'Just now' }));
    flashSaved(`prio-${id}`);
  };

  const applyStatusChange = (id: string) => {
    const target = (statusTarget[id] ?? 'Closed') as Exclude<Status, 'All'>;
    const current = inquiries.find((i) => i.id === id)!;
    if (target === current.status) { setShowStatusModal(null); return; }
    setInquiries((all) => all.map((i) => i.id !== id ? i : {
      ...i,
      status: target,
      lastActivity: 'Just now',
      statusHistory: [...i.statusHistory, {
        at: 'Just now', from: current.status, to: target,
        by: 'CRO Office (you)',
        reason: (statusReason[id] ?? '').trim() || undefined,
      }],
    }));
    setShowStatusModal(null);
    setStatusReason((d) => ({ ...d, [id]: '' }));
    flashSaved(`status-${id}`);
  };

  const doMarkSpam = (id: string) => {
    const cur = inquiries.find((i) => i.id === id)!;
    setInquiries((all) => all.map((i) => i.id !== id ? i : {
      ...i,
      status: 'Spam', assignee: undefined, lastActivity: 'Just now',
      statusHistory: [...i.statusHistory, { at: 'Just now', from: cur.status, to: 'Spam', by: 'CRO Office (you)', reason: 'Manually marked as spam / unsolicited commercial.' }],
    }));
    setConfirmSpam(null);
    flashSaved(`spam-${id}`);
  };

  const doClose = (id: string) => {
    const cur = inquiries.find((i) => i.id === id)!;
    setInquiries((all) => all.map((i) => i.id !== id ? i : {
      ...i, status: 'Closed', lastActivity: 'Just now',
      statusHistory: [...i.statusHistory, { at: 'Just now', from: cur.status, to: 'Closed', by: 'CRO Office (you)', reason: 'Resolved / no further action needed.' }],
    }));
    setConfirmClose(null);
    flashSaved(`close-${id}`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'New Inquiries', value: newCount.toString(), icon: Mail, color: 'forum', note: 'Requires triage', alert: urgentCount ? `${urgentCount} urgent` : null },
          { label: 'Awaiting Reply', value: inquiries.filter((i) => ['New', 'Assigned'].includes(i.status)).length.toString(), icon: Clock, color: 'brass', note: `${spamCount} marked Spam` },
          { label: 'Avg. Response', value: '6.4 h', icon: Send, color: 'slateteal', note: 'Working hours' },
          { label: 'Resolved (7d)', value: inquiries.filter((i) => i.status === 'Closed').length.toString(), icon: CheckCircle2, color: 'forum', note: 'Response rate: 96%' },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                  {k.alert && <Badge variant="danger" className="!text-[10px] !py-0"><AlertCircle className="h-3 w-3 mr-1" />{k.alert}</Badge>}
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-forum-600" />
                Public Contact Inquiries
                <Badge variant="brass" className="gap-1"><Sparkles className="h-2.5 w-2.5" />[DEMO DATA — API pending]</Badge>
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Triage messages from the public contact form. Assign a priority, team, and reply as CRO Office.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search subject, sender, message…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full sm:w-40">
                {(['All', 'New', 'Assigned', 'Responded', 'Closed', 'Spam'] as Status[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>)}
              </SelectInput>
              <SelectInput value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'All' | Priority)} className="w-full sm:w-36 hidden md:block">
                {(['All', 'Urgent', 'High', 'Normal', 'Low'] as const).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Priority' : `${v} Priority`}</option>)}
              </SelectInput>
              <SelectInput value={topic} onChange={(e) => setTopic(e.target.value as Topic)} className="w-full sm:w-44 hidden lg:block">
                {(['All', 'General Question', 'Membership', 'Events', 'Publications', 'Press / Media', 'Partnership'] as Topic[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Topics' : v}</option>)}
              </SelectInput>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-sm text-ink-muted hover:bg-forum-50">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-2.5">
          {filtered.map((i) => {
            const isOpen = openId === i.id;
            const historyLength = i.statusHistory.length;
            const hasPrivate = i.internalNotes.some((n) => n.private);
            return (
              <div key={i.id} className={`rounded-xl border border-paper-border transition-all ${isOpen ? 'ring-2 ring-forum-600/10 bg-forum-50/20' : ''}`}>
                <button onClick={() => setOpenId(isOpen ? null : i.id)} className="w-full text-left p-4 flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      i.status === 'Spam' ? 'bg-danger-600/40 text-danger-900' : 'bg-gradient-to-br from-forum-600 to-slateteal-500'
                    }`}>
                      {i.status === 'Spam' ? <AlertCircle className="h-4 w-4" /> : i.name.split(' ').slice(-1).map((n) => n[0]).join('')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-forum-900 truncate">{i.name}</p>
                        <code className="font-mono text-[10px] text-ink-subtle bg-paper border border-paper-border px-1.5 py-0.5 rounded uppercase tracking-wider">{i.id}</code>
                        <Badge variant={statusVariant[i.status]} className="!py-0">{i.status}</Badge>
                        <Badge variant={PRIORITY_VARIANT[i.priority]} className="!py-0 gap-1">
                          <Flag className="h-2.5 w-2.5" />{i.priority}
                        </Badge>
                        <Badge variant="info" className="!py-0">{i.topic}</Badge>
                        {i.replies > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-ink-subtle">
                            <MessageSquare className="h-3 w-3" />
                            {i.replies} replies
                          </span>
                        )}
                        {hasPrivate && <Badge variant="warning" className="!text-[10px] !py-0 gap-1"><ShieldCheck className="h-2.5 w-2.5" />Internal</Badge>}
                      </div>
                      <p className="text-xs text-ink-muted mt-0.5 truncate">{i.subject}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{i.email}</span>
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{i.organization}</span>
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Received {i.receivedAt} · last activity {i.lastActivity}</span>
                        {i.attachmentCount > 0 && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />{i.attachmentCount} attachment{i.attachmentCount > 1 ? 's' : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex md:flex-col md:items-end items-center justify-between md:justify-center gap-2 shrink-0">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-ink-subtle" /> : <ChevronRight className="h-4 w-4 text-ink-subtle" />}
                  </div>
                </button>
                {isOpen && open && (
                  <div className="border-t border-paper-border bg-paper/30 divide-y divide-paper-border">
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="grid sm:grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-ink-muted"><User className="h-3.5 w-3.5" />From: <span className="font-medium text-ink ml-1">{i.name} — {i.country}</span></div>
                        <div className="flex items-center gap-1.5 text-ink-muted"><Building2 className="h-3.5 w-3.5" />Org: <span className="font-medium text-ink ml-1">{i.organization}</span></div>
                        {i.phone && <div className="flex items-center gap-1.5 text-ink-muted"><Phone className="h-3.5 w-3.5" />Phone: <span className="font-medium text-ink ml-1">{i.phone}</span></div>}
                      </div>

                      <div className="grid gap-4 md:grid-cols-4">
                        <Card className="md:col-span-4 lg:col-span-3 border-paper-border bg-paper-raised">
                          <CardHeader className="flex flex-row items-center justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Inbound Message</p>
                              <Badge variant="default" className="!text-[10px] !py-0">Requires reply within 24h</Badge>
                            </div>
                            <div className="flex gap-1.5">
                              {i.assignee && <Badge variant="warning">Assigned to: {i.assignee}</Badge>}
                              <Badge variant="brass" className="!text-[10px] !py-0 gap-1"><Flag className="h-2.5 w-2.5" />{i.priority}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{i.message}</p>
                          </CardContent>
                        </Card>

                        <Card className="md:col-span-4 lg:col-span-1 border-paper-border bg-forum-50/30">
                          <CardHeader>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Quick Triage</h4>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            <div>
                              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Priority</label>
                              <div className="flex items-center gap-2 mt-1">
                                <SelectInput value={priorityTarget[i.id] ?? i.priority} onChange={(e) => setPriorityTarget((d) => ({ ...d, [i.id]: e.target.value as Priority }))}>
                                  {(['Urgent', 'High', 'Normal', 'Low'] as Priority[]).map((p) => <option key={p}>{p}</option>)}
                                </SelectInput>
                                <Button variant="outline" size="sm" onClick={() => changePriority(i.id)} disabled={(priorityTarget[i.id] ?? i.priority) === i.priority}>
                                  {saved === `prio-${i.id}` ? <><Check className="h-3.5 w-3.5" />Set</> : <><Save className="h-3.5 w-3.5" />Set</>}
                                </Button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Assign Team</label>
                              <div className="flex items-center gap-2 mt-1">
                                <SelectInput value={assignTarget[i.id] ?? i.assignee ?? 'Unassigned'} onChange={(e) => setAssignTarget((d) => ({ ...d, [i.id]: e.target.value }))}>
                                  {ASSIGNEES.map((a) => <option key={a}>{a}</option>)}
                                </SelectInput>
                                <Button variant="outline" size="sm" onClick={() => doAssign(i.id)}>
                                  {saved === `assign-${i.id}` ? <><Check className="h-3.5 w-3.5" />Assign</> : <><Users className="h-3.5 w-3.5" />Assign</>}
                                </Button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Status</label>
                              <div className="flex items-center gap-2 mt-1">
                                <SelectInput value={statusTarget[i.id] ?? i.status} onChange={(e) => setStatusTarget((d) => ({ ...d, [i.id]: e.target.value as Exclude<Status, 'All'> }))}>
                                  {(['New', 'Assigned', 'Responded', 'Closed', 'Spam'] as const).map((s) => <option key={s}>{s}</option>)}
                                </SelectInput>
                                <Button variant="outline" size="sm" onClick={() => setShowStatusModal(i.id)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />Change
                                </Button>
                              </div>
                              <p className="text-[10px] text-ink-subtle mt-1 inline-flex items-center gap-1"><HistoryIcon className="h-2.5 w-2.5" />{historyLength} status change{historyLength === 1 ? '' : 's'} logged</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {i.replyThread.length > 0 && (
                        <Card>
                          <CardHeader>
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-2">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Conversation ({i.replyThread.length})
                            </h4>
                          </CardHeader>
                          <CardContent className="pt-0 space-y-3">
                            {i.replyThread.map((m) => (
                              <div key={m.id} className={`rounded-xl border p-3.5 ${m.authorType === 'admin' ? 'bg-forum-50/40 border-forum-100' : 'bg-paper-raised border-paper-border'}`}>
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <span className="text-xs font-semibold text-forum-900 flex items-center gap-1">{m.authorType === 'admin' ? <ShieldCheck className="h-3 w-3 text-forum-600" /> : <User className="h-3 w-3 text-ink-subtle" />} {m.author}</span>
                                  <Badge variant={m.authorType === 'admin' ? 'info' : 'default'} className="!text-[10px] !py-0">{m.authorType === 'admin' ? 'Admin Reply' : 'Inquirer Reply'}</Badge>
                                  <span className="text-[10px] text-ink-subtle inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{m.at}</span>
                                </div>
                                <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{m.text}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}

                      <Card className="border-forum-600/30 bg-gradient-to-br from-forum-50 to-brass-50/40">
                        <CardHeader>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-2">
                            <Send className="h-3.5 w-3.5" />
                            Reply from CRO Office
                          </h4>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          <TextArea rows={4} value={replyDraft[i.id] ?? ''} onChange={(e) => setReplyDraft((d) => ({ ...d, [i.id]: e.target.value }))}
                            label="Compose reply (Markdown supported)"
                            placeholder="Type your response. Acknowledge within 1 working day; formal answer within 5 days per SOP."
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Checkbox id={`attach-${i.id}`} name={`attach-${i.id}`} label="Include CRO signature and SOP footer" defaultChecked />
                            <Checkbox id={`cc-${i.id}`} name={`cc-${i.id}`} label={`CC assignee${i.assignee ? ` (${i.assignee})` : ''}`} defaultChecked />
                            <Checkbox id={`read-${i.id}`} name={`read-${i.id}`} label="Request read receipt" />
                          </div>
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
                            <div className="flex flex-wrap gap-2">
                              {i.status !== 'Spam' && (
                                <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setConfirmSpam(i.id)}>
                                  <Ban className="h-3.5 w-3.5" />Mark Spam
                                </Button>
                              )}
                              {i.status !== 'Closed' && i.status !== 'Spam' && (
                                <Button variant="outline" size="sm" onClick={() => setConfirmClose(i.id)}>
                                  <CheckCircle2 className="h-3.5 w-3.5" />Close Inquiry
                                </Button>
                              )}
                              <Button variant="outline" size="sm">
                                <FileText className="h-3.5 w-3.5" />Attach Template
                              </Button>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => setReplyDraft((d) => ({ ...d, [i.id]: '' }))}>Clear</Button>
                              <Button variant="outline" size="sm">
                                <Save className="h-3.5 w-3.5" />Save Draft
                              </Button>
                              <Button variant="primary" size="sm" disabled={!(replyDraft[i.id] ?? '').trim()} onClick={() => sendReply(i.id)}>
                                {saved === `reply-${i.id}` ? <><Check className="h-3.5 w-3.5" />Sent</> : <><Send className="h-3.5 w-3.5" />Send Reply</>}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="p-4 sm:p-5 space-y-4">
                      <Card>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-brass-700" />
                            Internal Notes &amp; Working Commentary
                          </h4>
                          <Badge variant="warning" className="!text-[10px] !py-0">Not visible to the inquirer</Badge>
                        </CardHeader>
                        <CardContent className="pt-0 space-y-3">
                          {i.internalNotes.length > 0 ? (
                            <div className="space-y-2.5">
                              {i.internalNotes.map((n) => (
                                <div key={n.id} className={`rounded-xl border p-3 ${n.private ? 'bg-warning-50/70 border-warning-600/20' : 'bg-forum-50/40 border-forum-100'}`}>
                                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                    <span className="text-xs font-semibold text-forum-900">{n.author}</span>
                                    <Badge variant={n.private ? 'warning' : 'info'} className="!text-[10px] !py-0 gap-1">
                                      {n.private ? <><Eye className="h-2.5 w-2.5" />Admin-only</> : <><Users className="h-2.5 w-2.5" />Shared (team)</>}
                                    </Badge>
                                    <span className="text-[10px] text-ink-subtle inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{n.at}</span>
                                  </div>
                                  <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{n.text}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-lg border border-dashed border-paper-border bg-paper/60 p-6 text-center">
                              <p className="text-sm text-ink-subtle">No internal notes yet. Capture working commentary, SOP references, or escalations here.</p>
                            </div>
                          )}
                          <div className="rounded-xl border border-paper-border bg-paper p-3.5 space-y-3">
                            <TextArea rows={3} label="Add internal note" value={noteDraft[i.id] ?? ''} onChange={(e) => setNoteDraft((d) => ({ ...d, [i.id]: e.target.value }))} placeholder="e.g., Per §3.2 the Independent Scholar pathway applies — recommend Membership queue confirm." />
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <Checkbox id={`priv-${i.id}`} name={`priv-${i.id}`} label="Mark as admin-only (private; not visible to other CRO administrators)" checked={!!notePrivate[i.id]} onChange={(e) => setNotePrivate((d) => ({ ...d, [i.id]: (e.target as HTMLInputElement).checked }))} />
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => { setNoteDraft((d) => ({ ...d, [i.id]: '' })); setNotePrivate((d) => ({ ...d, [i.id]: false })); }}>Clear</Button>
                                <Button variant="primary" size="sm" disabled={!(noteDraft[i.id] ?? '').trim()} onClick={() => addNote(i.id)}>
                                  {saved === `note-${i.id}` ? <><Check className="h-3.5 w-3.5" />Saved</> : <><Plus className="h-3.5 w-3.5" />Add Note</>}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-2">
                            <HistoryIcon className="h-3.5 w-3.5 text-slateteal-500" /> Status &amp; Assignment History
                          </h4>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-3.5">
                            {i.statusHistory.map((h, idx) => {
                              const color = h.to === 'Spam' ? 'bg-danger-600' : h.to === 'Closed' ? 'bg-ink' : h.to === 'Responded' ? 'bg-brass-600' : h.to === 'Assigned' ? 'bg-warning-600' : 'bg-slateteal-600';
                              return (
                                <li key={idx} className="relative">
                                  <span className={`absolute -left-[27px] top-0.5 h-5 w-5 rounded-full ring-4 ring-paper-raised flex items-center justify-center text-white ${color}`}>
                                    {h.to === 'Closed' || h.to === 'Spam' ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                  </span>
                                  <div className="flex flex-wrap items-baseline gap-2">
                                    <p className="text-sm font-medium text-forum-900">
                                      {h.from === h.to ? 'Created' : `${h.from} → ${h.to}`}
                                    </p>
                                    <span className="text-[11px] text-ink-subtle">by {h.by}</span>
                                    <span className="text-[10px] text-ink-subtle inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{h.at}</span>
                                  </div>
                                  {h.reason && <p className="text-xs text-ink-muted mt-1">Reason: <span className="font-medium">{h.reason}</span></p>}
                                </li>
                              );
                            })}
                          </ol>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-10 text-center">
              <Mail className="h-8 w-8 mx-auto text-paper-border mb-2" />
              <p className="text-sm text-ink-subtle">No inquiries match the current filters.</p>
              <Link to="/admin/inquiries" onClick={() => { setStatus('All'); setTopic('All'); setPriorityFilter('All'); setSearch(''); }} className="text-xs text-forum-700 font-semibold mt-2 inline-flex items-center gap-1">
                Clear filters <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Change Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-forum-50 text-forum-700 flex items-center justify-center"><CheckCircle2 className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Change Inquiry Status</h3>
                  <p className="text-xs text-ink-subtle mt-0.5">Reference {showStatusModal}</p>
                </div>
              </div>
              <button onClick={() => setShowStatusModal(null)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <SelectInput label="New status" value={statusTarget[showStatusModal] ?? inquiries.find((x) => x.id === showStatusModal)?.status ?? 'New'} onChange={(e) => setStatusTarget((d) => ({ ...d, [showStatusModal]: e.target.value as Exclude<Status, 'All'> }))}>
                {(['New', 'Assigned', 'Responded', 'Closed', 'Spam'] as const).map((s) => <option key={s}>{s}</option>)}
              </SelectInput>
              <TextArea rows={3} label="Reason / audit note (optional)" value={statusReason[showStatusModal] ?? ''} onChange={(e) => setStatusReason((d) => ({ ...d, [showStatusModal]: e.target.value }))}
                placeholder="This is logged in the status history. Include SOP references, rationale, etc."
              />
              {(((statusTarget[showStatusModal] as string) === 'Spam') || ((statusTarget[showStatusModal] as string) === 'Closed')) && (
                <div className="rounded-lg border border-warning-600/30 bg-warning-50 p-3.5 text-xs text-warning-700 inline-flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Irreversible: setting to <span className="font-semibold uppercase">{statusTarget[showStatusModal]}</span> is recorded in the audit log and will suppress further auto-reminders for this inquiry.</span>
                </div>
              )}
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setShowStatusModal(null)}>Cancel</Button>
              <Button variant="primary" size="sm" onClick={() => applyStatusChange(showStatusModal)}>
                <CheckCircle2 className="h-4 w-4" />Confirm Change
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Spam Confirm */}
      {confirmSpam && (
        <SimpleConfirm
          title="Mark this inquiry as Spam?"
          subtitle={confirmSpam}
          description="The sender email/domain will be added to the filter list and this inquiry is permanently marked. No reply is sent."
          confirmText="Confirm — Mark Spam"
          danger
          onCancel={() => setConfirmSpam(null)}
          onConfirm={() => doMarkSpam(confirmSpam)}
        />
      )}
      {/* Close Confirm */}
      {confirmClose && (
        <SimpleConfirm
          title="Close this inquiry?"
          subtitle={confirmClose}
          description="This closes the ticket and silences further reminders. You can still reopen later via the status change dialog."
          confirmText="Close Inquiry"
          onCancel={() => setConfirmClose(null)}
          onConfirm={() => doClose(confirmClose)}
        />
      )}
    </div>
  );
}

function SimpleConfirm({
  title, subtitle, description, confirmText, onCancel, onConfirm, danger = false,
}: { title: string; subtitle?: string; description: string; confirmText: string; onCancel: () => void; onConfirm: () => void; danger?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
        <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${danger ? 'bg-danger-100 text-danger-600' : 'bg-warning-100 text-warning-600'}`}>
              {danger ? <Trash2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900">{title}</h3>
              {subtitle && <p className="text-xs text-ink-subtle mt-0.5 font-mono">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-ink-muted leading-relaxed">{description}</p>
        </div>
        <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" size="sm" className={danger ? 'bg-danger-600 hover:bg-danger-600/90' : ''} onClick={onConfirm}>
            <CheckCircle2 className="h-4 w-4" />{confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
