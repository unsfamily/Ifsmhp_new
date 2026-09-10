import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Link2, Loader2, Paperclip, RefreshCw, X } from 'lucide-react';
import Button from '../common/Button';
import { formatBytes } from '../../utils/formatBytes';
import { CHAT_ACCEPT, MAX_UPLOAD_MB, type Attachment } from '../../hooks/useAttachments';

export interface PendingLink {
  key: string;
  url: string;
  label?: string;
}

/**
 * The attach row that sits under a chat composer.
 *
 * Deliberately not the shared `FileInput` — that renders a tall dashed drop
 * zone, which is right for a form and wrong under a message box. Here the
 * trigger is a paperclip and the picker input stays hidden.
 */
export function ComposerAttachments({
  attachments,
  fileError,
  links,
  disabled,
  onAddFiles,
  onRemoveFile,
  onRetryFile,
  onAddLink,
  onRemoveLink,
}: {
  attachments: Attachment[];
  fileError: string | null;
  links: PendingLink[];
  disabled?: boolean;
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (key: string) => void;
  onRetryFile: (attachment: Attachment) => void;
  onAddLink: (url: string, label?: string) => string | null;
  onRemoveLink: (key: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  const submitLink = () => {
    const problem = onAddLink(url.trim(), label.trim() || undefined);
    if (problem) {
      setLinkError(problem);
      return;
    }
    setUrl('');
    setLabel('');
    setLinkError(null);
    setLinkOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-forum-50 hover:text-forum-700 disabled:opacity-50"
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attach File
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setLinkOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-2.5 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:bg-forum-50 hover:text-forum-700 disabled:opacity-50"
        >
          <Link2 className="h-3.5 w-3.5" />
          Share Link
        </button>
        <span className="text-[11px] text-ink-subtle">Up to 5 files, {MAX_UPLOAD_MB} MB each</span>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={CHAT_ACCEPT}
          className="hidden"
          onChange={(event) => {
            if (event.target.files?.length) onAddFiles(event.target.files);
            event.target.value = ''; // allow re-picking the same file
          }}
        />
      </div>

      {/*
        The link form stacks rather than sitting on one row: this bar also lives
        inside the narrow left column of the split view, where a row of two
        inputs plus a button overflows the card and pushes the button beneath
        the neighbouring panel, where it cannot be clicked.
      */}
      {linkOpen && (
        <div className="rounded-lg border border-paper-border bg-paper p-3 space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setLinkError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitLink(); } }}
            placeholder="https://example.com/video"
            className="w-full rounded-md border border-paper-border bg-paper-raised px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600/20"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="min-w-0 flex-1 rounded-md border border-paper-border bg-paper-raised px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600/20"
            />
            <Button size="sm" variant="outline" onClick={submitLink} disabled={!url.trim()} className="shrink-0">Add</Button>
          </div>
          {linkError && <p className="text-xs text-danger-600">{linkError}</p>}
        </div>
      )}

      {fileError && <p className="text-xs text-danger-600">{fileError}</p>}

      {(attachments.length > 0 || links.length > 0) && (
        <div className="space-y-1.5">
          {attachments.map((a) => {
            const failed = a.status === 'failed';
            return (
              <div
                key={a.key}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
                  failed ? 'border-danger-600/30 bg-danger-100' : 'border-paper-border bg-paper-raised'
                }`}
              >
                {a.status === 'uploading'
                  ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-forum-600" />
                  : failed
                    ? <AlertCircle className="h-4 w-4 shrink-0 text-danger-600" />
                    : <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />}
                <p className="truncate text-ink-muted" title={a.name}>{a.name}</p>
                <p className={`ml-auto shrink-0 text-xs ${failed ? 'text-danger-600' : 'text-ink-subtle'}`}>
                  {a.status === 'uploading' ? 'Uploading…' : failed ? a.error : formatBytes(a.sizeBytes)}
                </p>
                {failed && (
                  <button
                    type="button"
                    onClick={() => onRetryFile(a)}
                    className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-danger-600 hover:bg-danger-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => onRemoveFile(a.key)}
                  disabled={a.status === 'uploading'}
                  className="shrink-0 rounded p-0.5 text-ink-subtle hover:bg-forum-50 hover:text-forum-700 disabled:opacity-40"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}

          {links.map((l) => (
            <div key={l.key} className="flex items-center gap-2 rounded-md border border-paper-border bg-paper-raised px-3 py-1.5 text-sm">
              <Link2 className="h-4 w-4 shrink-0 text-forum-600" />
              <p className="truncate text-ink-muted" title={l.url}>{l.label ?? l.url}</p>
              <button
                type="button"
                aria-label={`Remove ${l.url}`}
                onClick={() => onRemoveLink(l.key)}
                className="ml-auto shrink-0 rounded p-0.5 text-ink-subtle hover:bg-forum-50 hover:text-forum-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
