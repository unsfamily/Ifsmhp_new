import { useEffect, useState } from 'react';
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

import { announcementApi, announcementSchema, ANNOUNCEMENT_AUDIENCES as AUDIENCE_OPTS, ANNOUNCEMENT_CHANNELS as CHANNEL_OPTS, ANNOUNCEMENT_STATUSES, type Audience, type Status, type Channel, type Announcement } from '../../api/announcements';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAnnouncementComposer, composerInput } from '../../hooks/useAnnouncementComposer';
import AnnouncementDetail from '../../components/announcements/AnnouncementDetail';
import Pagination from '../../components/announcements/Pagination';
import { ExchangeModal } from '../../components/exchange/ExchangeDialog';

const statusVariant: Record<Exclude<Status, 'All'>, 'warning' | 'brass' | 'info' | 'success' | 'danger' | 'default'> = {
  Draft: 'warning', Scheduled: 'brass', Sending: 'info', Sent: 'success', Cancelled: 'danger', Partial: 'warning', Failed: 'danger', Suppressed: 'default',
};
const previewLine = (text: string) => text.length > 160 ? text.slice(0, 160) + '...' : text;
const dateLabel = (date: string | null, zone?: string) => date ? new Date(date).toLocaleString(undefined, { timeZone: zone, timeZoneName: 'short' }) : 'Not recorded';

export default function AdminAnnouncementsPage() {
  const [tab, setTab] = useState<Status>('All');
  const [audienceFilter, setAudienceFilter] = useState<Audience>('All');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmCancelSchedule, setConfirmCancelSchedule] = useState<Announcement | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Announcement | null>(null);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const listing = usePolledApiData(() => announcementApi.list({ page, limit, q: query, status: tab, audience: audienceFilter }), [page, limit, query, tab, audienceFilter], 30000);
  const options = usePolledApiData(announcementApi.options, [], 60000);
  const form = useAnnouncementComposer(listing.refresh);
  const { composer, showComposer, setShowComposer, errors, busy, update, openDraft } = form;
  const err = (key: string) => errors[key];
  const isValid = announcementSchema(composer.scheduleMode === 'scheduled' ? 'schedule' : 'send').safeParse(composerInput(composer)).success;
  const tabCounts = listing.data?.counts ?? Object.fromEntries(ANNOUNCEMENT_STATUSES.map(s => [s, 0])) as Record<Status, number>;
  const filtered = listing.data?.items ?? [];
  // Every channel now delivers in-app, so reach is the full audience; only Pending
  // Applicants is email-only and therefore limited by email opt-outs.
  const audienceCountEstimate = (audience: Exclude<Audience, 'All'>) => { const estimate = options.data?.audiences.find(a => a.name === audience); return (audience === 'Pending Applicants' ? estimate?.email : estimate?.total) ?? 0; };
  const estimatedRecipients = options.data ? audienceCountEstimate(composer.audience).toLocaleString() : 'Loading...';
  const saveDraft = () => void form.run('draft');
  const submit = (kind: 'send-now' | 'schedule' | 'sab-preview') => void form.run(kind === 'send-now' ? 'send' : kind === 'sab-preview' ? 'preview' : 'schedule');

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Link to="/admin" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ChevronRight className="h-3 w-3 rotate-180" /> Admin home
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Announcements &amp; Platform Notifications</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Member announcements and applicant communications.
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
          { label: 'Total Announcements', value: listing.data ? String(tabCounts.All) : '-', icon: Megaphone, color: 'forum', note: `${tabCounts.Sending} in progress` },
          { label: 'Scheduled', value: tabCounts.Scheduled.toString(), icon: CalendarClock, color: 'brass', note: `${tabCounts.Draft} drafts awaiting` },
          { label: 'In-App Read Rate', value: listing.data?.stats.inAppReadRate == null ? '-' : `${listing.data.stats.inAppReadRate}%`, icon: Eye, color: 'slateteal', note: 'Delivered in-app notifications this month' },
          { label: 'This Month Sent', value: String(listing.data?.stats.monthSent ?? '-'), icon: CheckCircle2, color: 'forum', note: `${listing.data?.stats.delivered ?? '-'} channel deliveries this month` },
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

      {form.result && <p role="status" className="rounded-lg border border-success-600/30 bg-success-50 p-3.5 text-sm text-success-800">{form.result}</p>}
      {form.error && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 p-3.5 text-sm text-danger-800">{form.error}{form.stale && form.record && <Button variant="outline" disabled={busy} onClick={() => void openDraft(form.record!)}>Reload saved draft</Button>}</div>}
      {(listing.error || options.error) && <div role="alert" className="text-sm text-danger-600">{listing.error || options.error}<Button variant="outline" onClick={() => { listing.refresh(); options.refresh(); }}>Retry</Button></div>}
      {options.data && (!options.data.smtpConfigured || !options.data.workerEnabled) && <p className="text-sm text-warning-600">{!options.data.smtpConfigured && 'Email delivery is unconfigured. '}{!options.data.workerEnabled && 'Delivery worker is disabled.'}</p>}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 rounded-lg bg-forum-50 p-1 overflow-x-auto">
              {(['All', 'Draft', 'Scheduled', 'Sent'] as Status[]).map((t) => (
                <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`rounded-md px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium capitalize transition-colors whitespace-nowrap ${tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'}`}>
                  {t} ({tabCounts[t]})
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search announcements…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={audienceFilter} aria-label="Filter audience" onChange={(e) => { setAudienceFilter(e.target.value as Audience); setPage(1); }} className="w-full sm:w-44">
                {(['All', ...AUDIENCE_OPTS] as Audience[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Audiences' : v}</option>)}
              </SelectInput>
              <SelectInput aria-label="Filter status" value={tab} onChange={e => { setTab(e.target.value as Status); setPage(1); }} className="w-full sm:w-36">{ANNOUNCEMENT_STATUSES.map(s => <option key={s}>{s}</option>)}</SelectInput>
              <Button variant="primary" disabled={busy} onClick={() => { if (!showComposer) form.reset(); setShowComposer(!showComposer); }}>
                <Plus className="h-4 w-4" />
                {showComposer ? 'Close Composer' : 'New Announcement'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-5">
          {showComposer && (
            <fieldset disabled={busy} className="min-w-0 mb-3 rounded-xl border border-forum-600/30 bg-gradient-to-br from-forum-50 to-brass-100/60 p-5 sm:p-6">
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
                <button onClick={() => { setShowComposer(false);  }} className="p-1.5 rounded-md text-ink-muted hover:bg-paper-raised self-start" aria-label="Close composer">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {Object.values(errors).some(Boolean) && (
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
                      <Checkbox id="append-unsub" name="append-unsub" label="Include announcement-email unsubscribe footer." checked={composer.appendUnsubscribe} onChange={(e) => update('appendUnsubscribe', (e.target as HTMLInputElement).checked)} />
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
                        {AUDIENCE_OPTS.map((a) => <option key={a} value={a} disabled={a === 'Newsletter (Public)'}>{a === 'Newsletter (Public)' ? 'Newsletter (Public) - unavailable' : `${a} (est. ${audienceCountEstimate(a).toLocaleString()})`}</option>)}
                      </SelectInput>
                      <SelectInput label="Delivery Channel" error={err('channel')} value={composer.channel} onChange={(e) => update('channel', e.target.value as Channel)}>
                        {CHANNEL_OPTS.map((c) => <option key={c} disabled={composer.audience === 'Pending Applicants' && c !== 'Email'}>{c}</option>)}
                      </SelectInput>
                      {/* Every channel reaches the member Announcements list; the choice only
                          decides whether an email goes out too. Pending Applicants is the one
                          audience with no in-app reader, so it is email-only. */}
                      {composer.audience === 'Pending Applicants' ? (
                        <p className="-mt-2 flex items-start gap-1.5 text-xs text-ink-subtle">
                          <MailIcon className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>Emailed only — applicants have no in-app Announcements view.</span>
                        </p>
                      ) : composer.channel === 'In-App Only' ? (
                        <p className="-mt-2 flex items-start gap-1.5 text-xs text-ink-subtle">
                          <Smartphone className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>Shown in members' Announcements. No email is sent.</span>
                        </p>
                      ) : (
                        <p className="-mt-2 flex items-start gap-1.5 text-xs text-ink-subtle">
                          <MailIcon className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>Shown in members' Announcements, and emailed.</span>
                        </p>
                      )}
                      <TextInput label="Expiration (optional)" type="datetime-local" value={composer.expiresAt} onChange={e => update('expiresAt', e.target.value)} error={err('expiresAt')} />
                      {composer.scheduleMode !== 'scheduled' && <TextInput label="Timezone (IANA)" value={composer.timezone} onChange={e => update('timezone', e.target.value)} error={err('timezone')} />}
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
                                  <TextInput label="Send date and time" type="datetime-local" value={composer.scheduledAt} onChange={(e) => update('scheduledAt', e.target.value)} error={err('scheduledAt')} />
                                  <TextInput label="Timezone (IANA)" value={composer.timezone} onChange={e => update('timezone', e.target.value)} error={err('timezone')} />
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
                      <div className="flex justify-between items-center gap-2"><span>Unsubscribe footer</span>{composer.appendUnsubscribe ? <Check className="h-3.5 w-3.5 text-success-600" /> : <X className="h-3.5 w-3.5 text-danger-500" />}</div>
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
                      {composer.audience === 'Pending Applicants' && (
                        <p className="flex items-start gap-1.5 text-warning-600">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                          <span>Email only — applicants have no in-app Announcements view.</span>
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-ink">
                        <Bell className="h-3.5 w-3.5 text-forum-600" />Recipients: <span className="font-semibold">{estimatedRecipients}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:flex-wrap sm:justify-end gap-2 pt-4 border-t border-forum-600/10">
                <Button variant="ghost" onClick={() => { form.reset();  }}>
                  <Trash2 className="h-4 w-4" /> Clear
                </Button>
                <Button variant="ghost" onClick={() => { setShowComposer(false);  }}>Close</Button>
                <Button variant="outline" onClick={saveDraft}>
                  <Save className="h-4 w-4" />Save Draft
                </Button>
                <Button variant="outline" disabled={!options.data?.sabRecipients} onClick={() => submit('sab-preview')}>
                  <ShieldCheck className="h-4 w-4" />Send SAB Preview
                </Button>
                <Button
                  variant="primary"
                  disabled={composer.scheduleMode === 'draft'}
                  onClick={() => submit(composer.scheduleMode === 'scheduled' ? 'schedule' : 'send-now')}
                >
                  {composer.scheduleMode === 'scheduled' ? <><CalendarClock className="h-4 w-4" />Schedule Broadcast</> : composer.scheduleMode === 'draft' ? <><Save className="h-4 w-4" />Draft Mode — save first</> : <><Send className="h-4 w-4" />Broadcast Now</>}
                </Button>
              </div>
              {form.record && <Button variant="ghost" onClick={() => setSelected(form.record!.id)}><Eye className="h-4 w-4" />Preview and SAB sign-off</Button>}
            </fieldset>
          )}

          {listing.initialLoading && <p role="status" className="py-8 text-center text-ink-muted">Loading announcements...</p>}
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
                        <p className="text-base font-semibold text-forum-900 truncate">{a.subject || 'Untitled draft'}</p>
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
                          {a.status === 'Scheduled' ? <>Sends {dateLabel(a.scheduledFor, a.timezone)}</> : a.sentAt ? <>Sent {dateLabel(a.sentAt)}</> : <>Edited {dateLabel(a.updatedAt)}</>}
                        </span>
                        <span className="inline-flex items-center gap-1">by {a.author}</span>
                        {a.expiresAt && <span>Expires {a.expiresAt.replace('T', ' ')} {a.timezone}</span>}
                        {a.delivery.map(d => <Badge key={`${d.channel}-${d.status}`} variant={d.status === 'FAILED' ? 'danger' : 'default'} className="!text-[10px] !py-0">{d.channel === 'IN_APP' ? 'In-app' : d.channel}: {d.count} {d.status.toLowerCase()}</Badge>)}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap md:flex-col md:items-end gap-2 shrink-0">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDelete(a)}><Trash2 className="h-4 w-4" />Delete</Button>
                    {a.status === 'Draft' && (
                      <Button size="sm" variant="outline" className="justify-start" disabled={busy} onClick={() => void openDraft(a)}>
                        <Copy className="h-3.5 w-3.5" />
                        Edit in Composer
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="justify-start" onClick={() => setSelected(a.id)}>
                      <Eye className="h-3.5 w-3.5" />
                      Preview
                    </Button>
                    {a.status === 'Draft' && (
                      <Button size="sm" variant="primary" className="justify-start" disabled={busy} onClick={() => void openDraft(a, true)}>
                        <Send className="h-3.5 w-3.5" />
                        Schedule
                      </Button>
                    )}
                    {a.status === 'Scheduled' && (
                      <Button size="sm" variant="outline" className="border-danger-600/30 text-danger-600 hover:bg-danger-100 justify-start" onClick={() => setConfirmCancelSchedule(a)}>
                        <XCircle className="h-3.5 w-3.5" />
                        Cancel Scheduled
                      </Button>
                    )}
                    {a.dispatchStartedAt && (
                      <Button onClick={() => setSelected(a.id)} variant="outline" size="sm" className="justify-start">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Stats &amp; Engagement
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {!listing.initialLoading && !listing.error && filtered.length === 0 && (
              <div className="p-10 text-center">
                <Bell className="h-8 w-8 mx-auto text-paper-border mb-2" />
                <p className="text-sm text-ink-subtle">No announcements match the current filters.</p>
                <button onClick={() => { setAudienceFilter('All'); setTab('All'); setSearch(''); }} className="text-xs text-forum-700 font-semibold mt-2 inline-flex items-center gap-1">
                  Clear filters <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          {listing.data && <Pagination meta={listing.data.pagination} page={page} limit={limit} setPage={setPage} setLimit={value => { setLimit(value); setPage(1); }} />}
        </CardContent>
      </Card>
      {selected && <AnnouncementDetail key={selected} id={selected} close={() => setSelected(null)} changed={listing.refresh} />}
      {confirmDelete && <ExchangeModal title="Delete announcement?" close={() => setConfirmDelete(null)} busy={busy}>
        <p className="text-sm text-ink-muted">This announcement will be removed from member views and pending delivery will stop. Emails already sent cannot be recalled.</p>
        {form.error && <p role="alert" className="mt-3 text-sm text-danger-600">{form.error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setConfirmDelete(null)}>Keep announcement</Button><Button disabled={busy} onClick={() => { void form.action(confirmDelete, 'delete', true).then(ok => { if (ok) { setConfirmDelete(null); setPage(1); } }); }}><Trash2 className="h-4 w-4" />Confirm Delete</Button></div>
      </ExchangeModal>}

      {confirmCancelSchedule && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-paper-raised border border-paper-border shadow-2xl overflow-hidden">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-warning-100 text-warning-600 flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Cancel this scheduled broadcast?</h3>
                  <p className="text-xs text-ink-subtle mt-0.5 font-mono">{confirmCancelSchedule.id}</p>
                </div>
              </div>
              <button onClick={() => setConfirmCancelSchedule(null)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            {form.error && <p role="alert" className="px-5 py-2 text-sm text-danger-600">{form.error}</p>}
            <div className="px-5 py-4 text-sm text-ink-muted">
              Cancelling will remove the scheduled job from the queue. The draft will be preserved so you can reschedule. Members will not be notified.
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60">
              <Button variant="ghost" size="sm" onClick={() => setConfirmCancelSchedule(null)}>Keep scheduled</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" disabled={busy} onClick={() => { void form.action(confirmCancelSchedule, 'cancel').then(ok => { if (ok) setConfirmCancelSchedule(null); }); }}>
                <Ban className="h-4 w-4" />Confirm Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
