import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Clock, ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Download, User, Eye, ChevronRight, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuditLog } from '../../hooks/useAuditLog';
import { auditService, type AuditEntry, type AuditFilters } from '../../services/auditService';
import { normalizeError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const severityConfig = {
  INFO: { label: 'Info', badge: 'default', dot: 'bg-slateteal-500', icon: Eye },
  SUCCESS: { label: 'Success', badge: 'success', dot: 'bg-success-600', icon: CheckCircle2 },
  WARNING: { label: 'Warning', badge: 'warning', dot: 'bg-warning-600', icon: AlertTriangle },
  DANGER: { label: 'Danger', badge: 'danger', dot: 'bg-danger-600', icon: XCircle },
} as const;
const roleLabel = (role: string) => ({ ADMIN: 'CRO Office', MEMBER: 'Member', APPLICANT: 'Applicant', SYSTEM: 'System', UNAUTHENTICATED: 'Unauthenticated' }[role] ?? role);
const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const timestamp = (date: string) => `${new Date(date).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
const initial: AuditFilters = { search: '', actorRole: '', module: '', action: '', severity: '', from: '', to: '', sort: 'newest' };

export default function AdminAuditLogPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(initial), [query, setQuery] = useState(''), [page, setPage] = useState(1), [expandedId, setExpandedId] = useState<string | null>(null);
  const search = useDebouncedValue(query), [exporting, setExporting] = useState(false), [exportError, setExportError] = useState('');
  const exportRequest = useRef<AbortController | null>(null);
  const params = useMemo(() => ({ ...filters, search }), [filters, search]);
  const { data, summary, options, loading, error, denied, refresh, revokeAccess } = useAuditLog(params, page);
  useEffect(() => { setPage(1); setExpandedId(null); }, [params]);
  useEffect(() => { if (data && page !== data.pagination.page) setPage(data.pagination.page); }, [data, page]);
  useEffect(() => { setExpandedId(null); setExportError(''); return () => exportRequest.current?.abort(); }, [user?.id, user?.role]);
  useEffect(() => { if (denied) { exportRequest.current?.abort(); setExpandedId(null); } }, [denied]);
  const change = (key: keyof AuditFilters, value: string) => { setFilters(f => ({ ...f, [key]: value })); setPage(1); };
  const exportCsv = async () => {
    if (exportRequest.current || denied) return;
    const request = new AbortController(); exportRequest.current = request; setExporting(true); setExportError('');
    try {
      const blob = await auditService.export(params, request.signal);
      if (request.signal.aborted) return;
      const url = URL.createObjectURL(blob), anchor = document.createElement('a'); anchor.href = url; anchor.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); void refresh();
    } catch (failure) {
      if (!request.signal.aborted) {
        const problem = normalizeError(failure);
        if ([401, 403].includes(problem.status ?? 0)) revokeAccess(problem.message);
        else setExportError(problem.message);
      }
    }
    finally { if (exportRequest.current === request) { exportRequest.current = null; setExporting(false); } }
  };
  const cards = [
    { label: 'Admin Actions (24h)', value: summary?.admin24h.toLocaleString(), icon: ShieldCheck, color: 'forum', note: 'Recorded administrator activity' },
    { label: 'Warnings (7d)', value: summary?.warnings7d.toLocaleString(), icon: AlertTriangle, color: 'brass', note: 'Sensitive access and restrictions' },
    { label: 'Danger Events (7d)', value: summary?.danger7d.toLocaleString(), icon: XCircle, color: 'slateteal', note: 'Rejections and security events' },
    { label: 'Log Retention', value: summary ? 'Indefinite' : undefined, icon: Clock, color: 'forum', note: 'Immutable append-only · §I.17' },
  ];
  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-4">{cards.map(k => { const Icon = k.icon; const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color]; return <Card key={k.label}><CardContent className="p-5"><div className="flex items-start justify-between"><div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}><Icon className="h-5.5 w-5.5" /></div><Badge variant="warning" className="!text-[10px]">§I.17</Badge></div><p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value ?? '—'}</p><p className="mt-0.5 text-sm text-ink-muted">{k.label}</p><p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p></CardContent></Card>; })}</div>
    <Card><CardHeader><div className="flex flex-col gap-4"><div><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-forum-600" />System Audit Log</h3><p className="text-xs text-ink-subtle mt-0.5">Immutable, append-only record of business changes, sensitive accesses, and security events. Architecture §I.17.</p></div>
      <div className="flex flex-wrap gap-2"><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" /><TextInput aria-label="Search audit log" placeholder="Search log…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} className="pl-9 [&>input]:pl-9" /></div>
        <SelectInput aria-label="Actor" value={filters.actorRole} onChange={e => change('actorRole', e.target.value)} className="w-full sm:w-40"><option value="">All Actors</option>{options?.actorRoles.map(v => <option key={v} value={v}>{roleLabel(v)}</option>)}</SelectInput>
        <SelectInput aria-label="Module" value={filters.module} onChange={e => change('module', e.target.value)} className="w-full sm:w-40"><option value="">All Modules</option>{options?.modules.map(v => <option key={v} value={v}>{label(v)}</option>)}</SelectInput>
        <SelectInput aria-label="Action" value={filters.action} onChange={e => change('action', e.target.value)} className="w-full sm:w-52"><option value="">All Actions</option>{options?.actions.map(v => <option key={v}>{v}</option>)}</SelectInput>
        <SelectInput aria-label="Severity" value={filters.severity} onChange={e => change('severity', e.target.value)} className="w-full sm:w-32"><option value="">All Severities</option>{options?.severities.map(v => <option key={v} value={v}>{label(v)}</option>)}</SelectInput>
        <label className="w-full sm:w-44 text-[11px] text-ink-subtle">From (UTC)<TextInput type="date" aria-label="From date (UTC)" value={filters.from} onChange={e => change('from', e.target.value)} className="w-full" /></label><label className="w-full sm:w-44 text-[11px] text-ink-subtle">To (UTC)<TextInput type="date" aria-label="To date (UTC)" value={filters.to} onChange={e => change('to', e.target.value)} className="w-full" /></label>
        <SelectInput aria-label="Sort" value={filters.sort} onChange={e => change('sort', e.target.value)} className="w-full sm:w-40"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></SelectInput><Button variant="ghost" size="sm" disabled={loading} onClick={() => void refresh()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div></div></CardHeader>
      <CardContent className="pt-0">{(error || exportError) && <div role="alert" className="mb-4 rounded-lg bg-warning-50 p-3 text-sm text-warning-700"><p>{error || exportError}</p><Button variant="ghost" size="sm" onClick={() => void refresh()}>Retry</Button></div>}
        <div className="flex items-center justify-between mb-3 text-xs text-ink-subtle"><p>Showing <span className="font-semibold text-ink-muted">{data?.items.length ?? 0}</span> of <span className="font-semibold text-ink-muted">{data?.pagination.total.toLocaleString() ?? '—'}</span> entries</p><Button variant="ghost" size="sm" disabled={exporting || denied || !data || !!error} onClick={() => void exportCsv()}><Download className="h-3.5 w-3.5" />{exporting ? 'Exporting…' : 'Export CSV'}</Button></div>
        {loading && !data ? <p role="status" className="py-12 text-center text-ink-muted">Loading audit log…</p> : data?.items.length ? <ol className="relative border-l-2 border-paper-border ml-3 pl-5 space-y-4">{data.items.map(entry => <Entry key={entry.id} entry={entry} expanded={expandedId === entry.id} toggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)} />)}</ol> : !error && <p className="py-12 text-center text-ink-muted">No audit events match these filters.</p>}
        {data && <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-paper-border pt-4 text-sm text-ink-muted"><span>Page {data.pagination.page} of {data.pagination.pages}</span><div className="flex gap-2"><Button variant="ghost" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button><Button variant="ghost" size="sm" disabled={page >= data.pagination.pages || loading} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>}
      </CardContent></Card>
  </div>;
}
function Entry({ entry: e, expanded, toggle }: { entry: AuditEntry; expanded: boolean; toggle: () => void }) {
  const sev = severityConfig[e.severity], Icon = sev.icon;
  return <li className="relative"><span className={`absolute -left-[27px] top-1.5 h-5 w-5 rounded-full ring-4 ring-paper-raised ${sev.dot} flex items-center justify-center`}><Icon className="h-2.5 w-2.5 text-white" /></span><div className="rounded-xl border border-paper-border p-4 hover:bg-forum-50/30 transition-colors">
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2"><div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={sev.badge} className="!py-0">{sev.label}</Badge><code className="text-[11px] break-all font-mono text-forum-700 font-semibold bg-forum-50 px-1.5 py-0.5 rounded">{e.action}</code><span className="text-xs text-ink-muted inline-flex items-center gap-1.5"><Clock className="h-3 w-3" />{timestamp(e.createdAt)}</span>{e.ipAddress && <span className="text-[11px] text-ink-subtle font-mono">· {e.ipAddress}</span>}</div>
      <div className="mt-2 flex items-start gap-2"><div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white flex items-center justify-center">{e.actorRole === 'ADMIN' ? <ShieldCheck className="h-4 w-4" /> : e.actorRole === 'SYSTEM' ? <Clock className="h-4 w-4" /> : <User className="h-4 w-4" />}</div><div className="min-w-0"><p className="text-xs font-semibold text-ink break-words">{e.actorLabel}{e.actorEmail ? ` (${e.actorEmail})` : ''}{e.actorMemberId ? ` · ${e.actorMemberId}` : ''}</p><p className="text-[11px] text-ink-subtle mt-0.5 break-words">{e.entity} · {label(e.module)} · {roleLabel(e.actorRole)}</p></div></div><p className="mt-2.5 text-sm text-ink leading-relaxed break-words">{e.description}</p></div>
      <button type="button" onClick={toggle} aria-expanded={expanded} aria-controls={`audit-${e.id}`} className="text-xs text-forum-700 inline-flex items-center gap-1 shrink-0">{e.changes ? 'Field changes' : 'Event details'}<ChevronRight className={`h-3 w-3 ${expanded ? 'rotate-90' : ''}`} /></button></div>
    {expanded && <div id={`audit-${e.id}`} className="mt-4 border-t border-paper-border pt-4 space-y-3 text-xs break-words">
      {!e.actorSnapshotAvailable && <p className="text-ink-muted">Historical actor snapshot unavailable.{e.currentActor ? ` Current account: ${e.currentActor.name} (${e.currentActor.email}).` : ''}</p>}
      {e.changes && <><h5 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">State Changes (Before → After)</h5><div className="grid gap-2 sm:grid-cols-2">{Object.entries(e.changes).map(([field, values]) => <div key={field} className="rounded-lg border border-paper-border overflow-hidden"><div className="px-3 py-1.5 bg-paper text-[10px] font-semibold uppercase text-ink-subtle font-mono">{field}</div><div className="grid grid-cols-2 text-xs">{(['before', 'after'] as const).map(key => <div key={key} className="px-3 py-2 border-r border-paper-border"><p className={`text-[10px] font-semibold uppercase mb-1 ${key === 'before' ? 'text-danger-600' : 'text-success-600'}`}>{key}</p><p className="font-mono break-all">{values[key] === null ? 'null' : String(values[key])}</p></div>)}</div></div>)}</div></>}
      {e.legacyDetailsAvailable && <div><p>Legacy details (historical before/after values unavailable).</p>{e.legacyDetails ? <pre className="whitespace-pre-wrap break-all rounded-lg bg-forum-50 p-3">{JSON.stringify(e.legacyDetails, null, 2)}</pre> : <p>No supported legacy fields available.</p>}</div>}
      <p>Outcome: {e.outcome ? label(e.outcome) : 'Unavailable'} · Source: {e.source ?? 'Unavailable'}</p><p>Event: {e.id} · Version: {e.eventVersion}</p>{e.requestId && <p>Request: {e.requestId}</p>}{e.userAgent && <p>User agent: {e.userAgent}</p>}{e.metadata && Object.keys(e.metadata).length > 0 && <pre className="whitespace-pre-wrap break-all rounded-lg bg-forum-50 p-3">{JSON.stringify(e.metadata, null, 2)}</pre>}
    </div>}
  </div></li>;
}
