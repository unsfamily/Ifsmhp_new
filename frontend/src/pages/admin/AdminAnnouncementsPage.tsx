import { useMemo, useState } from 'react';
import {
  Megaphone,
  Search,
  Eye,
  Clock,
  Send,
  Plus,
  Users,
  X,
  Save,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Bell,
  CalendarClock,
  Hash,
  AlertCircle,
  AlertTriangle,
  Check,
  Sparkles,
  History,
  FileText,
  Ban,
  Trash2,
  ShieldCheck,
  Copy,
  ArrowRight,
  Mail as MailIcon,
  Smartphone,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

type Audience = 'All' | 'All Members' | 'Members Only' | 'Scientists Track' | 'Professionals Track' | 'Pending Applicants' | 'Newsletter (Public)';
type Status = 'All' | 'Draft' | 'Scheduled' | 'Sending' | 'Sent' | 'Cancelled';
type Channel = 'Email + In-App' | 'Email' | 'In-App Only';
type ScheduleMode = 'now' | 'scheduled' | 'draft';

interface Announcement {
  id: string;
  subject: string;
  preview: string;
  audience: Exclude<Audience, 'All'>;
  recipients: string;
  sentAt?: string;
  scheduledFor?: string;
  status: Exclude<Status, 'All'>;
  channel: Channel;
  author: string;
  openRate?: string;
  linkClicks?: number;
}

interface ComposerState {
  subject: string;
  body: string;
  audience: Exclude<Audience, 'All'>;
  channel: Channel;
  scheduleMode: ScheduleMode;
  scheduledAt: string;
  senderAsCRO: boolean;
  appendUnsubscribe: boolean;
  sendSABPreview: boolean;
}

const EMPTY_COMPOSER: ComposerState = {
  subject: '', body: '', audience: 'All Members', channel: 'Email + In-App',
  scheduleMode: 'draft', scheduledAt: '', senderAsCRO: true, appendUnsubscribe: true, sendSABPreview: false,
};

const announcements: Announcement[] = [
  { id: 'ann-20', subject: '2026 Annual Symposium — Early-bird registration opens August 23', preview: 'Dear IFSMHP community — Registration opens Sunday, August 23rd. The first 100 registrants receive free admission to the Sunday SAB meeting and a €50 gift code toward the CRO grant submission…', audience: 'All Members', recipients: '277 members + 1,204 newsletter', status: 'Scheduled', scheduledFor: 'Aug 23, 2026 · 08:00 UTC', channel: 'Email + In-App', author: 'Communications' },
  { id: 'ann-19', subject: 'Welcome aboard — 14 new members approved this week', preview: 'Warm welcome to the 14 researchers and clinicians approved between August 14 and 20. Member IDs and welcome messages have been sent. Check the Members page for details.', audience: 'All Members', recipients: '277 members', sentAt: 'Aug 21, 2026 · 06:00 UTC', status: 'Sent', channel: 'In-App Only', author: 'CRO Office', openRate: '94%', linkClicks: 148 },
  { id: 'ann-18', subject: 'Publication SLA update — average review time 6.2 days', preview: 'The review queue is running well below the 10-day SLA target for a third consecutive month. Thank you to our SAB reviewers — the next CRO roadmap discusses reducing this further to 5 days by year-end.', audience: 'All Members', recipients: '277 members', sentAt: 'Aug 19, 2026 · 10:00 UTC', status: 'Sent', channel: 'Email + In-App', author: 'CRO Office', openRate: '86%', linkClicks: 312 },
  { id: 'ann-17', subject: 'Important — Credential document viewer downtime 30 min Aug 20', preview: 'Scheduled maintenance window Saturday, August 20, 02:30 UTC. Credential viewing and document downloads will be unavailable for approximately 30 minutes during a storage endpoint upgrade.', audience: 'All Members', recipients: '277 members', sentAt: 'Aug 18, 2026 · 14:30 UTC', status: 'Sent', channel: 'Email', author: 'System Operations', openRate: '72%', linkClicks: 44 },
  { id: 'ann-16', subject: 'Reminder: Public Lecture — Digital Mental Health Evidence', preview: 'The public lecture on digital mental health evidence base is November 4th at 18:00 UTC. Registration is now open. Speakers include Prof. Lindberg and CRO Whitfield.', audience: 'Newsletter (Public)', recipients: '1,204 newsletter subscribers', status: 'Draft', channel: 'Email', author: 'Communications' },
  { id: 'ann-15', subject: 'Moral Support Program — new peer group starting', preview: 'A new quarterly peer support group is forming for early-career members. Contact the Wellness Committee to join.', audience: 'Members Only', recipients: '277', sentAt: 'Aug 10, 2026 · 12:00 UTC', status: 'Sent', channel: 'In-App Only', author: 'Wellness', openRate: '62%' },
];

const statusVariant: Record<Exclude<Status, 'All'>, 'warning' | 'brass' | 'info' | 'success' | 'danger' | 'default'> = {
  Draft: 'warning', Scheduled: 'brass', Sending: 'info', Sent: 'success', Cancelled: 'danger',
};

const AUDIENCE_OPTS: Exclude<Audience, 'All'>[] = ['All Members', 'Members Only', 'Scientists Track', 'Professionals Track', 'Pending Applicants', 'Newsletter (Public)'];
const CHANNEL_OPTS: Channel[] = ['Email + In-App', 'Email', 'In-App Only'];

interface Errors {
  subject?: string;
  body?: string;
  audience?: string;
  scheduledAt?: string;
}

function validateComposer(s: ComposerState): Errors {
  const e: Errors = {};
  if (!s.subject.trim()) e.subject = 'Subject is required for all broadcasts.';
  else if (s.subject.trim().length > 80 && s.channel !== 'In-App Only') e.subject = 'Subject exceeds the 80-character limit recommended for email deliverability.';
  if (!s.body.trim()) e.body = 'Message body is required.';
  else if (s.body.trim().length < 20) e.body = 'Message body is too short — add at least 20 characters.';
  if (!s.audience) e.audience = 'Select an audience for this announcement.';
  if (s.scheduleMode === 'scheduled' && !s.scheduledAt) e.scheduledAt = 'Pick a date/time to schedule this broadcast.';
  if (s.audience === 'Newsletter (Public)' && !s.appendUnsubscribe) e.audience = 'Public newsletter emails require an unsubscribe footer by law.';
  return e;
}

function previewLine(p: string) {
  return p.length > 160 ? p.slice(0, 160) + '…' : p;
}

export default function AdminAnnouncementsPage() {
  const [tab, setTab] = useState<Status>('All');
  const [audienceFilter, setAudienceFilter] = useState<Audience>('All');
  const [search, setSearch] = useState('');
  const [showComposer, setShowComposer] = useState(false);
  const [composer, setComposer] = useState<ComposerState>(EMPTY_COMPOSER);
  const [touched, setTouched] = useState<Partial<Record<keyof ComposerState, boolean>>>({});
  const [result, setResult] = useState<null | { kind: 'saved' | 'scheduled' | 'sent' | 'preview-sab'; id?: string; at?: string }>(null);
  const [confirmCancelSchedule, setConfirmCancelSchedule] = useState<string | null>(null);

  const errors = useMemo(() => validateComposer(composer), [composer]);
  const isValid = Object.keys(errors).length === 0;
  const err = (k: keyof Errors) => touched[k as keyof ComposerState] || Object.keys(touched).length > 0 ? errors[k] : undefined;

  const tabCounts = {
    All: announcements.length,
    Draft: announcements.filter((a) => a.status === 'Draft').length,
    Scheduled: announcements.filter((a) => a.status === 'Scheduled').length,
    Sending: announcements.filter((a) => a.status === 'Sending').length,
    Sent: announcements.filter((a) => a.status === 'Sent').length,
    Cancelled: announcements.filter((a) => a.status === 'Cancelled').length,
  };

  const filtered = announcements.filter((a) => {
    if (tab !== 'All' && a.status !== tab) return false;
    if (audienceFilter !== 'All' && a.audience !== audienceFilter) return false;
    if (search && !(a.subject.toLowerCase().includes(search.toLowerCase()) || a.preview.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  });

  const touchAll = () => {
    const allTouched: Record<keyof ComposerState, boolean> = {
      subject: true, body: true, audience: true, channel: true,
      scheduleMode: true, scheduledAt: true, senderAsCRO: true, appendUnsubscribe: true, sendSABPreview: true,
    };
    setTouched(allTouched);
  };

  const update = <K extends keyof ComposerState>(k: K, v: ComposerState[K]) => {
    setComposer((c) => ({ ...c, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const estimatedRecipients = (() => {
    switch (composer.audience) {
      case 'All Members': return '~ 277 members (+ 1,204 newsletter if public)';
      case 'Members Only': return '~ 277 members';
      case 'Scientists Track': return '~ 94 members';
      case 'Professionals Track': return '~ 71 members';
      case 'Pending Applicants': return '~ 6 pending';
      case 'Newsletter (Public)': return '~ 1,204 public subscribers';
      default: return '—';
    }
  })();

  const audienceCountEstimate = (a: Exclude<Audience, 'All'>) => {
    switch (a) {
      case 'All Members': return 277;
      case 'Members Only': return 277;
      case 'Scientists Track': return 94;
      case 'Professionals Track': return 71;
      case 'Pending Applicants': return 6;
      case 'Newsletter (Public)': return 1204;
    }
  };

  const saveDraft = () => {
    if (!composer.subject.trim() && !composer.body.trim()) return;
    setResult({ kind: 'saved', id: `ann-draft-${Date.now()}`, at: new Date().toLocaleString() });
    setTimeout(() => setResult(null), 3500);
  };

  const submit = (kind: 'send-now' | 'schedule' | 'sab-preview') => {
    touchAll();
    if (kind === 'sab-preview') {
      setResult({ kind: 'preview-sab', at: new Date().toLocaleString() });
      setTimeout(() => setResult(null), 3500);
      return;
    }
    if (!isValid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (kind === 'send-now') setResult({ kind: 'sent', id: `ann-${Date.now()}`, at: new Date().toLocaleString() });
    if (kind === 'schedule') setResult({ kind: 'scheduled', id: `ann-${Date.now()}`, at: composer.scheduledAt });
    setTimeout(() => { setResult(null); setShowComposer(false); setComposer(EMPTY_COMPOSER); setTouched({}); }, 2800);
  };

  const openDraft = (a: Announcement) => {
    setComposer({
      subject: a.subject,
      body: a.preview,
      audience: a.audience,
      channel: a.channel,
      scheduleMode: a.status === 'Scheduled' ? 'scheduled' : 'draft',
      scheduledAt: a.scheduledFor ?? '',
      senderAsCRO: a.author === 'CRO Office',
      appendUnsubscribe: a.audience === 'Newsletter (Public)',
      sendSABPreview: false,
    });
    setShowComposer(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Announcements &amp; Platform Notifications</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Draft, schedule, and send emails and in-app notifications to members, applicants, and the public newsletter. All broadcasts recorded in the audit log and require CRO signature.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link to="/admin/audit-log" className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-xs font-medium text-forum-700 hover:bg-forum-50">
            <History className="h-3.5 w-3.5" /> Broadcast audit trail
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Announcements', value: '147', icon: Megaphone, color: 'forum', note: '+ 3 in-flight today' },
          { label: 'Scheduled', value: tabCounts.Scheduled.toString(), icon: CalendarClock, color: 'brass', note: `${tabCounts.Draft} drafts awaiting` },
          { label: 'Avg. Open Rate', value: '78%', icon: Eye, color: 'slateteal', note: 'Email broadcasts last 30 days' },
          { label: 'This Month Sent', value: tabCounts.Sent.toString(), icon: CheckCircle2, color: 'forum', note: 'Delivered ~11,000 messages' },
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

      {result && (
        <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 ${
          result.kind === 'sent' ? 'border-success-600/30 bg-success-50' :
          result.kind === 'scheduled' ? 'border-brass-500/40 bg-brass-50' :
          result.kind === 'preview-sab' ? 'border-forum-600/30 bg-forum-50' :
          'border-paper-border bg-paper'
        }`}>
          <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${
            result.kind === 'sent' ? 'text-success-600' :
            result.kind === 'scheduled' ? 'text-brass-700' :
            'text-forum-700'
          }`} />
          <div className="text-sm">
            {result.kind === 'sent' && (
              <>
                <p className="font-semibold text-success-800">Broadcast sent</p>
                <p className="text-xs text-success-700/90 mt-0.5">Reference {result.id} · queued immediately. Audience {composer.audience} · channel {composer.channel}. Audit entry created.</p>
              </>
            )}
            {result.kind === 'scheduled' && (
              <>
                <p className="font-semibold text-brass-800">Broadcast scheduled</p>
                <p className="text-xs text-brass-700/90 mt-0.5">Reference {result.id} · will send at {result.at || composer.scheduledAt}.</p>
              </>
            )}
            {result.kind === 'saved' && (
              <>
                <p className="font-semibold text-ink">Draft saved</p>
                <p className="text-xs text-ink-subtle mt-0.5">Reference {result.id} · edit any time before sending. Saved at {result.at}.</p>
              </>
            )}
            {result.kind === 'preview-sab' && (
              <>
                <p className="font-semibold text-forum-900">SAB preview dispatched</p>
                <p className="text-xs text-ink-muted mt-0.5">A preview has been sent to Scientific Advisory Board members (current sign-off list) at {result.at}. Proceed to broadcast once you have confirmations.</p>
              </>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 rounded-lg bg-forum-50 p-1 overflow-x-auto">
              {(['All', 'Draft', 'Scheduled', 'Sent'] as Status[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap ${tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'}`}>
                  {t} ({tabCounts[t]})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search announcements…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={audienceFilter} onChange={(e) => setAudienceFilter(e.target.value as Audience)} className="w-full sm:w-44 hidden md:block">
                {(['All', ...AUDIENCE_OPTS] as Audience[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Audiences' : v}</option>)}
              </SelectInput>
              <Button variant="primary" onClick={() => setShowComposer((v) => !v)}>
                <Plus className="h-4 w-4" />
                {showComposer ? 'Close Composer' : 'New Announcement'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          {showComposer && (
            <div className="mb-3 rounded-xl border border-forum-600/30 bg-gradient-to-br from-forum-50 to-brass-100/60 p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-lg bg-brass-100 text-brass-700 flex items-center justify-center">
                    <Megaphone className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <h4 className="font-display text-xl font-semibold text-forum-900">Announcement Composer</h4>
                    <p className="text-xs text-ink-subtle mt-0.5">Target up to <span className="font-semibold text-forum-900">{audienceCountEstimate(composer.audience).toLocaleString()} recipients</span> via {composer.channel.toLowerCase()}.</p>
                  </div>
                </div>
                <button onClick={() => { setShowComposer(false); setTouched({}); }} className="p-1.5 rounded-md text-ink-muted hover:bg-paper-raised self-start" aria-label="Close composer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {(Object.keys(touched).length > 0 && !isValid) && (
                <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-3.5 mb-5">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-4.5 w-4.5 text-danger-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-danger-800">Please correct {Object.keys(errors).length} item{Object.keys(errors).length > 1 ? 's' : ''} before sending:</p>
                      <ul className="mt-1 ml-4 list-disc text-xs text-danger-700 space-y-0.5">
                        {Object.values(errors).filter(Boolean).map((msg, i) => <li key={i}>{msg}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3 space-y-4">
                  <TextInput
                    label={<>Subject <span className="text-danger-600">*</span></>}
                    placeholder="Clear, specific — 55 chars or fewer recommended for email."
                    value={composer.subject}
                    onChange={(e) => update('subject', e.target.value)}
                    error={err('subject')}
                    icon={<FileText className="h-4 w-4 text-ink-subtle" />}
                    hint={`${composer.subject.length}/80 recommended`}
                  />
                  <TextArea
                    label={<>Message Body <span className="text-danger-600">*</span> <span className="text-ink-muted font-normal">(Markdown supported)</span></>}
                    rows={10}
                    placeholder="First 160 characters used as the email preview. Be specific — include dates, deadlines, and clear calls to action."
                    value={composer.body}
                    onChange={(e) => update('body', e.target.value)}
                    error={err('body')}
                    hint={`${composer.body.length} chars · preview: "${previewLine(composer.body || '—')}"`}
                  />
                  <div className="rounded-lg border border-paper-border bg-paper-raised p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-brass-700" /> Sender Options</p>
                    <div className="grid gap-3 sm:grid-cols-1">
                      <Checkbox id="from-cro" name="from-cro" label="Sign from CRO Office (otherwise sent by Communications team)." checked={composer.senderAsCRO} onChange={(e) => update('senderAsCRO', (e.target as HTMLInputElement).checked)} />
                      <Checkbox id="append-unsub" name="append-unsub" label="Include unsubscribe footer (required for Newsletter — Public)." checked={composer.appendUnsubscribe} onChange={(e) => update('appendUnsubscribe', (e.target as HTMLInputElement).checked)} />
                      <Checkbox id="sab-approval" name="sab-approval" label="Send SAB preview first — wait for sign-off before scheduling full broadcast." checked={composer.sendSABPreview} onChange={(e) => update('sendSABPreview', (e.target as HTMLInputElement).checked)} />
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-paper-border bg-paper">
                    <CardHeader className="pb-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Delivery &amp; Audience</p>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-4">
                      <SelectInput label={<>Audience <span className="text-danger-600">*</span></>} value={composer.audience} onChange={(e) => update('audience', e.target.value as Exclude<Audience, 'All'>)} error={err('audience')}>
                        {AUDIENCE_OPTS.map((a) => <option key={a} value={a}>{a} (est. {audienceCountEstimate(a).toLocaleString()})</option>)}
                      </SelectInput>
                      <SelectInput label="Delivery Channel" value={composer.channel} onChange={(e) => update('channel', e.target.value as Channel)}>
                        {CHANNEL_OPTS.map((c) => <option key={c}>{c}</option>)}
                      </SelectInput>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-1.5 block">Send Timing</label>
                        <div className="grid gap-2">
                          <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${composer.scheduleMode === 'draft' ? 'bg-forum-50 border-forum-600/30 ring-1 ring-forum-100' : 'border-paper-border hover:bg-forum-50/40'}`}>
                            <input type="radio" className="mt-0.5 accent-forum-600" checked={composer.scheduleMode === 'draft'} onChange={() => update('scheduleMode', 'draft')} />
                            <div>
                              <p className="text-sm font-medium text-forum-900 flex items-center gap-1.5"><Save className="h-3.5 w-3.5" />Save as Draft</p>
                              <p className="text-xs text-ink-subtle">Do not send. Revisit and schedule later.</p>
                            </div>
                          </label>
                          <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${composer.scheduleMode === 'now' ? 'bg-forum-50 border-forum-600/30 ring-1 ring-forum-100' : 'border-paper-border hover:bg-forum-50/40'}`}>
                            <input type="radio" className="mt-0.5 accent-forum-600" checked={composer.scheduleMode === 'now'} onChange={() => update('scheduleMode', 'now')} />
                            <div>
                              <p className="text-sm font-medium text-forum-900 flex items-center gap-1.5"><Send className="h-3.5 w-3.5" />Send Immediately</p>
                              <p className="text-xs text-ink-subtle">Queues broadcast on Save. Cannot be recalled from inboxes.</p>
                            </div>
                          </label>
                          <label className={`flex items-start gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${composer.scheduleMode === 'scheduled' ? 'bg-forum-50 border-forum-600/30 ring-1 ring-forum-100' : 'border-paper-border hover:bg-forum-50/40'}`}>
                            <input type="radio" className="mt-0.5 accent-forum-600" checked={composer.scheduleMode === 'scheduled'} onChange={() => update('scheduleMode', 'scheduled')} />
                            <div>
                              <p className="text-sm font-medium text-forum-900 flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Schedule</p>
                              <p className="text-xs text-ink-subtle">Queue for a specific date and time.</p>
                              {composer.scheduleMode === 'scheduled' && (
                                <div className="mt-2">
                                  <TextInput type="datetime-local" value={composer.scheduledAt} onChange={(e) => update('scheduledAt', e.target.value)} error={err('scheduledAt')} />
                                </div>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-brass-500/30 bg-brass-50/40">
                    <CardHeader>
                      <p className="text-xs font-semibold uppercase tracking-wider text-brass-800">Composer Checklist</p>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1.5 text-xs">
                      <div className="flex justify-between items-center gap-2"><span>Subject filled</span>{composer.subject.trim() ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
                      <div className="flex justify-between items-center gap-2"><span>Body ≥ 20 chars</span>{composer.body.trim().length >= 20 ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
                      <div className="flex justify-between items-center gap-2"><span>Audience selected</span>{composer.audience ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
                      <div className="flex justify-between items-center gap-2"><span>Public + unsubscribe footer</span>{composer.audience !== 'Newsletter (Public)' || composer.appendUnsubscribe ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
                      {composer.scheduleMode === 'scheduled' && (
                        <div className="flex justify-between items-center gap-2"><span>Schedule date set</span>{composer.scheduledAt ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
                      )}
                      <div className="flex justify-between items-center gap-2 pt-1 border-t border-brass-600/20 mt-1.5"><span className="font-semibold text-brass-800">Ready to send</span>{isValid ? <Badge variant="success" className="!py-0 gap-1"><CheckCircle2 className="h-2.5 w-2.5" />Valid</Badge> : <Badge variant="danger" className="!py-0 gap-1"><AlertTriangle className="h-2.5 w-2.5" />Fix errors</Badge>}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-paper-border">
                    <CardHeader><p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Estimated Recipients</p></CardHeader>
                    <CardContent className="pt-0 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-ink">
                        <Users className="h-3.5 w-3.5 text-forum-600" />Audience: <span className="font-semibold">{composer.audience}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        {composer.channel.includes('Email') ? <MailIcon className="h-3.5 w-3.5 text-forum-600" /> : <Smartphone className="h-3.5 w-3.5 text-forum-600" />}Channel: <span className="font-semibold">{composer.channel}</span>
                      </div>
                      <div className="flex items-center gap-2 text-ink">
                        <Bell className="h-3.5 w-3.5 text-forum-600" />Recipients: <span className="font-semibold">{estimatedRecipients}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:justify-end gap-2 pt-4 border-t border-forum-600/10">
                <Button variant="ghost" onClick={() => { setComposer(EMPTY_COMPOSER); setTouched({}); }}>
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
                <Button variant="ghost" onClick={() => { setShowComposer(false); setTouched({}); }}>Close</Button>
                <Button variant="outline" onClick={saveDraft}>
                  <Save className="h-4 w-4" />Save Draft
                </Button>
                <Button variant="outline" disabled={!composer.subject.trim() || !composer.body.trim()} onClick={() => submit('sab-preview')}>
                  <ShieldCheck className="h-4 w-4" />Send SAB Preview
                </Button>
                <Button
                  variant="primary"
                  disabled={!isValid || composer.scheduleMode === 'draft'}
                  onClick={() => submit(composer.scheduleMode === 'scheduled' ? 'schedule' : 'send-now')}
                >
                  {composer.scheduleMode === 'scheduled' ? <><CalendarClock className="h-4 w-4" />Schedule Broadcast</> : composer.scheduleMode === 'draft' ? <><Save className="h-4 w-4" />Draft Mode — save first</> : <><Send className="h-4 w-4" />Broadcast Now</>}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2.5">
            {filtered.map((a) => (
              <div key={a.id} className="rounded-xl border border-paper-border p-4 sm:p-5 hover:bg-forum-50/30 transition-colors">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`h-11 w-11 shrink-0 rounded-lg flex items-center justify-center ${
                      a.status === 'Scheduled' ? 'bg-brass-100 text-brass-700' :
                      a.status === 'Sent' ? 'bg-forum-50 text-forum-700' :
                      a.status === 'Draft' ? 'bg-warning-100 text-warning-600' :
                      'bg-paper text-ink-muted'
                    }`}>
                      {a.status === 'Scheduled' ? <CalendarClock className="h-5.5 w-5.5" /> : a.status === 'Sent' ? <Bell className="h-5.5 w-5.5" /> : <Megaphone className="h-5.5 w-5.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <p className="text-base font-semibold text-forum-900 truncate">{a.subject}</p>
                        <Badge variant={statusVariant[a.status]} className="!py-0">{a.status}</Badge>
                        <code className="font-mono text-[10px] text-ink-subtle bg-paper border border-paper-border px-1.5 py-0.5 rounded uppercase tracking-wider">{a.id}</code>
                      </div>
                      <p className="text-sm text-ink-muted line-clamp-2">{a.preview}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-subtle">
                        <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-forum-600" />Audience: <span className="font-medium text-ink">{a.audience}</span></span>
                        <span className="inline-flex items-center gap-1"><Hash className="h-3.5 w-3.5" />{a.recipients}</span>
                        <span className="inline-flex items-center gap-1">{a.channel.includes('Email') ? <MailIcon className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}{a.channel}</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {a.status === 'Scheduled' ? <>Sends {a.scheduledFor}</> : a.sentAt ? <>Sent {a.sentAt}</> : <>Last edited 2h ago</>}
                        </span>
                        <span className="inline-flex items-center gap-1">by {a.author}</span>
                        {a.openRate && <Badge variant="info" className="!text-[10px] !py-0">Open rate {a.openRate}</Badge>}
                        {typeof a.linkClicks === 'number' && <Badge variant="default" className="!text-[10px] !py-0">{a.linkClicks} link clicks</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap md:flex-col md:items-end gap-2 shrink-0">
                    {a.status === 'Draft' && (
                      <Button size="sm" variant="outline" className="justify-start" onClick={() => openDraft(a)}>
                        <Copy className="h-3.5 w-3.5" />
                        Edit in Composer
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="justify-start">
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    {a.status === 'Draft' && (
                      <Button size="sm" variant="primary" className="justify-start">
                        <Send className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                    )}
                    {a.status === 'Scheduled' && (
                      <Button size="sm" variant="outline" className="border-danger-600/30 text-danger-600 hover:bg-danger-100 justify-start" onClick={() => setConfirmCancelSchedule(a.id)}>
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel Scheduled
                      </Button>
                    )}
                    {a.status === 'Sent' && (
                      <Button as="link" to="/admin/reports" variant="outline" size="sm" className="justify-start">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Stats &amp; Engagement
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-10 text-center">
                <Bell className="h-8 w-8 mx-auto text-paper-border mb-2" />
                <p className="text-sm text-ink-subtle">No announcements match the current filters.</p>
                <button onClick={() => { setAudienceFilter('All'); setTab('All'); setSearch(''); }} className="text-xs text-forum-700 font-semibold mt-2 inline-flex items-center gap-1">
                  Clear filters <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {confirmCancelSchedule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Cancel this scheduled broadcast?</h3>
                  <p className="text-xs text-ink-subtle mt-0.5 font-mono">{confirmCancelSchedule}</p>
                </div>
              </div>
              <button onClick={() => setConfirmCancelSchedule(null)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 text-sm text-ink-muted">
              Cancelling will remove the scheduled job from the queue. The draft will be preserved so you can reschedule. Members will not be notified.
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setConfirmCancelSchedule(null)}>Keep scheduled</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" onClick={() => { setConfirmCancelSchedule(null); }}>
                <Ban className="h-4 w-4" />Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
