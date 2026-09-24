import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { normalizeError } from '../api/client';
import { settingsService as api, settingsChanged, type SettingsSnapshot, type SettingsSection, type SettingsValues } from '../services/settingsService';
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
  const controller = useRef<AbortController | null>(null), version = useRef(0), lock = useRef(false);
  const fail = useCallback((e: unknown) => { const p = normalizeError(e); setError(p.message); setFields(p.fieldErrors); if ([401, 403].includes(p.status ?? 0)) { version.current++; controller.current?.abort(); setDenied(true); setData(null); setDraft(null); } return p; }, []);
  const load = useCallback(async (preserve = true, reviewConflict = false) => {
    if (lock.current) return;
    controller.current?.abort(); const request = new AbortController(); controller.current = request; const n = ++version.current;
    setLoading(true); setError('');
    try { const next = await api.get(request.signal); if (request.signal.aborted || current.current !== identity || n !== version.current) return;
      if (preserve && drafts.current && baseline.current) {
        const saved = baseline.current;
        setDraft(previous => previous ? Object.fromEntries(Object.entries(next.values).map(([k, v]) => [k, JSON.stringify(previous[k as SettingsSection]) !== JSON.stringify(saved.values[k as SettingsSection]) ? previous[k as SettingsSection] : v])) as SettingsValues : next.values);
        // Dirty sections retain the revision they were edited against until explicit conflict review.
        if (!reviewConflict) for (const k of Object.keys(next.sections) as SettingsSection[]) if (JSON.stringify(drafts.current[k]) !== JSON.stringify(saved.values[k])) next.sections[k] = saved.sections[k];
      } else setDraft(next.values);
      setData(next); setLoaded(identity); setDenied(false); if (reviewConflict) setReviewed(true);
    } catch (e) { if (!request.signal.aborted && n === version.current && current.current === identity) fail(e); }
    finally { if (!request.signal.aborted && n === version.current) setLoading(false); }
  }, [identity, fail]);
  useEffect(() => { setData(null); setDraft(null); setDenied(false); setConflict(null); setSuccess(''); setBusy(false); lock.current = false; void load(false); return () => { controller.current?.abort(); }; }, [load]);
  useEffect(() => { const focus = () => { if (!document.hidden && !denied && !conflict) void load(); }; window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, [load, denied, conflict]);
  const save = async (section: SettingsSection) => {
    if (lock.current || denied || conflict || !data || !draft) return;
    lock.current = true; setBusy(true); setSuccess(''); setError(''); setFields({}); controller.current?.abort(); const request = new AbortController(); controller.current = request; const n = ++version.current;
    const values = Object.fromEntries(Object.entries(draft[section]).filter(([key, value]) => value !== (data.values[section] as Record<string, unknown>)[key]));
    try { const next = await api.save(section, data.sections[section].revision, values, request.signal); if (request.signal.aborted || n !== version.current || identity !== current.current) return;
      // Saving one section cannot silently rebase unsaved edits in another section.
      for (const k of Object.keys(next.sections) as SettingsSection[]) if (k !== section && JSON.stringify(draft[k]) !== JSON.stringify(data.values[k])) { next.sections[k] = data.sections[k]; next.values[k] = data.values[k] as never; }
      setData(next); setDraft(d => d ? { ...d, [section]: next.values[section] } : next.values); setSuccess('Settings saved.'); settingsChanged();
    } catch (e) { if (!request.signal.aborted && identity === current.current) { if (fail(e).status === 409) { setConflict(section); setReviewed(false); } } }
    finally { if (identity === current.current) { lock.current = false; setBusy(false); } }
  };
  return { data: loaded === identity && !denied ? data : null, draft: loaded === identity && !denied ? draft : null, setDraft, loading, busy, error, fields, success, denied, conflict, reviewed, load, save, fail, confirmReview: () => { setConflict(null); setReviewed(false); setError(''); } };
}
