import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import Button from '../common/Button';

export default function SupportPagination({ page, pages, total, onPage, error, onRetry }: {
  page: number; pages: number; total?: number; onPage: (page: number) => void; error?: string | null; onRetry: () => void;
}) {
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
    {error ? <span role="alert" className="text-danger-600">{error} <Button size="sm" variant="ghost" onClick={onRetry}><RefreshCw className="h-4 w-4" />Retry</Button></span> : <span>{total === undefined ? 'Loading...' : `${total} requests`}</span>}
    {pages > 1 && <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" aria-label="Previous page" title="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
      <span>Page {page} of {pages}</span>
      <Button size="sm" variant="ghost" aria-label="Next page" title="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
    </div>}
  </div>;
}
