import { CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ReactNode } from 'react';
import Button from '../common/Button';
import type { PaginationMeta } from '../../types/community';

export const panelClass = 'rounded-xl border border-paper-border bg-paper-raised shadow-sm';
export const controlClass = 'rounded-md border border-paper-border bg-paper-raised px-3 py-2 text-sm text-forum-900 focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600/20';
export const formatDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
export const formatShortDate = (value?: string) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '—';

export function PageHeading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-ink-muted">{description}</p></div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}

export function CommunityPagination({ meta, onPage }: { meta: PaginationMeta; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-border px-4 py-3 text-sm text-ink-muted"><span>{meta.total.toLocaleString()} results</span><div className="flex items-center gap-2"><Button title="Previous page" aria-label="Previous page" size="sm" variant="ghost" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Page {meta.page} of {Math.max(meta.pages, 1)}</span><Button title="Next page" aria-label="Next page" size="sm" variant="ghost" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div>;
}

export function CommunityToast({ message, error = false, close }: { message: string; error?: boolean; close: () => void }) {
  return <div role="status" className={`fixed right-4 top-4 z-[80] flex max-w-sm items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-xl ${error ? 'bg-danger-700' : 'bg-forum-900'}`}><CheckCircle2 className="h-4 w-4 shrink-0" /><span>{message}</span><button type="button" aria-label="Close notification" onClick={close}><X className="h-4 w-4" /></button></div>;
}

export function Drawer({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}><button aria-label="Close details" className="absolute inset-0 bg-forum-950/50" onClick={close} /><aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-paper-raised shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-paper-border bg-paper-raised px-5 py-4"><h2 className="font-display text-xl font-semibold text-forum-900">{title}</h2><button type="button" title="Close" aria-label="Close" onClick={close} className="rounded-md p-2 text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button></div><div className="p-5">{children}</div></aside></div>;
}
