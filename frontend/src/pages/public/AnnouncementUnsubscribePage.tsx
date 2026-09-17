import { useState } from 'react';
import { notificationsApi } from '../../api/notifications';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import Button from '../../components/common/Button';
export default function AnnouncementUnsubscribePage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const preference = useApiData(() => notificationsApi.preference(token), [token]);
  const submit = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try { await notificationsApi.unsubscribe(token); setDone(true); } catch (e) { setError(normalizeError(e).message); } finally { setBusy(false); }
  };
  return <main className="mx-auto max-w-xl space-y-5 px-5 py-16"><h1 className="font-display text-2xl font-semibold text-forum-900">Announcement Email Preferences</h1>
    {preference.loading && <p role="status">Loading preference...</p>}
    {(error || preference.error) && <p role="alert" className="text-sm text-danger-600">{error || preference.error}</p>}
    {done || preference.data?.emailEnabled === false ? <p role="status">Announcement emails are disabled. Account and operational emails are unaffected.</p> : preference.data && <><p className="text-sm text-ink-muted">Unsubscribe from announcement emails? Account and operational emails are unaffected.</p><Button disabled={busy} onClick={() => void submit()}>{busy ? 'Updating...' : 'Unsubscribe from announcements'}</Button></>}
  </main>;
}
