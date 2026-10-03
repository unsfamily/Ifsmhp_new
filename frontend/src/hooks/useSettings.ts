import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeError } from '../api/client';
import { settingsService as api, settingsChanged, type SettingsSnapshot, type SettingsSection, type SettingsValues } from '../services/settingsService';

/** Keep each draft paired with the values and revision it was edited against. */
function reconcile(next: SettingsSnapshot, saved: SettingsSnapshot, draft: SettingsValues, reviewedSection?: SettingsSection, savedSection?: SettingsSection) {
  const data = { ...next, values: { ...next.values }, sections: { ...next.sections } };
  const values = { ...next.values };
  for (const section of Object.keys(next.sections) as SettingsSection[]) {
    const dirty = JSON.stringify(draft[section]) !== JSON.stringify(saved.values[section]);
    if (!dirty || section === savedSection) continue;
    values[section] = draft[section] as never;
    if (section !== reviewedSection) {
      data.values[section] = saved.values[section] as never;
      data.sections[section] = saved.sections[section];
    }
  }
  return { data, draft: values };
}

export function useSettings() {
  const { user } = useAuth();
  const identity = `${user?.id}:${user?.role}:${user?.status}`;
  const current = useRef(identity); current.current = identity;
  const [data, setData] = useState<SettingsSnapshot | null>(null), [draft, setDraft] = useState<SettingsValues | null>(null);
  const drafts = useRef(draft); drafts.current = draft;
  const baseline = useRef(data); baseline.current = data;
  const [loaded, setLoaded] = useState(identity), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [denied, setDenied] = useState(false);
  const [error, setError] = useState(''), [fields, setFields] = useState<Record<string, string>>({}), [success, setSuccess] = useState('');
  const [conflict, setConflict] = useState<SettingsSection | null>(null), [reviewed, setReviewed] = useState(false);
  const conflictRef = useRef(conflict); conflictRef.current = conflict;
  const controller = useRef<AbortController | null>(null), version = useRef(0), lock = useRef(false);
  const fail = useCallback((e: unknown) => {
    const p = normalizeError(e); setError(p.message); setFields(p.fieldErrors);
    if ([401, 403].includes(p.status ?? 0)) {
      version.current++; controller.current?.abort(); lock.current = false;
      baseline.current = null; drafts.current = null;
      setDenied(true); setData(null); setDraft(null); setLoading(false); setBusy(false); setConflict(null); setReviewed(false); setSuccess('');
    }
    return p;
  }, []);
  const load = useCallback(async (preserve = true, reviewConflict = false) => {
    if (lock.current) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request; const n = ++version.current;
    const reviewedSection = reviewConflict ? conflictRef.current ?? undefined : undefined;
    const ownsRequest = () => !request.signal.aborted && current.current === identity && n === version.current;
    setLoading(true); setError('');
    try {
      const next = await api.get(request.signal); if (!ownsRequest()) return;
      const merged = preserve && drafts.current && baseline.current
        ? reconcile(next, baseline.current, drafts.current, reviewedSection)
        : { data: next, draft: next.values };
      setData(merged.data); setDraft(merged.draft); setLoaded(identity); setDenied(false);
      if (reviewedSection) setReviewed(true);
    } catch (e) { if (ownsRequest()) fail(e); }
    finally { if (ownsRequest()) setLoading(false); }
  }, [identity, fail]);
  useEffect(() => {
    baseline.current = null; drafts.current = null; conflictRef.current = null;
    setData(null); setDraft(null); setDenied(false); setConflict(null); setReviewed(false); setSuccess(''); setFields({}); setBusy(false); lock.current = false;
    void load(false);
    return () => { controller.current?.abort(); };
  }, [load]);
  useEffect(() => { const focus = () => { if (!document.hidden && !denied && !conflict) void load(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, denied, conflict]);
  const save = async (section: SettingsSection) => {
    if (lock.current || denied || conflict || !data || !draft) return;
    lock.current = true; setBusy(true); setLoading(false); setSuccess(''); setError(''); setFields({}); controller.current?.abort(); const request = new AbortController(); controller.current = request; const n = ++version.current;
    const ownsRequest = () => !request.signal.aborted && current.current === identity && n === version.current;
    const values = Object.fromEntries(Object.entries(draft[section]).filter(([key, value]) => value !== (data.values[section] as Record<string, unknown>)[key]));
    try {
      const next = await api.save(section, data.sections[section].revision, values, request.signal); if (!ownsRequest()) return;
      const merged = reconcile(next, data, draft, undefined, section);
      setData(merged.data); setDraft(merged.draft); setSuccess('Settings saved.'); settingsChanged();
    } catch (e) { if (ownsRequest() && fail(e).status === 409) { setConflict(section); setReviewed(false); } }
    finally { if (ownsRequest()) { lock.current = false; setBusy(false); } }
  };
  return { data: loaded === identity && !denied ? data : null, draft: loaded === identity && !denied ? draft : null, setDraft, loading, busy, error, fields, success, denied, conflict, reviewed, load, save, fail, confirmReview: () => { setConflict(null); setReviewed(false); setError(''); } };
}
