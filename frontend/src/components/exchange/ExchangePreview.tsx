import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { downloadAttachment, fetchAttachment } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { ExchangeModal } from './ExchangeDialog';
import Button from '../common/Button';
import { formatBytes } from '../../utils/formatBytes';

export interface PreviewDocument { id: string; attachmentId?: string; name: string; type: string; size: number }
export default function ExchangePreview({ file, close, opened }: { file: PreviewDocument; close: () => void; opened: () => void }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const supported = file.type === 'application/pdf' || ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv'].includes(file.type);
  useEffect(() => {
    if (!supported) return;
    let alive = true;
    let objectUrl = '';
    setBusy(true); setError('');
    fetchAttachment(file.id, file.attachmentId).then(async blob => {
      if (!alive) return;
      if (file.type.startsWith('text/')) { const value = await blob.text(); if (alive) setText(value); }
      else { objectUrl = URL.createObjectURL(new Blob([blob], { type: file.type })); setUrl(objectUrl); }
      if (alive) opened();
    }).catch(e => { if (alive) setError(normalizeError(e).status === 404 ? 'This document is no longer available.' : 'Could not load this document. Please retry.'); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // The receipt callback refreshes data but must not fetch the file again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, file.attachmentId, file.type, supported, retry]);
  const download = async () => {
    setBusy(true); setError('');
    try { await downloadAttachment(file.id, file.name, file.attachmentId); opened(); }
    catch { setError('Could not download this document. Please retry.'); }
    finally { setBusy(false); }
  };
  return <ExchangeModal title={file.name} close={close} wide>
    <p className="mb-4 text-xs text-ink-muted">{file.type} / {formatBytes(file.size)}</p>
    {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading...</p>}
    {error && <p role="alert" className="my-3 text-sm text-danger-600">{error} {supported && <Button size="sm" variant="ghost" onClick={() => setRetry(n => n + 1)}>Retry</Button>}</p>}
    {!supported && <p className="my-6 text-sm text-ink-muted">Preview is unavailable for this format.</p>}
    {url && (file.type === 'application/pdf' ? <iframe title={file.name} src={url} className="h-[60dvh] w-full" /> : <img src={url} alt={file.name} className="mx-auto max-h-[60dvh] max-w-full object-contain" />)}
    {text !== null && <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words bg-paper p-4 text-sm">{text}</pre>}
    <Button className="mt-4" disabled={busy} onClick={() => void download()}><Download className="h-4 w-4" />Download</Button>
  </ExchangeModal>;
}
