import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Save,
  MapPin,
  Users,
  Globe2,
  FileText,
  X,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Link as LinkIcon,
  Sparkles,
  Eye,
  Send,
  CalendarClock,
  ShieldCheck,
  Building2,
  Image,
  AlertTriangle,
  Edit3,
  RefreshCw,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextInput, FileInput, SelectInput, TextArea, Checkbox } from '../../components/common/Input';
import type { EventFormState } from './AdminNewEventPage';
import { validate as eventValidate } from './AdminNewEventPage';

type Format = 'In-Person' | 'Hybrid' | 'Virtual';
type Audience = 'All Members' | 'CRO Invite' | 'Public';
type EventTag =
  | 'Symposium' | 'Workshop' | 'Town Hall' | 'Lecture'
  | 'Moral Support' | 'Grants' | 'Publications' | 'Wellness'
  | 'Chapter' | 'Networking' | 'SAB' | 'Training';

const EVENT_TAGS: EventTag[] = [
  'Symposium', 'Workshop', 'Town Hall', 'Lecture',
  'Moral Support', 'Grants', 'Publications', 'Wellness',
  'Chapter', 'Networking', 'SAB', 'Training',
];

interface EventRecordPopulate {
  id: string;
  title: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  timezone: string;
  location: string;
  format: Format;
  audience: Audience;
  capacity: string;
  externalUrl: string;
  organizer: string;
  organizerEmail: string;
  shortDescription: string;
  longDescription: string;
  speakers: string[];
  tags: EventTag[];
  status: 'Published' | 'Draft' | 'Past' | 'Cancelled';
  attendees: number;
  featured: boolean;
}

const eventsById: Record<string, EventRecordPopulate> = {
  'ev-2026-09': {
    id: 'ev-2026-09',
    title: 'IFSMHP 2026 Annual Scientific Symposium',
    date: '2026-09-18',
    timeStart: '09:00',
    timeEnd: '17:30',
    timezone: 'Europe/Stockholm (CET)',
    location: 'Stockholm, Sweden · Karolinska Congress Hall + Virtual',
    format: 'Hybrid',
    audience: 'All Members',
    capacity: '250',
    externalUrl: 'https://ifsmhp.example/events/symposium-2026',
    organizer: 'CRO Office',
    organizerEmail: 'events@ifsmhp.example',
    shortDescription: 'Keynotes on biomarkers, digital therapeutics and the global mental health workforce crisis. Three-day scientific program with plenary sessions, working group breakouts, poster hall, and community social events. Scientific Advisory Board (SAB) meeting the day before.',
    longDescription:
      '## About the Symposium\n\nThe 2026 IFSMHP Annual Scientific Symposium brings together members across our seven professional tracks for three days of keynotes, working group sessions, poster presentations and community building.\n\n## Agenda (draft)\n\n- Day 0 (Thu Sept 17) — SAB Meeting + Early Career Workshop\n- Day 1 (Fri Sept 18) — Opening Plenary: Biomarkers in Clinical Practice\n  - Session 1A: Digital therapeutics — evidence base 2026\n  - Session 1B: Workforce crisis — a global view from LMIC programs\n- Day 2 (Sat Sept 19) — Parallel tracks\n  - Track A: Scientists — novel biomarkers\n  - Track B: Clinicians — culturally adapted CBT\n  - Track C: Policy & Public Health — service design\n- Day 3 (Sun Sept 20) — Closing + members assembly\n\n## SAB & Invited Speakers\n\nConfirmed keynoters include Prof. Lindberg (Karolinska) and Dr. E. Whitfield (CRO Lead).',
    speakers: [
      'Prof. H. Lindberg — Karolinska Institutet, SAB Chair',
      'Dr. E. Whitfield — IFSMHP CRO Lead',
      'Prof. M. Chen — Stanford, Biomarkers Track',
      'Dr. K. Asante — University of Ghana, Public Health Track',
    ],
    tags: ['Symposium', 'SAB', 'Networking'],
    status: 'Published',
    attendees: 142,
    featured: true,
  },
  'ev-2026-09-08': {
    id: 'ev-2026-09-08',
    title: 'Workshop: Writing Project Proposals for CRO Funding',
    date: '2026-09-08',
    timeStart: '14:00',
    timeEnd: '16:30',
    timezone: 'UTC',
    location: 'Zoom — RSVP required',
    format: 'Virtual',
    audience: 'All Members',
    capacity: '200',
    externalUrl: 'https://ifsmhp-example.zoom.us/webinar/register/WN_ZGAXq',
    organizer: 'Grants Office',
    organizerEmail: 'grants@ifsmhp.example',
    shortDescription: 'A 2.5-hour guided workshop covering project scope, budget justification, reviewer pitfalls, and the IFSMHP-specific sections of CRO grant applications. Participants leave with a structured outline and an SAB Q&A.',
    longDescription:
      '## Workshop goals\n\nBy the end of the workshop, participants will:\n\n1. Understand the 4 sections reviewers score highest\n2. Have a structured outline for an IFSMHP CRO grant\n3. Have asked questions of the SAB Grants Subcommittee\n\n## Who should attend?\n\nMembers considering a CRO project grant submission in the October or January round. Postdocs and early-career researchers especially welcome.',
    speakers: [
      'Dr. N. Hargrove — Grants Office Director',
      'Prof. R. Mehta — SAB Grants Subcommittee',
    ],
    tags: ['Grants', 'Workshop'],
    status: 'Published',
    attendees: 78,
    featured: false,
  },
  'ev-2026-10-12': {
    id: 'ev-2026-10-12',
    title: 'Moral Support Program: Monthly Members Peer Group',
    date: '2026-10-12',
    timeStart: '19:00',
    timeEnd: '20:30',
    timezone: 'UTC',
    location: 'Private Video Room',
    format: 'Virtual',
    audience: 'CRO Invite',
    capacity: '24',
    externalUrl: '',
    organizer: 'Wellness Committee',
    organizerEmail: 'wellness@ifsmhp.example',
    shortDescription: 'Chatham House Rules, 90-minute facilitated peer discussion. Not recorded. Topics pre-circulated via membership email. New attendees welcome.',
    longDescription: 'Monthly peer group for members. Facilitated by the Wellness Committee. All content confidential and not recorded.',
    speakers: ['Wellness Committee (facilitated)'],
    tags: ['Moral Support', 'Wellness'],
    status: 'Draft',
    attendees: 14,
    featured: false,
  },
};

interface Errors {
  [k: string]: string | undefined;
  title?: string; shortDescription?: string; date?: string; timeStart?: string; timeEnd?: string;
  location?: string; organizer?: string; organizerEmail?: string; longDescription?: string;
  capacity?: string; externalUrl?: string;
}

function validate(form: EventFormState): Errors {
  return eventValidate(form);
}

export default function AdminEditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ev = eventsById[id ?? ''] ?? eventsById['ev-2026-09']!;

  const [form, setForm] = useState<EventFormState>(() => ({
    title: ev.title,
    shortDescription: ev.shortDescription,
    date: ev.date,
    timeStart: ev.timeStart,
    timeEnd: ev.timeEnd,
    timezone: ev.timezone,
    location: ev.location,
    format: ev.format,
    audience: ev.audience,
    capacity: ev.capacity,
    externalUrl: ev.externalUrl,
    organizer: ev.organizer,
    organizerEmail: ev.organizerEmail,
    longDescription: ev.longDescription,
    agenda: '',
    speakers: ev.speakers.length > 0 ? [...ev.speakers] : [''],
    tags: ev.tags.length > 0 ? [...ev.tags] : [],
    registrationRequired: true,
    waitlistEnabled: true,
    sendReminder: true,
    reminderDays: '1',
    recordingProvided: ev.format !== 'In-Person',
    publishImmediately: ev.status === 'Published',
    scheduledPublishDate: '',
    featured: ev.featured,
  }));

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<EventRecordPopulate['status']>(ev.status);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saved, setSaved] = useState<null | 'ok' | 'published'>(null);

  const allErrors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(allErrors).length === 0;
  const fieldError = (name: keyof Errors) => (touched[name] || errors[name]) ? (errors[name] ?? allErrors[name]) : undefined;

  const update = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
  };

  const toggleTag = (tag: EventTag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? (f.tags as EventTag[]).filter((t) => t !== tag) : [...(f.tags as EventTag[]), tag],
    }));
  };

  const updateSpeaker = (idx: number, value: string) => {
    setForm((f) => { const next = [...f.speakers]; next[idx] = value; return { ...f, speakers: next }; });
  };
  const addSpeaker = () => setForm((f) => ({ ...f, speakers: [...f.speakers, ''] }));
  const removeSpeaker = (idx: number) => setForm((f) => ({ ...f, speakers: f.speakers.filter((_, i) => i !== idx) }));

  const save = (publishMode: 'draft' | 'publish' = 'draft') => {
    setErrors(allErrors);
    if (publishMode === 'publish') {
      const allTouched: Record<string, boolean> = {};
      Object.keys(form).forEach((k) => { allTouched[k] = true; });
      setTouched(allTouched);
    }
    if (publishMode === 'publish' && !isValid) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (publishMode === 'publish') setStatus('Published');
    setSaved(publishMode === 'publish' ? 'published' : 'ok');
    setTimeout(() => setSaved(null), 3500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />[DEMO DATA — API pending]</Badge>
            <Link to="/admin/events" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to events
            </Link>
            <Badge variant={status === 'Published' ? 'success' : status === 'Cancelled' ? 'danger' : status === 'Draft' ? 'warning' : 'default'}>
              <Edit3 className="h-3 w-3 mr-1" />Editing · {status}
            </Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Edit Event</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Updating <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{ev.id}</code> — {ev.title || 'Untitled event'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {status === 'Published' && (
            <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setConfirmCancel(true)}>
              <AlertCircle className="h-3.5 w-3.5" /> Cancel Event
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => save('draft')}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh preview
          </Button>
          <Button variant="outline" size="sm" onClick={() => save('draft')}>
            {saved === 'ok' ? <><CheckCircle2 className="h-3.5 w-3.5 text-success-600" />Saved</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
          </Button>
        </div>
      </div>

      {saved && (
        <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 ${
          saved === 'published' ? 'border-success-600/20 bg-success-50' : 'border-brass-500/30 bg-brass-50'
        }`}>
          <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${saved === 'published' ? 'text-success-600' : 'text-brass-700'}`} />
          <div>
            <p className={`text-sm font-semibold ${saved === 'published' ? 'text-success-800' : 'text-brass-800'}`}>
              {saved === 'published' ? 'Event published' : 'Saved successfully'}
            </p>
            <p className={`text-xs ${saved === 'published' ? 'text-success-700/90' : 'text-brass-700/90'} mt-0.5`}>
              {saved === 'published' ? 'Changes are live on the calendar and registered attendees have been notified.' : 'Draft saved. Continue editing or publish when ready.'}
            </p>
          </div>
        </div>
      )}

      {!isValid && Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-4 flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger-800">Please correct {Object.keys(allErrors).length} issue{Object.keys(allErrors).length > 1 ? 's' : ''} to enable publishing:</p>
            <ul className="mt-1 ml-4 list-disc text-xs text-danger-700 space-y-0.5">
              {Object.values(allErrors).filter(Boolean).map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        </div>
      )}

      <Card className="rounded-xl border border-paper-border bg-paper overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-forum-50 to-brass-50/60 border-b border-paper-border">
          <div className="grid gap-4 md:grid-cols-4">
            <StatRow icon={<CalendarClock className="h-4 w-4" />} label="ID & Status" value={<><code className="font-mono text-[11px] bg-paper px-1.5 py-0.5 rounded border border-paper-border">{ev.id}</code> <Badge variant={status === 'Published' ? 'success' : status === 'Cancelled' ? 'danger' : 'warning'}>{status}</Badge></>} />
            <StatRow icon={<Users className="h-4 w-4" />} label="RSVPs / Capacity" value={<><span className="font-semibold">{ev.attendees}</span>{form.capacity ? <> / <span className="text-ink-subtle">of {form.capacity}</span></> : <span className="text-ink-subtle"> (unlimited)</span>}</>} />
            <StatRow icon={<Eye className="h-4 w-4" />} label="Visibility" value={form.audience} />
            <StatRow icon={<Globe2 className="h-4 w-4" />} label="Format" value={form.format} />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" /> Event Basics
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <TextInput label={<>Title <span className="text-danger-600">*</span></>} value={form.title} onChange={(e) => update('title', e.target.value)} error={fieldError('title')} hint={`${form.title.length}/140`} />
              <TextArea label="Short Description" rows={3} value={form.shortDescription} onChange={(e) => update('shortDescription', e.target.value)} error={fieldError('shortDescription')} hint={`${form.shortDescription.length}/300`} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-1"><TextInput label="Date" type="date" value={form.date} onChange={(e) => update('date', e.target.value)} error={fieldError('date')} icon={<Calendar className="h-4 w-4 text-ink-subtle" />} /></div>
                <TextInput label="Start" type="time" value={form.timeStart} onChange={(e) => update('timeStart', e.target.value)} error={fieldError('timeStart')} icon={<Clock className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="End" type="time" value={form.timeEnd} onChange={(e) => update('timeEnd', e.target.value)} error={fieldError('timeEnd')} icon={<Clock className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Timezone" value={form.timezone} onChange={(e) => update('timezone', e.target.value)} />
              </div>
              <TextInput label="Location / Virtual Room" value={form.location} onChange={(e) => update('location', e.target.value)} error={fieldError('location')} icon={<MapPin className="h-4 w-4 text-ink-subtle" />} />
              <div className="grid gap-4 sm:grid-cols-3">
                <SelectInput label="Format" value={form.format} onChange={(e) => update('format', e.target.value as Format)}>
                  {(['Virtual', 'Hybrid', 'In-Person'] as Format[]).map((f) => <option key={f}>{f}</option>)}
                </SelectInput>
                <SelectInput label="Audience" value={form.audience} onChange={(e) => update('audience', e.target.value as Audience)}>
                  {(['All Members', 'CRO Invite', 'Public'] as Audience[]).map((a) => <option key={a}>{a}</option>)}
                </SelectInput>
                <TextInput label="Capacity" value={form.capacity} onChange={(e) => update('capacity', e.target.value)} error={fieldError('capacity')} type="number" icon={<Users className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <TextInput label="External URL" value={form.externalUrl} onChange={(e) => update('externalUrl', e.target.value)} error={fieldError('externalUrl')} icon={<LinkIcon className="h-4 w-4 text-ink-subtle" />} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-brass-700" /> Organizer &amp; Content
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Organizing Team" value={form.organizer} onChange={(e) => update('organizer', e.target.value)} error={fieldError('organizer')} icon={<Building2 className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Contact Email" type="email" value={form.organizerEmail} onChange={(e) => update('organizerEmail', e.target.value)} error={fieldError('organizerEmail')} icon={<ShieldCheck className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <TextArea label="Long Description / Agenda" rows={10} value={form.longDescription} onChange={(e) => update('longDescription', e.target.value)} error={fieldError('longDescription')} hint={`${form.longDescription.length} characters`} />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 block">Speakers / Session Leaders</label>
                <div className="space-y-2">
                  {form.speakers.map((sp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput placeholder={`Speaker ${i + 1}`} value={sp} onChange={(e) => updateSpeaker(i, e.target.value)} className="flex-1" />
                      {form.speakers.length > 1 && (
                        <button onClick={() => removeSpeaker(i)} className="p-2 rounded-md text-ink-muted hover:bg-danger-50 hover:text-danger-600" type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={addSpeaker}>
                    <Plus className="h-3.5 w-3.5" /> Add Speaker
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Image className="h-5 w-5 text-forum-600" /> Cover Media &amp; Tags
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <FileInput label="Event Cover Image" accept="image/*" hint="Current: banner_ifsmhp2026_stockholm.jpg (recommended: 1600×900)" />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TAGS.map((t) => {
                    const active = form.tags.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          active ? 'bg-forum-600 text-white border-forum-600' : 'bg-forum-50 text-forum-700 border-forum-100 hover:bg-forum-100'
                        }`}
                      >{t}</button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slateteal-500" /> Registration &amp; Publishing
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox id="reg-req" name="reg-req" label="Enable RSVP / Registration" checked={form.registrationRequired} onChange={(e) => update('registrationRequired', (e.target as HTMLInputElement).checked)} />
                <Checkbox id="waitlist" name="waitlist" label="Enable waitlist" checked={form.waitlistEnabled} onChange={(e) => update('waitlistEnabled', (e.target as HTMLInputElement).checked)} />
                <Checkbox id="reminder" name="reminder" label="Send automated reminder" checked={form.sendReminder} onChange={(e) => update('sendReminder', (e.target as HTMLInputElement).checked)} />
                <Checkbox id="recording" name="recording" label="Recording / slides provided after event" checked={form.recordingProvided} onChange={(e) => update('recordingProvided', (e.target as HTMLInputElement).checked)} />
                <Checkbox id="featured" name="featured" label="Pin as Featured Event" checked={form.featured} onChange={(e) => update('featured', (e.target as HTMLInputElement).checked)} />
                <Checkbox id="publish-now" name="publish-now" label={status === 'Published' ? 'Keep published' : 'Publish on save'} checked={form.publishImmediately} onChange={(e) => update('publishImmediately', (e.target as HTMLInputElement).checked)} />
              </div>
              {form.sendReminder && (
                <SelectInput label="Reminder timing" value={form.reminderDays} onChange={(e) => update('reminderDays', e.target.value)} className="max-w-xs">
                  <option value="7">7 days before</option>
                  <option value="3">3 days before</option>
                  <option value="1">1 day before</option>
                  <option value="0">Same day (hours before)</option>
                </SelectInput>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-forum-50 to-brass-50/60 border-brass-500/30">
            <CardContent className="pt-6 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3">
              <Button variant="ghost" type="button" onClick={() => navigate('/admin/events')}>
                <X className="h-4 w-4" /> Back to events (discard unsaved)
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" onClick={() => save('draft')}>
                  <Save className="h-4 w-4" /> Save Draft
                </Button>
                <Button type="button" disabled={!isValid} onClick={() => save('publish')}>
                  {saved === 'published' ? <><CheckCircle2 className="h-4 w-4" />Published</> : isValid ? <><Send className="h-4 w-4" /> Update &amp; Publish</> : <><AlertCircle className="h-4 w-4" />{Object.keys(allErrors).length} issue{Object.keys(allErrors).length > 1 ? 's' : ''} — fix to publish</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Preview Card</h3></CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-2xl border border-paper-border overflow-hidden bg-gradient-to-br from-forum-50 via-paper to-brass-50/40">
                <div className="h-28 bg-gradient-to-br from-forum-600 via-slateteal-500 to-brass-500 flex items-center justify-center text-white/90 text-xs">
                  <Image className="h-6 w-6 mr-2" />Existing cover banner
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={form.format === 'Virtual' ? 'info' : form.format === 'Hybrid' ? 'brass' : 'default'} className="!py-0">
                      {form.format === 'Virtual' ? <Globe2 className="h-3 w-3 mr-1" /> : form.format === 'In-Person' ? <MapPin className="h-3 w-3 mr-1" /> : <Globe2 className="h-3 w-3 mr-1" />}
                      {form.format}
                    </Badge>
                    <Badge variant={form.audience === 'Public' ? 'brass' : form.audience === 'CRO Invite' ? 'warning' : 'info'} className="!py-0">{form.audience}</Badge>
                    {form.featured && <Badge variant="brass" className="!py-0">★ FEATURED</Badge>}
                  </div>
                  <h4 className="font-display text-lg font-semibold text-forum-900 leading-snug">{form.title}</h4>
                  <p className="text-sm text-ink-muted leading-relaxed line-clamp-3">{form.shortDescription}</p>
                  <div className="grid gap-2 text-xs text-ink-subtle pt-2 border-t border-paper-border">
                    <div className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{form.date || '—'}</span></div>
                    <div className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{form.timeStart} – {form.timeEnd}</span></div>
                    <div className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink truncate">{form.location}</span></div>
                    <div className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{ev.attendees}{form.capacity ? ` / ${form.capacity} capacity` : ''}</span></div>
                  </div>
                  {form.tags.length > 0 && (
                    <div className="pt-2 border-t border-paper-border flex flex-wrap gap-1">
                      {form.tags.map((t) => <span key={t} className="text-[10px] font-semibold uppercase tracking-wider rounded-full bg-forum-50 text-forum-700 px-2 py-0.5">{t}</span>)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Form Validity</h3></CardHeader>
            <CardContent className="pt-0 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-ink-subtle">Ready to publish</span><span className={isValid ? 'text-success-600 font-semibold inline-flex items-center gap-1' : 'text-danger-600 font-semibold inline-flex items-center gap-1'}>{isValid ? <><CheckCircle2 className="h-3.5 w-3.5" />Yes</> : <><AlertCircle className="h-3.5 w-3.5" />No — {Object.keys(allErrors).length}</>}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Speakers</span><span className="font-medium text-ink">{form.speakers.filter((s) => s.trim()).length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Tags</span><span className="font-medium text-ink">{form.tags.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Last edited</span><span className="font-medium text-ink">Just now</span></div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {confirmCancel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-forum-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-paper-raised border border-paper-border shadow-2xl">
            <div className="border-b border-paper-border px-5 py-4 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-forum-900">Cancel this event?</h3>
                  <p className="text-xs text-ink-subtle mt-0.5">{form.title}</p>
                </div>
              </div>
              <button onClick={() => setConfirmCancel(false)} className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-3.5 text-xs text-danger-700 space-y-1">
                <p className="font-semibold uppercase tracking-wider">This cancels the event publicly:</p>
                <ul className="ml-4 list-disc space-y-0.5"><li>Status set to Cancelled</li><li>Registered attendees emailed</li><li>Removed from Featured banner</li></ul>
              </div>
              <TextArea rows={3} label="Reason for cancellation (sent to attendees)" placeholder="E.g. speaker illness, insufficient enrollment, rescheduling." />
              <Checkbox id="email-cancel" name="email-cancel" label="Email cancellation notice to registered attendees." defaultChecked />
              <Checkbox id="refund-offer" name="refund-offer" label="Offer a refund or reschedule credit (if paid event)." />
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60 rounded-b-2xl">
              <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" onClick={() => { setStatus('Cancelled'); setConfirmCancel(false); }}>
                <X className="h-4 w-4" /> Confirm Cancel Event
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-9 w-9 shrink-0 rounded-lg bg-paper text-forum-700 ring-1 ring-paper-border flex items-center justify-center text-forum-600">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">{label}</p>
        <div className="text-sm text-forum-900 mt-0.5">{value}</div>
      </div>
    </div>
  );
}
