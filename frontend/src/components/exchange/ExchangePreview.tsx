import { useEffect, useRef, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { attachmentError, downloadAttachment, fetchAttachment } from '../../api/messaging';
import { SESSION_CHANGED } from '../../api/client';
import { ExchangeModal } from './ExchangeDialog';
import Button from '../common/Button';
import { formatBytes } from '../../utils/formatBytes';

export interface PreviewDocument { id: string; attachmentId?: string; name: string; type: string; size: number }
export default function ExchangePreview({ file, close, opened }: { file: PreviewDocument; close: () => void; opened: () => void }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const transfer = useRef<AbortController | null>(null);
  const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const clear = () => { transfer.current?.abort(); setUrl(''); setText(null); closeRef.current(); };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => { transfer.current?.abort(); window.removeEventListener(SESSION_CHANGED, clear); };
  }, [file.id, file.attachmentId]);
  const [retry, setRetry] = useState(0);
  const supported = file.type === 'application/pdf' || ['image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv'].includes(file.type);
  useEffect(() => {
    setUrl(''); setText(null); setBusy(false); setError('');
    if (!supported) return;
    const controller = new AbortController();
    let alive = true;
    let objectUrl = '';
    setBusy(true); setError('');
    fetchAttachment(file.id, file.attachmentId, 'preview', controller.signal).then(async blob => {
      if (!alive) return;
      if (file.type.startsWith('text/')) { const value = await blob.text(); if (alive) setText(value); }
      else { objectUrl = URL.createObjectURL(new Blob([blob], { type: file.type })); setUrl(objectUrl); }
      if (alive) opened();
    }).catch(e => { if (alive) setError(attachmentError(e)); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
    // The receipt callback refreshes data but must not fetch the file again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, file.attachmentId, file.type, supported, retry]);
  const download = async () => {
    if (transfer.current) return;
    const controller = new AbortController(); transfer.current = controller;
    setBusy(true); setError('');
    try { await downloadAttachment(file.id, file.name, file.attachmentId, controller.signal); if (!controller.signal.aborted) opened(); }
    catch (failure) { if (!controller.signal.aborted) setError(attachmentError(failure)); }
    finally { if (transfer.current === controller) transfer.current = null; if (!controller.signal.aborted) setBusy(false); }
  };
  return <ExchangeModal title={file.name} close={close} wide>
    <p className="mb-4 text-xs text-ink-muted">{file.type} / {formatBytes(file.size)}</p>
    {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading...</p>}
    {error && <p role="alert" className="my-3 text-sm text-danger-600">{error} {supported && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRetry(n => n + 1)}>Retry</Button>}</p>}
    {!supported && <p className="my-6 text-sm text-ink-muted">Preview is unavailable for this format.</p>}
    {url && (file.type === 'application/pdf' ? <iframe title={file.name} src={url} className="h-[60dvh] w-full" /> : <img src={url} alt={file.name} className="mx-auto max-h-[60dvh] max-w-full object-contain" />)}
    {text !== null && <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-words bg-paper p-4 text-sm">{text}</pre>}
    <Button className="mt-4" disabled={busy} onClick={() => void download()}><Download className="h-4 w-4" />Download</Button>
  </ExchangeModal>;
}
