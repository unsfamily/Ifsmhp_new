import { useRef, useState } from 'react';
import { announcementApi, announcementSchema, type Announcement, type AnnouncementInput, type AnnouncementAction } from '../api/announcements';
import { normalizeError } from '../api/client';
export type ComposerState = AnnouncementInput & { scheduleMode: 'draft' | 'now' | 'scheduled' };
export const EMPTY_COMPOSER: ComposerState = { subject: '', body: '', audience: 'All Members', channel: 'Email + In-App', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', scheduledAt: '', senderAsCRO: true, appendUnsubscribe: true, sendSABPreview: false, scheduleMode: 'draft' };
export function composerInput(c: ComposerState): AnnouncementInput {
  return { subject: c.subject, body: c.body, audience: c.audience, channel: c.channel, timezone: c.timezone, senderAsCRO: c.senderAsCRO, appendUnsubscribe: c.appendUnsubscribe, sendSABPreview: c.sendSABPreview, scheduledAt: c.scheduleMode === 'scheduled' ? c.scheduledAt : '' };
}
export function useAnnouncementComposer(refresh: () => void) {
  const [composer, setComposer] = useState(EMPTY_COMPOSER);
  const [record, setRecord] = useState<Announcement | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const lock = useRef(false);
  const requests = useRef(new Map<string, string>());
  const pendingAction = useRef<{ signature: string; row: Announcement; requestId: string } | null>(null);
  const requestId = (key: unknown) => {
    const signature = JSON.stringify(key);
    if (!requests.current.has(signature)) requests.current.set(signature, crypto.randomUUID());
    return requests.current.get(signature)!;
  };
  const fail = (e: unknown) => { const problem = normalizeError(e); setError(problem.message); setErrors(problem.fieldErrors); setStale(problem.status === 409); };
  const update = <K extends keyof ComposerState>(key: K, value: ComposerState[K]) => {
    setComposer(c => ({ ...c, [key]: value, ...(key === 'audience' && value === 'Pending Applicants' ? { channel: 'Email' as const } : {}) }));
    setErrors(e => ({ ...e, [key]: '' })); setError('');
  };
  const reset = () => { if (lock.current) return; setRecord(null); setComposer(EMPTY_COMPOSER); setErrors({}); setError(''); setStale(false); setResult(''); requests.current.clear(); pendingAction.current = null; };
  const openDraft = async (row: Pick<Announcement, 'id'>, schedule = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { const full = await announcementApi.detail(row.id); setRecord(full); setComposer({ ...composerInput({ ...full, scheduleMode: 'scheduled' }), scheduleMode: schedule || full.status === 'Scheduled' ? 'scheduled' : 'draft' }); setShowComposer(true); setErrors({}); setStale(false); setResult(''); requests.current.clear(); }
    catch (e) { fail(e); } finally { lock.current = false; setBusy(false); }
  };
  const run = async (mode: 'draft' | 'send' | 'schedule' | 'preview') => {
    if (lock.current) return;
    const input = composerInput(composer);
    const parsed = announcementSchema(mode).safeParse(input);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message]))); return; }
    lock.current = true; setBusy(true); setError(''); setErrors({}); setResult('');
    try {
      const signature = JSON.stringify([mode, parsed.data]);
      let saved = pendingAction.current?.signature === signature ? pendingAction.current.row : await announcementApi.save(parsed.data, requestId(['save', record?.id, record?.revision, parsed.data]), record);
      setRecord(saved);
      if (mode !== 'draft') {
        if (pendingAction.current?.signature !== signature) pendingAction.current = { signature, row: saved, requestId: requestId([mode, saved.id, saved.revision]) };
        saved = await announcementApi.act(saved, mode, pendingAction.current.requestId); setRecord(saved);
      }
      pendingAction.current = null;
      setResult(mode === 'draft' ? 'Draft saved.' : mode === 'preview' ? 'SAB preview queued. Check delivery status before confirming sign-off.' : mode === 'schedule' ? 'Broadcast scheduled.' : 'Broadcast queued. Delivery outcomes will appear as processing completes.');
      if (mode === 'send' || mode === 'schedule') { setShowComposer(false); setRecord(null); setComposer(EMPTY_COMPOSER); requests.current.clear(); }
      refresh();
    } catch (e) { fail(e); refresh(); } finally { lock.current = false; setBusy(false); }
  };
  const action = async (row: Announcement, kind: AnnouncementAction, confirmed = false) => {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setResult('');
    try { const updated = await announcementApi.act(row, kind, requestId([kind, row.id, row.revision]), confirmed); if (record?.id === row.id) setRecord(updated); setResult(kind === 'sign-off' ? 'SAB sign-off recorded for this revision.' : kind === 'cancel' ? 'Schedule cancelled. Announcement returned to drafts.' : 'Delivery retry queued.'); refresh(); return true; }
    catch (e) { fail(e); return false; } finally { lock.current = false; setBusy(false); }
  };
  return { composer, record, showComposer, setShowComposer, errors, error, stale, busy, result, update, reset, openDraft, run, action };
}
