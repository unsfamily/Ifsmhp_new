import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2, RefreshCw, Upload, X } from 'lucide-react';
import Button from '../common/Button';
import { exchangeApi, exchangeSendSchema, type ExchangeSend, type ExchangeSummary } from '../../api/documentExchange';
import { normalizeError } from '../../api/client';
import { formatBytes } from '../../utils/formatBytes';

export function ExchangeModal({ title, close, busy = false, children, wide = false }: { title: string; close: () => void; busy?: boolean; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} onCancel={e => { e.preventDefault(); if (!busy) close(); }} aria-label={title}
    className={`m-auto max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-black/50 ${wide ? 'max-w-4xl' : 'max-w-md'}`}>
    <div className="mb-4 flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-lg font-semibold text-forum-900">{title}</h3>
      <button type="button" disabled={busy} title="Close" aria-label="Close" onClick={close} className="shrink-0 p-1 text-ink-muted disabled:opacity-50"><X className="h-5 w-5" /></button></div>
    {children}
  </dialog>;
}

type UploadRow = { key: string; file: File; id?: string; progress: number; busy: boolean; error?: string };
const inputClass = 'mt-1 mb-3 w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600';
const titles = { document: 'Upload Documents', message: 'Send Message to CRO', video: 'Share Video Link', meeting: 'Request Meeting' };
export default function ExchangeDialog({ type, constraints, close, sent }: { type: ExchangeSend['type']; constraints: ExchangeSummary['upload']; close: () => void; sent: () => void }) {
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [subject, setSubject] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [files, setFiles] = useState<UploadRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const lock = useRef(false);
  const request = useRef({ id: crypto.randomUUID(), payload: '' });
  const busy = sending || files.some(f => f.busy);
  const change = (field: string) => { setError(null); setFields(current => ({ ...current, [field]: '' })); };
  const fieldError = (name: string) => fields[name] ? <p role="alert" className="mb-3 text-xs text-danger-600">{fields[name]}</p> : null;
  const upload = async (row: UploadRow) => {
    const patch = (values: Partial<UploadRow>) => setFiles(current => current.map(f => f.key === row.key ? { ...f, ...values } : f));
    patch({ busy: true, error: undefined, progress: 0 });
    try { const uploaded = await exchangeApi.upload(row.file, progress => patch({ progress })); patch({ id: uploaded.id, busy: false, progress: 100 }); }
    catch (e) { patch({ busy: false, error: normalizeError(e).fieldErrors.file ?? normalizeError(e).message }); }
  };
  const selectFiles = (selected: FileList) => {
    change('fileIds');
    if (files.length + selected.length > constraints.maxFiles) { setError(`Choose up to ${constraints.maxFiles} files.`); return; }
    const chosen = Array.from(selected);
    for (const file of chosen) {
      if (!file.size || file.size > constraints.maxBytes || !constraints.extensions.includes(file.name.split('.').pop()?.toLowerCase() ?? '') || (file.type && !constraints.mimeTypes.includes(file.type))) {
        setError(`${file.name}: choose a supported, non-empty document up to ${formatBytes(constraints.maxBytes)}.`); return;
      }
    }
    const rows = chosen.map(file => ({ key: crypto.randomUUID(), file, progress: 0, busy: true }));
    setFiles(current => [...current, ...rows]);
    rows.forEach(row => { void upload(row); });
  };
  const submit = async () => {
    if (lock.current || busy) return;
    const payload = type === 'document' ? { type, fileIds: files.flatMap(f => f.id ? [f.id] : []), note: body }
      : type === 'message' ? { type, body } : type === 'video' ? { type, url } : { type, subject, dateTime, timezone };
    const signature = JSON.stringify(payload);
    if (request.current.payload !== signature) request.current = { id: crypto.randomUUID(), payload: signature };
    const parsed = exchangeSendSchema.safeParse({ ...payload, clientRequestId: request.current.id });
    if (!parsed.success) { setFields(Object.fromEntries(parsed.error.issues.map(i => [String(i.path[0]), i.message]))); return; }
    if (files.some(f => !f.id)) { setError('Retry or remove failed uploads before sharing.'); return; }
    lock.current = true; setSending(true); setError(null); setFields({});
    try { await exchangeApi.send(parsed.data); sent(); }
    catch (e) { const problem = normalizeError(e); setError(problem.message); setFields(problem.fieldErrors); }
    finally { lock.current = false; setSending(false); }
  };
  return <ExchangeModal title={titles[type]} close={close} busy={busy}>
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      {error && <p role="alert" className="mb-4 rounded-lg border border-danger-600/20 bg-danger-100 p-3 text-sm text-danger-600">{error}</p>}
      <fieldset disabled={sending} className="min-w-0">
        {type === 'document' && <>
          <label className="block text-sm font-medium">Documents<input aria-label="Documents" type="file" multiple disabled={busy} accept={constraints.extensions.map(e => `.${e}`).join(',')} className="my-3 block w-full text-sm" onChange={e => { if (e.target.files) selectFiles(e.target.files); e.target.value = ''; }} /></label>
          <p className="mb-3 text-xs text-ink-muted">Up to {constraints.maxFiles} files, {formatBytes(constraints.maxBytes)} each</p>
          {files.map(f => <div key={f.key} className="mb-3 border-b border-paper-border pb-3 text-sm">
            <div className="flex items-start gap-2"><span className="min-w-0 flex-1 break-all">{f.file.name}</span>
              {f.error && <button type="button" aria-label={`Retry ${f.file.name}`} title="Retry upload" onClick={() => void upload(f)}><RefreshCw className="h-4 w-4" /></button>}
              <button type="button" disabled={f.busy} aria-label={`Remove ${f.file.name}`} title="Remove file" onClick={() => { setFiles(current => current.filter(item => item.key !== f.key)); change('fileIds'); }}><X className="h-4 w-4" /></button></div>
            {f.busy ? <progress aria-label={`Uploading ${f.file.name}`} max={100} value={f.progress} className="mt-2 w-full" /> : <p className={`mt-1 text-xs ${f.error ? 'text-danger-600' : 'text-success-600'}`}>{f.error ?? 'Uploaded'}</p>}
          </div>)}
          {fieldError('fileIds')}
        </>}
        {(type === 'document' || type === 'message') && <><label className="block text-sm font-medium">{type === 'document' ? 'Note (optional)' : 'Message'}<textarea aria-label={type === 'document' ? 'Note (optional)' : 'Message'} value={body} maxLength={10000} onChange={e => { setBody(e.target.value); change(type === 'document' ? 'note' : 'body'); }} className={`${inputClass} h-32 resize-y`} /></label>{fieldError(type === 'document' ? 'note' : 'body')}</>}
        {type === 'video' && <><label className="block text-sm font-medium">Video URL<input type="url" value={url} maxLength={2048} onChange={e => { setUrl(e.target.value); change('url'); }} className={inputClass} placeholder="https://" /></label>{fieldError('url')}</>}
        {type === 'meeting' && <>
          <label className="block text-sm font-medium">Meeting subject<input value={subject} maxLength={200} onChange={e => { setSubject(e.target.value); change('subject'); }} className={inputClass} /></label>{fieldError('subject')}
          <label className="block text-sm font-medium">Proposed date and time<input type="datetime-local" value={dateTime} onChange={e => { setDateTime(e.target.value); change('dateTime'); }} className={inputClass} /></label>{fieldError('dateTime')}
          <label className="block text-sm font-medium">Timezone<input value={timezone} onChange={e => { setTimezone(e.target.value); change('timezone'); }} className={inputClass} /></label>{fieldError('timezone')}
          <p className="mb-4 text-xs text-ink-muted">Proposed appointment, pending confirmation from CRO.</p>
        </>}
      </fieldset>
      <div className="mt-2 flex gap-3"><Button disabled={busy} onClick={close} variant="outline" className="flex-1">Cancel</Button><Button type="submit" disabled={busy || files.some(f => !!f.error)} className="flex-1">
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : type === 'document' ? <Upload className="h-4 w-4" /> : null}
        {sending ? 'Sending...' : type === 'document' || type === 'video' ? 'Share' : type === 'meeting' ? 'Request' : 'Send'}</Button></div>
    </form>
  </ExchangeModal>;
}
