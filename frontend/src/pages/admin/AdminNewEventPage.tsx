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
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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
export default function AdminNewEventPage() {
  const navigate = useNavigate();
  const { form, setForm, errors, setErrors, touched, setTouched, busy, message, requestError, coverUrl, coverName, chooseCover, save } = useEventEditor();
  const [showPreview, setShowPreview] = useState(true);
  const savedAsDraft = message.includes('Draft');

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
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const updateSpeaker = (idx: number, value: string) => {
    setForm((f) => {
      const next = [...f.speakers];
      next[idx] = value;
      return { ...f, speakers: next };
    });
  };
  const addSpeaker = () => setForm((f) => ({ ...f, speakers: [...f.speakers, ''] }));
  const removeSpeaker = (idx: number) => setForm((f) => ({ ...f, speakers: f.speakers.filter((_, i) => i !== idx) }));

  const saveDraft = () => { void save('draft'); };
  const publish = (e: React.FormEvent) => { e.preventDefault(); void save('submit'); };

  const speakerList = form.speakers.filter((s) => s.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">

            <Link to="/admin/events" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Back to events
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Create New Event</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Publish conferences, workshops, webinars, chapter events, and moral support gatherings to the member community and public calendar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowPreview((v) => !v)}>
            <Eye className="h-3.5 w-3.5" />
            {showPreview ? 'Hide Preview' : 'Live Preview'}
          </Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={busy}>
            {savedAsDraft ? (
              <><CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> Saved Draft</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save Draft</>
            )}
          </Button>
        </div>
      </div>

      {requestError && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 p-4 text-sm text-danger-800">{requestError}</div>}
      {savedAsDraft && (
        <div className="rounded-lg border border-success-600/20 bg-success-50 p-3.5 flex items-start gap-2.5">
          <CheckCircle2 className="h-4.5 w-4.5 text-success-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-success-800">Draft saved</p>
            <p className="text-xs text-success-700/90">Your event has been saved as a draft. You can close this page and return later to continue editing.</p>
          </div>
        </div>
      )}

      {!isValid && Object.keys(errors).length > 0 && (
        <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-4 flex items-start gap-2.5">
          <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-danger-800">Please correct the following issues before publishing:</p>
            <ul className="mt-1 ml-4 list-disc text-xs text-danger-700 space-y-0.5">
              {Object.values(allErrors).filter(Boolean).map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <form id="event-form" className="lg:col-span-2 space-y-6" onSubmit={publish} noValidate aria-busy={busy}>
          <fieldset disabled={busy} className="space-y-6 min-w-0">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" /> Event Basics
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">
                What members will see first in the events listing and email previews.
              </p>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <TextInput
                label={<>Title <span className="text-danger-600">*</span></>}
                placeholder="e.g. Workshop: Writing Project Proposals for CRO Funding"
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                error={fieldError('title')}
                hint={`${form.title.length}/140 characters`}
                required
              />
              <TextArea
                label={<>Short Description <span className="text-danger-600">*</span> <span className="text-ink-subtle font-normal text-[11px]">(shown in listings and email previews)</span></>}
                rows={3}
                placeholder="1–2 engaging sentences about the event, audience, and why members should attend."
                value={form.shortDescription}
                onChange={(e) => update('shortDescription', e.target.value)}
                error={fieldError('shortDescription')}
                hint={`${form.shortDescription.length}/300 characters`}
                required
              />

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-1">
                  <TextInput
                    label={<>Date <span className="text-danger-600">*</span></>}
                    type="date"
                    value={form.date}
                    onChange={(e) => update('date', e.target.value)}
                    error={fieldError('date')}
                    icon={<Calendar className="h-4 w-4 text-ink-subtle" />}
                    required
                  />
                </div>
                <TextInput
                  label={<>Start <span className="text-danger-600">*</span></>}
                  type="time"
                  value={form.timeStart}
                  onChange={(e) => update('timeStart', e.target.value)}
                  error={fieldError('timeStart')}
                  icon={<Clock className="h-4 w-4 text-ink-subtle" />}
                  required
                />
                <TextInput
                  label={<>End <span className="text-danger-600">*</span></>}
                  type="time"
                  value={form.timeEnd}
                  onChange={(e) => update('timeEnd', e.target.value)}
                  error={fieldError('timeEnd')}
                  icon={<Clock className="h-4 w-4 text-ink-subtle" />}
                  required
                />
                <SelectInput
                  label="Timezone"
                  value={form.timezone}
                  onChange={(e) => update('timezone', e.target.value)}
                >
                  {TIMEZONES.map((tz) => <option key={tz}>{tz}</option>)}
                </SelectInput>
              </div>

              <TextInput
                label={<>Location / Virtual Room <span className="text-danger-600">*</span></>}
                placeholder="Venue name + address, or video platform link…"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                error={fieldError('location')}
                icon={<MapPin className="h-4 w-4 text-ink-subtle" />}
                required
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <SelectInput
                  label="Format"
                  value={form.format}
                  onChange={(e) => update('format', e.target.value as Format)}
                >
                  {(['Virtual', 'Hybrid', 'In-Person'] as Format[]).map((f) => <option key={f}>{f}</option>)}
                </SelectInput>
                <SelectInput
                  label="Audience"
                  value={form.audience}
                  onChange={(e) => update('audience', e.target.value as Audience)}
                >
                  {(['All Members', 'CRO Invite', 'Public'] as Audience[]).map((a) => <option key={a}>{a}</option>)}
                </SelectInput>
                <TextInput
                  label="Capacity"
                  placeholder="Leave blank for unlimited"
                  value={form.capacity}
                  onChange={(e) => update('capacity', e.target.value)}
                  error={fieldError('capacity')}
                  type="number"
                  icon={<Users className="h-4 w-4 text-ink-subtle" />}
                />
              </div>

              <TextInput
                label="External URL (optional)"
                placeholder="YouTube Live, Zoom, RSVP page, ticketing…"
                value={form.externalUrl}
                onChange={(e) => update('externalUrl', e.target.value)}
                error={fieldError('externalUrl')}
                icon={<LinkIcon className="h-4 w-4 text-ink-subtle" />}
              />
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
                <TextInput
                  label={<>Organizing Team <span className="text-danger-600">*</span></>}
                  placeholder="CRO Office, Grants Office, SAB, Chapter…"
                  value={form.organizer}
                  onChange={(e) => update('organizer', e.target.value)}
                  error={fieldError('organizer')}
                  icon={<Building2 className="h-4 w-4 text-ink-subtle" />}
                  required
                />
                <TextInput
                  label={<>Contact Email <span className="text-danger-600">*</span></>}
                  type="email"
                  placeholder="events@ifsmhp.example"
                  value={form.organizerEmail}
                  onChange={(e) => update('organizerEmail', e.target.value)}
                  error={fieldError('organizerEmail')}
                  icon={<ShieldCheck className="h-4 w-4 text-ink-subtle" />}
                  required
                />
              </div>
              <TextArea
                label={<>Long Description / Agenda <span className="text-danger-600">*</span></>}
                rows={8}
                placeholder="Full event description, agenda, speakers, session format, and what attendees will learn or receive. Markdown supported for headings and bullets."
                value={form.longDescription}
                onChange={(e) => update('longDescription', e.target.value)}
                error={fieldError('longDescription')}
                hint={`${form.longDescription.length} characters — shown on the event detail page.`}
                required
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 block flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> Speakers / Session Leaders
                </label>
                <div className="space-y-2">
                  {form.speakers.map((sp, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <TextInput
                        placeholder={`Speaker ${i + 1} name & affiliation`}
                        value={sp}
                        onChange={(e) => updateSpeaker(i, e.target.value)}
                        className="flex-1"
                      />
                      {form.speakers.length > 1 && (
                        <button type="button" onClick={() => removeSpeaker(i)} className="p-2 rounded-md text-ink-muted hover:bg-danger-50 hover:text-danger-600" aria-label="Remove speaker">
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
              <FileInput label="Event Cover Image (optional)" accept="image/jpeg,image/png,image/webp" onChange={e => chooseCover(e.target.files?.[0])} onFiles={files => chooseCover(files[0])} hint={coverName || 'Landscape 16:9 recommended.'} />
              {coverUrl && <img src={coverUrl} alt="Event cover" className="w-full aspect-video object-cover rounded-lg" />}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-2 block flex items-center gap-1.5">
                  Tags &amp; Classification
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EVENT_TAGS.map((t) => {
                    const active = form.tags.includes(t);
                    return (
                      <button
                        type="button"
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? 'bg-forum-600 text-white border-forum-600 shadow-sm'
                            : 'bg-forum-50 text-forum-700 border-forum-100 hover:bg-forum-100'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-[11px] text-ink-subtle">
                  {form.tags.length === 0 ? 'Pick 1–5 tags that describe the event theme.' : `${form.tags.length} tag${form.tags.length > 1 ? 's' : ''} selected`}.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slateteal-500" /> Registration, Reminders &amp; Publishing
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Checkbox
                  id="reg-req" name="reg-req"
                  label={<>Enable RSVP / Registration <span className="text-ink-subtle font-normal">(members must sign up to attend)</span></>}
                  checked={form.registrationRequired}
                  onChange={(e) => update('registrationRequired', (e.target as HTMLInputElement).checked)}
                />
                <Checkbox
                  id="waitlist" name="waitlist"
                  label={<>Enable waitlist <span className="text-ink-subtle font-normal">(when capacity is reached)</span></>}
                  checked={form.waitlistEnabled}
                  onChange={(e) => update('waitlistEnabled', (e.target as HTMLInputElement).checked)}
                />
                <Checkbox
                  id="reminder" name="reminder"
                  label="Send automated reminder email(s)"
                  checked={form.sendReminder}
                  onChange={(e) => update('sendReminder', (e.target as HTMLInputElement).checked)}
                />
                <Checkbox
                  id="recording" name="recording"
                  label="Recording / slides will be shared after the event"
                  checked={form.recordingProvided}
                  onChange={(e) => update('recordingProvided', (e.target as HTMLInputElement).checked)}
                />
                <Checkbox
                  id="featured" name="featured"
                  label="Pin as Featured Event on the community homepage"
                  checked={form.featured}
                  onChange={(e) => update('featured', (e.target as HTMLInputElement).checked)}
                />
                <Checkbox
                  id="publish-now" name="publish-now"
                  label="Publish immediately on submit"
                  checked={form.publishImmediately}
                  onChange={(e) => update('publishImmediately', (e.target as HTMLInputElement).checked)}
                />
              </div>
              {form.sendReminder && (
                <SelectInput
                  label="Send reminder how many days before?"
                  value={form.reminderDays}
                  onChange={(e) => update('reminderDays', e.target.value)}
                  className="max-w-xs"
                >
                  <option value="7">7 days</option>
                  <option value="3">3 days</option>
                  <option value="1">1 day</option>
                  <option value="0">Same day (a few hours before)</option>
                </SelectInput>
              )}
              {!form.publishImmediately && (
                <div className="max-w-xs">
                  <TextInput
                    label="Schedule publish date & time"
                    type="datetime-local"
                    error={fieldError('scheduledPublishDate')}
                    hint={`Timezone: ${form.timezone}`}
                    value={form.scheduledPublishDate}
                    onChange={(e) => update('scheduledPublishDate', e.target.value)}
                    icon={<CalendarClock className="h-4 w-4 text-ink-subtle" />}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-forum-50 to-brass-50/60 border-brass-500/30">
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900">Review &amp; Publish</h3>
              <p className="text-xs text-ink-subtle mt-0.5">
                Published events are available to their selected audience.
              </p>
            </CardHeader>
            <CardContent className="pt-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => navigate('/admin/events')}>
                <X className="h-4 w-4" /> Cancel
              </Button>
              <Button variant="outline" type="button" onClick={saveDraft}>
                <Save className="h-4 w-4" /> Save Draft Only
              </Button>
              <Button form="event-form" type="submit" disabled={busy}>
                {isValid ? (
                  <><Calendar className="h-4 w-4" /> {busy ? 'Saving...' : form.publishImmediately ? 'Publish Event' : form.scheduledPublishDate ? 'Schedule Event' : 'Save Draft'}</>
                ) : (
                  <><AlertCircle className="h-4 w-4" /> Please correct {Object.keys(allErrors).length} issue{Object.keys(allErrors).length > 1 ? 's' : ''}</>
                )}
              </Button>
            </CardContent>
          </Card>
          </fieldset>
        </form>

        <aside className="space-y-5 min-w-0">
          {showPreview && <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900">Live Preview</h3>
              <p className="text-xs text-ink-subtle mt-0.5">How this event appears in the events listing.</p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="rounded-2xl border border-paper-border bg-gradient-to-br from-forum-50 via-paper to-brass-50/40 overflow-hidden">
                <div className="h-28 bg-gradient-to-br from-forum-600 via-slateteal-500 to-brass-500 flex items-center justify-center text-white/90 text-xs">
                  {coverUrl ? <img src={coverUrl} alt="Cover preview" className="h-full w-full object-cover" /> : <><Image className="h-6 w-6 mr-2" />No cover image</>}
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={form.format === 'Virtual' ? 'info' : form.format === 'Hybrid' ? 'brass' : 'default'} className="!py-0">
                      {form.format === 'Virtual' ? <Globe2 className="h-3 w-3 mr-1" /> : form.format === 'In-Person' ? <MapPin className="h-3 w-3 mr-1" /> : <Globe2 className="h-3 w-3 mr-1" />}
                      {form.format}
                    </Badge>
                    <Badge variant={form.audience === 'Public' ? 'brass' : form.audience === 'CRO Invite' ? 'warning' : 'info'} className="!py-0">
                      {form.audience}
                    </Badge>
                    {form.featured && <Badge variant="brass" className="!py-0">★ FEATURED</Badge>}
                  </div>
                  <h4 className="font-display text-lg font-semibold text-forum-900 leading-snug">
                    {form.title || 'Untitled Event'}
                  </h4>
                  <p className="text-sm text-ink-muted leading-relaxed line-clamp-3">
                    {form.shortDescription || 'Short description will appear here. It should be 1–2 engaging sentences.'}
                  </p>
                  <div className="grid gap-2 text-xs text-ink-subtle pt-2 border-t border-paper-border">
                    <div className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{form.date || 'Date — TBD'}</span></div>
                    <div className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{form.timeStart || '—'} – {form.timeEnd || '—'} {form.timezone || ''}</span></div>
                    <div className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink truncate">{form.location || 'Location TBD'}</span></div>
                    <div className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">{form.organizer || 'Organizer TBD'}</span></div>
                    {form.capacity && (
                      <div className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-forum-600" /><span className="font-medium text-ink">Up to {form.capacity} attendees</span></div>
                    )}
                  </div>
                  {speakerList.length > 0 && (
                    <div className="pt-2 border-t border-paper-border">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-1.5">Speakers ({speakerList.length})</p>
                      <div className="space-y-1">
                        {speakerList.slice(0, 3).map((s, i) => <div key={i} className="text-xs text-ink truncate">• {s}</div>)}
                        {speakerList.length > 3 && <div className="text-xs text-ink-subtle">+ {speakerList.length - 3} more</div>}
                      </div>
                    </div>
                  )}
                  {form.tags.length > 0 && (
                    <div className="pt-2 border-t border-paper-border">
                      <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {form.tags.map((t) => <span key={t} className="text-[10px] font-semibold uppercase tracking-wider rounded-full bg-forum-50 text-forum-700 px-2 py-0.5">{t}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>}

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900">Summary</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-ink-subtle">Form validity</span><span className={publishIssueCount === 0 ? 'text-success-600 font-semibold inline-flex items-center gap-1' : 'text-danger-600 font-semibold inline-flex items-center gap-1'}>
                {publishIssueCount === 0 ? <><CheckCircle2 className="h-3.5 w-3.5" />Ready to publish</> : <><AlertCircle className="h-3.5 w-3.5" />{publishIssueCount} issue{publishIssueCount > 1 ? 's' : ''}</>}
              </span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Publish schedule</span><span className="font-medium text-ink">{form.publishImmediately ? 'Immediately' : form.scheduledPublishDate || 'Draft only'}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Registration</span><span className="font-medium text-ink">{form.registrationRequired ? 'Required' : 'Walk-in / open'}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Recording</span><span className="font-medium text-ink">{form.recordingProvided ? 'Will be shared' : 'Not provided'}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Reminder</span><span className="font-medium text-ink">{form.sendReminder ? `${form.reminderDays} day${form.reminderDays !== '1' ? 's' : ''} before` : 'Off'}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Waitlist</span><span className="font-medium text-ink">{form.waitlistEnabled ? 'Enabled' : 'Disabled'}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 flex flex-col gap-2">
              <Button variant="outline" size="sm" className="justify-start" onClick={() => setShowPreview((v) => !v)}>
                <Eye className="h-4 w-4" /> {showPreview ? 'Hide preview card' : 'Show full page preview'}
              </Button>
              <Button form="event-form" type="submit" variant="primary" className="justify-start bg-success-600 hover:bg-success-600/90" disabled={busy}>
                <Send className="h-4 w-4" /> {busy ? 'Saving...' : form.publishImmediately ? 'Publish now' : form.scheduledPublishDate ? 'Schedule Event' : 'Save Draft'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
