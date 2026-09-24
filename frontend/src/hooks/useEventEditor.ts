import { settingsService } from '../services/settingsService';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient, normalizeError } from '../api/client';
import { EMPTY_EVENT, eventApi, eventPayload, eventToForm, validateEvent, type EventRecord } from '../api/events';

export function useEventEditor(id?: string) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...EMPTY_EVENT });
  const [ev, setEvent] = useState<EventRecord | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [message, setMessage] = useState('');
  const [requestError, setRequestError] = useState('');
  const [cover, setCover] = useState<File | null>(null);
  const [coverUrl, setCoverUrl] = useState('');
  const uploaded = useRef<{ file: File; id: string } | null>(null);
  const storedCoverId = ev?.coverFile?.id;
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadError('');
    if (!id) { settingsService.get().then(s => { if (alive) setForm({ ...EMPTY_EVENT, timezone: s.values.general.timezone, capacity: s.values.events.capacity ? String(s.values.events.capacity) : '', registrationRequired: s.values.events.registrationRequired, reminderDays: String(s.values.events.reminderDays) }); }).catch(e => { if (alive) setLoadError(normalizeError(e).message); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }
    eventApi.detail(id).then(e => { if (alive) { setEvent(e); setForm(eventToForm(e)); } })
      .catch(e => { if (alive) setLoadError(normalizeError(e).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, reload]);
  useEffect(() => {
    let alive = true; let url = '';
    setCoverUrl('');
    if (cover) { url = URL.createObjectURL(cover); setCoverUrl(url); }
    else if (storedCoverId) apiClient.get(`/files/${storedCoverId}/download`, { responseType: 'blob' }).then(res => {
      if (alive) { url = URL.createObjectURL(res.data); setCoverUrl(url); }
    }).catch(() => { if (alive) setRequestError('The saved cover image could not be loaded.'); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [cover, storedCoverId]);
  const chooseCover = (file?: File) => {
    setRequestError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setRequestError('Choose a JPEG, PNG or WebP cover image.'); return; }
    setCover(file); uploaded.current = null;
  };
  const save = async (mode: 'draft' | 'submit' | 'publish' = 'submit') => {
    if (lock.current || loading || loadError) return;
    const invalid = validateEvent(form, mode);
    setErrors(invalid); setTouched(Object.fromEntries(Object.keys(form).map(k => [k, true])));
    if (Object.keys(invalid).length) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    lock.current = true; setBusy(true); setRequestError(''); setMessage('');
    try {
      let coverId = ev?.coverFile?.id ?? null;
      if (cover) {
        if (uploaded.current?.file === cover) coverId = uploaded.current.id;
        else {
          const data = new FormData(); data.append('file', cover);
          const response = await apiClient.post<{ data: { id: string } }>('/files/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
          coverId = response.data.data.id; uploaded.current = { file: cover, id: coverId };
        }
      }
      const saved = await eventApi.save(eventPayload(form, mode, coverId, ev?.status), id);
      setEvent(saved); setForm(eventToForm(saved)); setCover(null); uploaded.current = null;
      const text = saved.scheduledPublishDate ? 'Event scheduled.' : saved.status === 'DRAFT' ? 'Draft saved.' : 'Event saved.';
      setMessage(text);
      if (!id) {
        if (saved.status === 'DRAFT' && !saved.scheduledPublishDate) navigate(`/admin/events/${saved.id}/edit`, { replace: true, state: { message: text } });
        else navigate(`/admin/events?tab=${saved.status === 'DRAFT' ? 'drafts' : saved.displayStatus === 'PAST' ? 'past' : 'upcoming'}`, { state: { message: text } });
      }
    } catch (e) {
      const failure = normalizeError(e); setRequestError(failure.message); setErrors(failure.fieldErrors);
    } finally { lock.current = false; setBusy(false); }
  };
  const cancel = async (reason: string, email: boolean) => {
    if (!id || lock.current) return false;
    lock.current = true; setBusy(true); setRequestError('');
    try { const next = await eventApi.cancel(id, reason, email); setEvent(next); setForm(eventToForm(next)); setMessage(email ? 'Event cancelled. Attendee notices queued.' : 'Event cancelled.'); return true; }
    catch (e) { setRequestError(normalizeError(e).message); return false; }
    finally { lock.current = false; setBusy(false); }
  };
  const refreshDelivery = async () => {
    if (!id) return;
    try { const next = await eventApi.detail(id); setEvent(e => e ? { ...e, delivery: next.delivery, failures: next.failures } : e); }
    catch (e) { setRequestError(normalizeError(e).message); }
  };
  return { form, setForm, ev, errors, setErrors, touched, setTouched, loading, loadError, retry: () => setReload(v => v + 1), busy, message, requestError, coverUrl, coverName: cover?.name ?? ev?.coverFile?.name ?? '', chooseCover, save, cancel, refreshDelivery };
}
