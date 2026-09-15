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
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextInput, FileInput, SelectInput, TextArea, Checkbox } from '../../components/common/Input';
import { EVENT_TAGS, TIMEZONES, validateEvent as validate, type EventFormState } from '../../api/events';
import { useEventEditor } from '../../hooks/useEventEditor';
type Format = EventFormState['format'];
type Audience = EventFormState['audience'];
type EventTag = string;
type Errors = Record<string, string | undefined>;

export default function AdminEditEventPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const route = useLocation();
  const readOnly = !route.pathname.endsWith('/edit');
  const { form, setForm, ev, errors, setErrors, touched, setTouched, loading, loadError, retry, busy, message, requestError, coverUrl, coverName, chooseCover, save, cancel, refreshDelivery } = useEventEditor(id);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [emailAttendees, setEmailAttendees] = useState(true);
  const [previewVersion, setPreviewVersion] = useState(0);
  const status = ev?.displayStatus === 'PAST' ? 'Past' : ev?.status === 'PUBLISHED' ? 'Published' : ev?.status === 'CANCELLED' ? 'Cancelled' : 'Draft';
  const saved = message ? (message.includes('published') ? 'published' : 'ok') : null;

  const allErrors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(allErrors).length === 0;
  const publishIssueCount = Object.keys(validate(form, 'publish')).length;
  const fieldError = (name: keyof Errors) => (touched[name] || errors[name]) ? (errors[name] ?? allErrors[name]) : undefined;

  const update = <K extends keyof EventFormState>(k: K, v: EventFormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors(e => ({ ...e, [k]: undefined }));
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

  if (loading) return <div role="status" className="py-12 text-center text-ink-muted">Loading event...</div>;
  if (loadError || !ev) return <div role="alert" className="space-y-4 py-12 text-center"><p>{loadError || 'Event not found.'}</p><Button onClick={retry}>Retry</Button><Button as="link" to="/admin/events" variant="outline">Back to events</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">

            <Link to="/admin/events" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to events
            </Link>
            <Badge variant={status === 'Published' ? 'success' : status === 'Cancelled' ? 'danger' : status === 'Draft' ? 'warning' : 'default'}>
              <Edit3 className="h-3 w-3 mr-1" />{readOnly ? 'Viewing' : 'Editing'} · {status}
            </Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{readOnly ? 'View Event' : 'Edit Event'}</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Updating <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{ev.id}</code> — {ev.title || 'Untitled event'}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {readOnly && <Button as="link" to={`/admin/events/${ev.id}/edit`}><Edit3 className="h-4 w-4" />Edit Event</Button>}
          {!readOnly && <>
          {status === 'Published' && (
            <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setConfirmCancel(true)}>
              <AlertCircle className="h-3.5 w-3.5" /> Cancel Event
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPreviewVersion(v => v + 1)}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh preview
          </Button>
          <Button variant="outline" size="sm" disabled={busy} onClick={() => { void save('submit'); }}>
            {saved === 'ok' ? <><CheckCircle2 className="h-3.5 w-3.5 text-success-600" />Saved</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
          </Button>
          </>}
        </div>
      </div>

      {requestError && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 p-4 text-danger-800">{requestError}</div>}
      {Object.values(errors).some(Boolean) && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 p-4 text-sm text-danger-800">{Object.values(errors).filter(Boolean).join(' ')}</div>}
      {route.state?.message && !message && <p role="status" className="text-success-700">{route.state.message}</p>}
      {saved && (
        <div className={`rounded-lg border p-3.5 flex items-start gap-2.5 ${
          saved === 'published' ? 'border-success-600/20 bg-success-50' : 'border-brass-500/30 bg-brass-50'
        }`}>
          <CheckCircle2 className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${saved === 'published' ? 'text-success-600' : 'text-brass-700'}`} />
          <div>
            <p className={`text-sm font-semibold ${saved === 'published' ? 'text-success-800' : 'text-brass-800'}`}>
              {message}
            </p>
            <p className={`text-xs ${saved === 'published' ? 'text-success-700/90' : 'text-brass-700/90'} mt-0.5`}>
              Your changes have been saved to the event record.
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
        <fieldset disabled={readOnly || busy} className="lg:col-span-2 space-y-6 min-w-0">
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
                <SelectInput label="Timezone" value={form.timezone} error={fieldError('timezone')} onChange={e => update('timezone', e.target.value)}>{[...new Set([...TIMEZONES, form.timezone])].map(tz => <option key={tz}>{tz}</option>)}</SelectInput>
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
              <FileInput label="Event Cover Image" accept="image/jpeg,image/png,image/webp" onChange={e => chooseCover(e.target.files?.[0])} onFiles={files => { if (!readOnly && !busy) chooseCover(files[0]); }} hint={coverName || 'Landscape 16:9 recommended.'} />
              {coverUrl && <img src={coverUrl} alt="Event cover" className="w-full aspect-video object-cover rounded-lg" />}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 block">Tags</label>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...EVENT_TAGS, ...form.tags])].map((t) => {
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

          {!form.publishImmediately && status !== 'Cancelled' && <TextInput label="Schedule publish date & time" type="datetime-local" value={form.scheduledPublishDate} error={fieldError('scheduledPublishDate')} hint={`Timezone: ${form.timezone}`} onChange={e => update('scheduledPublishDate', e.target.value)} />}
          {!readOnly && <Card className="bg-gradient-to-br from-forum-50 to-brass-50/60 border-brass-500/30">
            <CardContent className="pt-6 flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-3">
              <Button variant="ghost" type="button" onClick={() => navigate('/admin/events')}>
                <X className="h-4 w-4" /> Back to events (discard unsaved)
              </Button>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" type="button" onClick={() => save('draft')}>
                  <Save className="h-4 w-4" /> Save Draft
                </Button>
                <Button type="button" disabled={busy} onClick={() => save('publish')}>
                  {saved === 'published' ? <><CheckCircle2 className="h-4 w-4" />Published</> : isValid ? <><Send className="h-4 w-4" /> Update &amp; Publish</> : <><AlertCircle className="h-4 w-4" />{Object.keys(allErrors).length} issue{Object.keys(allErrors).length > 1 ? 's' : ''} — fix to publish</>}
                </Button>
              </div>
            </CardContent>
          </Card>}
        </fieldset>

        <aside key={previewVersion} className="space-y-5 min-w-0">
          <Card>
            <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Preview Card</h3></CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-2xl border border-paper-border overflow-hidden bg-gradient-to-br from-forum-50 via-paper to-brass-50/40">
                <div className="h-28 bg-gradient-to-br from-forum-600 via-slateteal-500 to-brass-500 flex items-center justify-center text-white/90 text-xs">
                  {coverUrl ? <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" /> : <><Image className="h-6 w-6 mr-2" />No cover image</>}
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
              <div className="flex justify-between"><span className="text-ink-subtle">Ready to publish</span><span className={publishIssueCount === 0 ? 'text-success-600 font-semibold inline-flex items-center gap-1' : 'text-danger-600 font-semibold inline-flex items-center gap-1'}>{publishIssueCount === 0 ? <><CheckCircle2 className="h-3.5 w-3.5" />Yes</> : <><AlertCircle className="h-3.5 w-3.5" />No — {publishIssueCount}</>}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Speakers</span><span className="font-medium text-ink">{form.speakers.filter((s) => s.trim()).length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Tags</span><span className="font-medium text-ink">{form.tags.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Last edited</span><span className="font-medium text-ink">{new Date(ev.updatedAt).toLocaleString()}</span></div>
            </CardContent>
          </Card>
          {ev.delivery?.length > 0 && <Card><CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Delivery Status</h3></CardHeader><CardContent className="space-y-2 text-xs">{ev.delivery.map(d => <p key={d.status}>{d.status}: {d.count}</p>)}{ev.failures.map(f => <p key={f.id} className="text-danger-600">{f.kind}: {f.error}</p>)}<Button variant="outline" size="sm" onClick={() => { void refreshDelivery(); }}>Refresh status</Button></CardContent></Card>}
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
              {requestError && <p role="alert" className="text-sm text-danger-600">{requestError}</p>}
              <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-3.5 text-xs text-danger-700 space-y-1">
                <p className="font-semibold uppercase tracking-wider">This cancels the event publicly:</p>
                <ul className="ml-4 list-disc space-y-0.5"><li>Status set to Cancelled</li><li>Cancellation notices queued when selected</li><li>Removed from Featured banner</li></ul>
              </div>
              <TextArea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} label="Reason for cancellation (sent to attendees)" placeholder="E.g. speaker illness, insufficient enrollment, rescheduling." />
              <Checkbox id="email-cancel" name="email-cancel" label="Email cancellation notice to registered attendees." checked={emailAttendees} onChange={e => setEmailAttendees(e.target.checked)} />
              <Checkbox id="refund-offer" name="refund-offer" label="Refunds and credits are unavailable: event payments are not configured." disabled />
            </div>
            <div className="border-t border-paper-border px-5 py-3.5 flex flex-col-reverse sm:flex-row justify-end gap-2 bg-paper/60 rounded-b-2xl">
              <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>Cancel</Button>
              <Button variant="primary" size="sm" className="bg-danger-600 hover:bg-danger-600/90" disabled={busy} onClick={async () => { if (await cancel(cancelReason, emailAttendees)) setConfirmCancel(false); }}>
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
