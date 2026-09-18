import { useEffect, useState } from 'react';
import { AlertCircle, Download, Loader2, Printer, X } from 'lucide-react';
import Button from '../common/Button';
import Pagination from '../announcements/Pagination';
import { useApiData } from '../../hooks/useApiData';
import { normalizeError } from '../../api/client';
import { reportsApi, type ReportRange, type ReportRow } from '../../api/reports';

/**
 * Shows one report's rows over the page.
 *
 * A modal rather than a route so the reports grid behind it is untouched. The
 * `report-print-root` class is what the print stylesheet keys on so printing
 * emits the report alone.
 */
export default function ReportViewerModal({ reportKey, title, range, close }: {
  reportKey: string;
  title: string;
  range: ReportRange;
  close: () => void;
}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const view = useApiData(() => reportsApi.rows(reportKey, range, page, limit), [reportKey, range.from, range.to, page, limit]);
  const data = view.data;

  // Escape closes, and the page behind must not scroll while this is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [close]);

  const download = async () => {
    setBusy(true); setActionError('');
    try { await reportsApi.download(reportKey, range); }
    catch (error) { setActionError(normalizeError(error).message); }
    finally { setBusy(false); }
  };

  const cell = (row: ReportRow, key: string) => {
    const value = row[key];
    if (value === null || value === undefined || value === '') return <span className="text-ink-subtle">—</span>;
    return typeof value === 'number' ? value.toLocaleString() : value;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-6 report-print-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-print-root w-full max-w-5xl rounded-xl border border-paper-border bg-paper-raised shadow-lg">
        <div className="flex items-start justify-between gap-3 border-b border-paper-border p-5">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-forum-900">{title}</h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              {data ? `${data.samplePeriod} · ${data.pagination.total.toLocaleString()} row${data.pagination.total === 1 ? '' : 's'}` : 'Loading…'}
            </p>
          </div>
          <button title="Close" aria-label="Close" onClick={close} className="shrink-0 rounded p-1.5 text-ink-muted hover:bg-forum-50 report-print-hide">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5">
          {actionError && (
            <p role="alert" className="mb-3 flex items-center gap-2 rounded-md bg-danger-100 px-3 py-2 text-sm text-danger-600 report-print-hide">
              <AlertCircle className="h-4 w-4 shrink-0" />{actionError}
            </p>
          )}

          {view.loading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded bg-forum-50" />)}
            </div>
          )}

          {!view.loading && view.error && (
            <div className="py-10 text-center">
              <AlertCircle className="mx-auto h-6 w-6 text-danger-600" />
              <p className="mt-2 text-sm text-ink">{view.error}</p>
            </div>
          )}

          {!view.loading && !view.error && data && data.items.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-muted">No data for this period. Try a wider date range.</p>
          )}

          {!view.loading && !view.error && data && data.items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-paper-border">
                    {data.columns.map(column => (
                      <th key={column.key} className="whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row, index) => (
                    <tr key={index} className="border-b border-paper-border/60 last:border-0">
                      {data.columns.map(column => (
                        <td key={column.key} className="px-3 py-2 text-ink">{cell(row, column.key)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.pagination.total > 0 && (
            <div className="report-print-hide">
              <Pagination meta={data.pagination} page={page} limit={limit} setPage={setPage} setLimit={setLimit} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-paper-border bg-paper p-4 report-print-hide">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button variant="primary" size="sm" disabled={busy || !data?.pagination.total} onClick={() => void download()}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}
