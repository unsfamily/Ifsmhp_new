import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Loader2 } from 'lucide-react';
import { attachmentError, downloadAttachment, type ConversationMessage } from '../../api/messaging';
import { attachmentSessionIdentity, SESSION_CHANGED } from '../../api/client';
import ExchangePreview from '../exchange/ExchangePreview';
import { formatBytes } from '../../utils/formatBytes';

export default function ChatAttachment({ file, tone }: { file: ConversationMessage['attachments'][number]; tone: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => { pending.current?.abort(); pending.current = null; setPreview(false); setBusy(false); setError(attachmentSessionIdentity() ? '' : 'Your session has expired. Sign in again to access this attachment.'); };
    window.addEventListener(SESSION_CHANGED, clear);
    return () => { pending.current?.abort(); pending.current = null; window.removeEventListener(SESSION_CHANGED, clear); };
  }, []);
  const download = async () => {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try { await downloadAttachment(file.id, file.name, file.attachmentId, controller.signal); }
    catch (failure) { if (!controller.signal.aborted) setError(attachmentError(failure)); }
    finally { if (pending.current === controller) { pending.current = null; setBusy(false); } }
  };
  return <div className="max-w-full">
    <div className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${tone}`}>
      <button type="button" disabled={busy} onClick={() => void download()} aria-label={`Download ${file.name}`} className="inline-flex min-w-0 items-center gap-1.5 break-all text-left disabled:opacity-60">
        {busy ? <Loader2 aria-hidden="true" className="h-3 w-3 shrink-0 animate-spin" /> : <Download aria-hidden="true" className="h-3 w-3 shrink-0" />}
        {file.name}<span className="shrink-0 opacity-70">· {formatBytes(file.size)}</span>
      </button>
      {['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type) && <button type="button" disabled={busy} onClick={() => setPreview(true)} aria-label={`Preview ${file.name}`} className="ml-1 inline-flex items-center gap-1 border-l border-current/20 pl-2"><Eye aria-hidden="true" className="h-3 w-3" />Preview</button>}
    </div>
    {error && <p role="alert" className="mt-1 text-xs">{error} <button type="button" disabled={busy} onClick={() => void download()} className="underline">Retry</button></p>}
    {preview && <ExchangePreview file={file} close={() => setPreview(false)} opened={() => undefined} />}
  </div>;
}
