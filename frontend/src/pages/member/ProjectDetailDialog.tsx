import { useEffect, useRef } from 'react';
import { AlertCircle, Eye, FileText, Link as LinkIcon, RefreshCw, X } from 'lucide-react';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { memberApi, type MemberProjectDetail } from '../../api/member';
import { useApiData } from '../../hooks/useApiData';

function formatDate(value: string | null, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, options).format(new Date(value));
  } catch {
    return '—';
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectDetailDialog({ projectId, title, onClose }: {
  projectId: string;
  /** Shown while the detail request is still in flight, so the dialog is never untitled. */
  title: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { data, loading, error } = useApiData<MemberProjectDetail>(() => memberApi.project(projectId), [projectId]);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="project-detail-title"
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-forum-900/50"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
    >
      <div className="mb-5 flex items-start justify-between gap-4">
        <h2 id="project-detail-title" className="font-display text-lg font-semibold text-forum-900 leading-snug">
          {data?.title ?? title}
        </h2>
        <Button type="button" variant="ghost" size="sm" aria-label="Close project detail" title="Close" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-5 w-32 rounded border border-paper-border bg-paper animate-pulse" />
          <div className="h-24 rounded border border-paper-border bg-paper animate-pulse" />
          <div className="h-16 rounded border border-paper-border bg-paper animate-pulse" />
        </div>
      )}

      {!loading && error && (
        <div className="py-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-danger-600" />
          <p className="mt-3 text-sm text-danger-600">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{data.category}</Badge>
            <Badge variant="default">{data.status}</Badge>
            {data.support.map((kind) => <Badge key={kind} variant="brass">{kind}</Badge>)}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Description</p>
            <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">{data.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Submitted</p>
              <p className="mt-0.5 text-ink-muted">{formatDate(data.submitted)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Last Updated</p>
              <p className="mt-0.5 text-ink-muted">{formatDate(data.updated)}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Timeline</p>
              <p className="mt-0.5 text-ink-muted">{data.timeline || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Budget</p>
              <p className="mt-0.5 text-ink-muted">{data.budget || '—'}</p>
            </div>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-ink-subtle">
            <Eye className="h-3.5 w-3.5" />
            {data.views.toLocaleString()} views
          </p>

          {data.files.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Attachments</p>
              <ul className="mt-2 space-y-1.5">
                {data.files.map((file) => (
                  <li key={file.id} className="flex items-center gap-2 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                    <span className="min-w-0 flex-1 truncate text-ink-muted" title={file.name}>{file.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-ink-subtle">{formatSize(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.resourceLinks.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Resources</p>
              <ul className="mt-2 space-y-1.5">
                {data.resourceLinks.map((link) => (
                  <li key={link.id} className="flex items-center gap-2 rounded-md border border-paper-border bg-paper px-3 py-2 text-sm">
                    <LinkIcon className="h-4 w-4 shrink-0 text-ink-subtle" />
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-forum-700 underline underline-offset-2 hover:text-forum-900"
                      title={link.url}
                    >
                      {link.label ?? link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.history.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Status History</p>
              <ul className="mt-2 space-y-2">
                {data.history.map((entry) => (
                  <li key={entry.id} className="flex items-start gap-3 text-sm">
                    <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                    <div>
                      <p className="text-ink-muted">
                        {entry.fromStatus ? `${entry.fromStatus} → ${entry.toStatus}` : entry.toStatus}
                      </p>
                      {entry.note && <p className="text-xs text-ink-subtle">{entry.note}</p>}
                      <p className="text-xs text-ink-subtle">{formatDate(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
    </dialog>
  );
}
