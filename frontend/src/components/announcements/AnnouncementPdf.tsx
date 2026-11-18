import { useState } from 'react';
import { FileText } from 'lucide-react';
import { normalizeError } from '../../api/client';
import Button from '../common/Button';

export default function AnnouncementPdf({ name, sizeBytes, load }: { name: string; sizeBytes: number; load: () => Promise<Blob> }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const download = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const blob = await load();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(normalizeError(e).message);
    } finally {
      setBusy(false);
    }
  };
  return <div className="mt-4 rounded-md border border-paper-border bg-paper px-3 py-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-2 text-sm text-forum-900"><FileText className="h-4 w-4 shrink-0 text-brass-700" /><span className="break-all">{name}</span><span className="text-xs text-ink-muted">{(sizeBytes / 1024).toFixed(0)} KB</span></p>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void download()}>{busy ? 'Downloading...' : 'Download PDF'}</Button>
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-danger-600">{error}</p>}
  </div>;
}
