import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  FileText,
  Download,
  Calendar,
  Users,
  FolderKanban,
  Globe2,
  Headphones,
  MessageSquare,
  CalendarClock,
  ChevronRight,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  FileSpreadsheet,
  Mail,
  AlertCircle,
  Search,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { useApiData } from '../../hooks/useApiData';
import { normalizeError } from '../../api/client';
import ReportViewerModal from '../../components/reports/ReportViewerModal';
import { reportsApi, type ReportCadence, type ReportCategory, type ReportTile } from '../../api/reports';

const categoryIcon: Record<ReportCategory, typeof Users> = {
  Membership: Users,
  Publications: Globe2,
  Support: Headphones,
  Engagement: MessageSquare,
  Platform: BarChart3,
  Finance: FileSpreadsheet,
};

const cadenceBadge: Record<ReportCadence, 'info' | 'brass' | 'warning' | 'default' | 'success'> = {
  Weekly: 'info',
  Monthly: 'brass',
  Quarterly: 'warning',
  'On-demand': 'default',
  'Real-time': 'success',
};

// These maps are exhaustive over the current unions, so an unexpected value
// from the API would otherwise render `undefined` as a component and throw.
const iconFor = (category: ReportCategory) => categoryIcon[category] ?? BarChart3;
const badgeFor = (cadence: ReportCadence) => cadenceBadge[cadence] ?? 'default';

const PERIODS = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'Custom'] as const;
type Period = (typeof PERIODS)[number];

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
/** Translates the period dropdown into the bounds the API expects. */
function boundsFor(period: Period, customFrom: string, customTo: string) {
  if (period === 'Custom') return { from: customFrom || undefined, to: customTo || undefined };
  const days = period === 'Last 7 days' ? 7 : period === 'Last 90 days' ? 90 : 30;
  const to = new Date();
  return { from: isoDay(new Date(to.getTime() - days * 86_400_000)), to: isoDay(to) };
}

export default function AdminReportsPage() {
  const [category, setCategory] = useState<'All' | ReportCategory>('All');
  const [period, setPeriod] = useState<Period>('Last 30 days');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewing, setViewing] = useState<ReportTile | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const range = useMemo(() => boundsFor(period, customFrom, customTo), [period, customFrom, customTo]);
  // A half-entered custom range would otherwise refetch on every keystroke.
  const ready = period !== 'Custom' || Boolean(customFrom && customTo);
  const invalidCustom = period === 'Custom' && Boolean(customFrom && customTo) && customFrom > customTo;

  const catalog = useApiData(
    () => (ready && !invalidCustom ? reportsApi.catalog(range) : Promise.resolve(null)),
    [range.from, range.to, ready, invalidCustom, reloadKey],
  );

  const reports = catalog.data?.reports ?? [];
  const filtered = reports.filter((r) => {
    if (category !== 'All' && r.category !== category) return false;
    const term = debouncedSearch.trim().toLowerCase();
    if (term && !(r.title.toLowerCase().includes(term) || r.description.toLowerCase().includes(term))) return false;
    return true;
  });

  const categories = ['All', 'Membership', 'Publications', 'Support', 'Engagement', 'Platform', 'Finance'] as const;

  const act = async (key: string, run: () => Promise<string>) => {
    if (busyKey) return;
    setBusyKey(key); setActionError(''); setNotice('');
    try { setNotice(await run()); }
    catch (error) { setActionError(normalizeError(error).message); }
    finally { setBusyKey(null); }
  };

  const exportReport = (r: ReportTile) => act(r.key, async () => {
    const filename = await reportsApi.download(r.key, range);
    return `Exported ${filename}`;
  });

  const runReport = (r: ReportTile) => act(r.key, async () => {
    const result = await reportsApi.run(r.key, range);
    setReloadKey((k) => k + 1);
    return `${r.title} generated — ${result.rows.toLocaleString()} row${result.rows === 1 ? '' : 's'}.`;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(catalog.data?.kpis ?? []).map((kpi, index) => ({
          label: kpi.label,
          value: kpi.value,
          sub: kpi.sub,
          trend: kpi.trendValue,
          trendDir: kpi.trend,
          // Icon and accent stay positional, so each card keeps the identity it
          // had when the values were hardcoded.
          icon: [Users, FolderKanban, Globe2, Headphones][index] ?? Users,
          color: ['forum', 'brass', 'slateteal', 'forum'][index] ?? 'forum',
        })).map((m) => {
          const Icon = m.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[m.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={m.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div>
                  <span className={`text-xs font-semibold inline-flex items-center gap-0.5 ${m.trendDir === 'up' ? 'text-success-600' : m.trendDir === 'down' ? 'text-danger-600' : 'text-ink-muted'}`}>
                    {m.trendDir === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : m.trendDir === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                    {m.trend}
                  </span>
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{m.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{m.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{m.sub}</p>
              </CardContent>
            </Card>
          );
        })}
        {!catalog.data && Array.from({ length: 4 }, (_, i) => (
          <Card key={`kpi-skeleton-${i}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="h-11 w-11 animate-pulse rounded-lg bg-forum-50" />
                <div className="h-4 w-12 animate-pulse rounded bg-forum-50" />
              </div>
              <div className="mt-4 h-8 w-24 animate-pulse rounded bg-forum-50" />
              <div className="mt-2 h-4 w-32 animate-pulse rounded bg-forum-50" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-forum-50" />
            </CardContent>
          </Card>
        ))}
      </div>

      {(actionError || notice) && (
        <p
          role={actionError ? 'alert' : 'status'}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${actionError ? 'bg-danger-100 text-danger-600' : 'bg-success-100 text-success-600'}`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {actionError || notice}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Standard Reports Library
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Pre-built reports. All are exportable, auditable, and include the CRO watermark. Scheduled reports are delivered automatically.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className="w-full sm:w-40">
                {categories.map((v) => <option key={v} value={v}>{v === 'All' ? 'All Categories' : v}</option>)}
              </SelectInput>
              <SelectInput value={period} onChange={(e) => setPeriod(e.target.value as typeof period)} className="w-full sm:w-44 hidden md:block">
                {PERIODS.map((v) => <option key={v} value={v}>{v}</option>)}
              </SelectInput>
              {period === 'Custom' && (
                <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
                  <TextInput aria-label="From date" type="date" max={customTo || undefined} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-full sm:w-40" />
                  <TextInput aria-label="To date" type="date" min={customFrom || undefined} value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-full sm:w-40" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {invalidCustom && (
            <p role="alert" className="mb-4 flex items-center gap-2 rounded-md bg-danger-100 px-3 py-2 text-sm text-danger-600">
              <AlertCircle className="h-4 w-4 shrink-0" />The start date must fall before the end date.
            </p>
          )}
          {!invalidCustom && period === 'Custom' && !ready && (
            <p className="py-10 text-center text-sm text-ink-muted">Choose a start and end date to load reports.</p>
          )}
          {catalog.loading && ready && !invalidCustom && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={`tile-skeleton-${i}`} className="rounded-xl border border-paper-border p-5">
                  <div className="h-10 w-10 animate-pulse rounded-lg bg-forum-50" />
                  <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-forum-50" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-forum-50" />
                  <div className="mt-4 h-7 w-1/2 animate-pulse rounded bg-forum-50" />
                </div>
              ))}
            </div>
          )}
          {!catalog.loading && catalog.error && (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto h-7 w-7 text-danger-600" />
              <p className="mt-2 text-sm text-ink">{catalog.error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            </div>
          )}
          {!catalog.loading && !catalog.error && catalog.data && filtered.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-7 w-7 text-ink-subtle" />
              <p className="mt-2 text-sm text-ink-muted">
                {search || category !== 'All' ? 'No reports match these filters.' : 'No reports are configured.'}
              </p>
              {(search || category !== 'All') && (
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { setSearch(''); setCategory('All'); }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {!catalog.loading && !catalog.error && filtered.map((r) => {
              const CatIcon = iconFor(r.category);
              return (
                <div key={r.id} className="rounded-xl border border-paper-border hover:ring-2 hover:ring-forum-600/10 hover:shadow-sm transition-all overflow-hidden flex flex-col">
                  <div className="p-5 border-b border-paper-border">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 shrink-0 rounded-lg bg-forum-50 text-forum-700 flex items-center justify-center">
                          <CatIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <Badge variant={badgeFor(r.cadence)} className="!text-[10px] !py-0">{r.cadence}</Badge>
                          <p className="text-[10px] uppercase tracking-wider text-ink-subtle mt-1.5 font-semibold">{r.category}</p>
                        </div>
                      </div>
                      <Badge variant="info" className="!text-[10px] !py-0">{r.format}</Badge>
                    </div>
                    <h4 className="font-semibold text-forum-900 leading-snug">{r.title}</h4>
                    <p className="text-xs text-ink-muted mt-1.5 line-clamp-2">{r.description}</p>
                  </div>
                  <div className="p-5 bg-paper/50 space-y-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-xl font-semibold text-forum-900">{r.metric}</p>
                        <p className="text-[11px] text-ink-subtle mt-0.5">{r.samplePeriod}</p>
                      </div>
                      <span className={`text-xs font-semibold inline-flex items-center gap-1 ${r.trend === 'up' ? 'text-success-600' : r.trend === 'down' ? 'text-danger-600' : 'text-ink-muted'}`}>
                        {r.trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> : r.trend === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {r.trendValue}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-paper-border pt-3">
                      {r.lastRun && (
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Last Run</p>
                          <p className="text-ink">{r.lastRun}</p>
                        </div>
                      )}
                      {r.nextRun && (
                        <div>
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Next Run</p>
                          <p className="text-ink">{r.nextRun}</p>
                        </div>
                      )}
                      {r.recipient && (
                        <div className="col-span-2">
                          <p className="font-semibold uppercase tracking-wider text-ink-subtle text-[10px]">Auto-delivered to</p>
                          <p className="text-ink">{r.recipient}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 border-t border-paper-border bg-paper-raised flex flex-wrap items-center justify-between gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setViewing(r)}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled={busyKey !== null} onClick={() => void exportReport(r)}>
                        {busyKey === r.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        {r.format.includes('XLSX') && <FileSpreadsheet className="h-3.5 w-3.5" />}
                        Export
                      </Button>
                      <Button variant="primary" size="sm" disabled={busyKey !== null} onClick={() => void runReport(r)}>
                        <Mail className="h-3.5 w-3.5" />
                        Run Now
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-brass-700" />
              Scheduled Reports
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {catalog.data && reports.filter((r) => r.nextRun).length === 0 && (
              <p className="py-6 text-center text-sm text-ink-muted">No reports are scheduled.</p>
            )}
            {reports.filter((r) => r.nextRun).slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 shrink-0 rounded-md bg-brass-100 text-brass-700 flex items-center justify-center">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forum-900 truncate max-w-[200px]">{r.title}</p>
                    <p className="text-[11px] text-ink-subtle">{r.nextRun} · {r.recipient}</p>
                  </div>
                </div>
                <Badge variant={badgeFor(r.cadence)} className="!text-[10px] !py-0">{r.cadence}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-600" />
              Reports Requiring CRO Attention
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {catalog.data && catalog.data.attention.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-muted">Nothing needs attention — every queue is within its SLA.</p>
            )}
            {(catalog.data?.attention ?? []).map((r) => (
              <div key={r.title} className={`flex items-start justify-between p-3 rounded-lg border ${r.severity === 'danger' ? 'border-danger-600/30 bg-danger-100/30' : r.severity === 'warning' ? 'border-warning-600/30 bg-warning-100/30' : 'border-paper-border'}`}>
                <div className="flex items-start gap-3 min-w-0">
                  <Badge variant={r.severity === 'danger' ? 'danger' : r.severity === 'warning' ? 'warning' : 'info'} className="!text-[10px] !py-0">{r.when}</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-forum-900">{r.title}</p>
                    <p className="text-[11px] text-ink-muted">{r.issue}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0 mt-0.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {viewing && (
        <ReportViewerModal
          reportKey={viewing.key}
          title={viewing.title}
          range={range}
          close={() => setViewing(null)}
        />
      )}
    </div>
  );
}
