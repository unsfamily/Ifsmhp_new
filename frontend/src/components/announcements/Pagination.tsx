import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect } from 'react';
import type { Page } from '../../api/announcements';
export default function Pagination({ meta, page, limit, setPage, setLimit }: { meta: Page<unknown>['pagination']; page: number; limit: number; setPage: (page: number) => void; setLimit: (limit: number) => void }) {
  useEffect(() => { if (meta.page === page && page > meta.pages) setPage(meta.pages); }, [meta.page, meta.pages, page, setPage]);
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-border pt-4 text-xs text-ink-muted">
    <span>{meta.total.toLocaleString()} results</span>
    <div className="flex items-center gap-3">
      <select aria-label="Rows per page" value={limit} onChange={e => setLimit(Number(e.target.value))} className="rounded-md border border-paper-border bg-paper-raised p-2">{[10, 25, 50].map(n => <option key={n} value={n}>{n} per page</option>)}</select>
      <button title="Previous page" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
      <span>{page} / {meta.pages}</span>
      <button title="Next page" aria-label="Next page" disabled={page >= meta.pages} onClick={() => setPage(page + 1)} className="p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
    </div>
  </div>;
}
