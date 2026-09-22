import { accessLost, communityChanged, useCommunityResource } from '../../../hooks/useCommunityResource';
import { useEffect, useRef, useState } from 'react';
import { Eye, Gavel, RefreshCw, Search } from 'lucide-react';
import { normalizeError, type NormalizedApiError } from '../../../api/client';
import Button from '../../../components/common/Button';
import CommunityPageSkeleton from '../../../components/community/CommunityPageSkeleton';
import CommunityReportDetailsDrawer from '../../../components/community/CommunityReportDetailsDrawer';
import CommunityStatusBadge from '../../../components/community/CommunityStatusBadge';
import EmptyCommunityState from '../../../components/community/EmptyCommunityState';
import ModerationActionModal from '../../../components/community/ModerationActionModal';
import { Drawer, CommunityPagination, CommunityToast, PageHeading, controlClass, formatDate, panelClass } from '../../../components/community/AdminCommunityUi';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { communityAdminService } from '../../../services/communityAdminService';
import { useAuth } from '../../../context/AuthContext';
import type { CommunityReport, ModerationAction } from '../../../types/community';

export default function AdminCommunityModerationPage() {
  const [query, setQuery] = useState(''); const search = useDebouncedValue(query); const [filters, setFilters] = useState({ status: '', communityId: '', dateFrom: '' }); const [page, setPage] = useState(1); const [details, setDetails] = useState<CommunityReport | null>(null); const [action, setAction] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const { user } = useAuth();
  const mutationLock = useRef(false); const mounted = useRef(true);
  const currentUser = useRef(user?.id); currentUser.current = user?.id;
  const currentAction = useRef(action); currentAction.current = action;
  const [actionError, setActionError] = useState<NormalizedApiError | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setAction(null); setDetails(null); setActionError(null); }, [user?.id]);
  const { data: result, loading, error, refresh: load } = useCommunityResource(JSON.stringify(['reports', page, search, filters]), () => communityAdminService.getReports({ page, limit: 10, search, ...filters }));
  const optionData = useCommunityResource('admin-options', communityAdminService.getOptions);
  const communities = optionData.data?.communities ?? [];
  const detailData = useCommunityResource(details ? `report-detail:${details.id}` : null, () => communityAdminService.getReport(details!.id));
  useEffect(() => { setPage(1); }, [search, filters]);
  const actionData = useCommunityResource(action ? `report-action:${action}` : null, () => communityAdminService.getReport(action!));
  useEffect(() => { if (result && result.pagination.page !== page) setPage(result.pagination.page); }, [result, page]);
  const notify = (message: string, isError = false) => { setToast({ message, error: isError }); window.setTimeout(() => setToast(null), 3500); };
  const mutate = async (id: string, request: () => Promise<CommunityReport>, fromModal = false) => {
    if (mutationLock.current) return;
    mutationLock.current = true; setBusy(true); setActionError(null);
    const actorId = user?.id;
    const stillCurrent = () => mounted.current && currentUser.current === actorId;
    try {
      await request();
      if (!stillCurrent()) return;
      notify(fromModal ? 'Moderation action applied.' : 'Report marked under review.');
      if (fromModal && currentAction.current === id) setAction(null);
      communityChanged(); await load();
    } catch (failure) {
      if (!stillCurrent()) return;
      const problem = normalizeError(failure);
      if (accessLost(failure)) {
        if (currentAction.current === id) setAction(null);
        setDetails(current => current?.id === id ? null : current);
        notify(problem.message, true); communityChanged();
      } else if (fromModal && currentAction.current === id) {
        setActionError(problem);
        if (problem.status === 409) { communityChanged(); void actionData.refresh(); }
      } else notify(problem.message, true);
    } finally { mutationLock.current = false; if (mounted.current) setBusy(false); }
  };
  const startReview = (report: CommunityReport) => mutate(report.id, () => communityAdminService.updateReport(report.id, { status: 'UNDER_REVIEW' }));
  const moderate = (kind: ModerationAction, notes: string) => {
    if (!action || !actionData.data?.availableActions.includes(kind)) return;
    const id = action;
    return mutate(id, () => kind === 'RESOLVE_REPORT' || kind === 'DISMISS_REPORT'
      ? communityAdminService.updateReport(id, { status: kind === 'RESOLVE_REPORT' ? 'RESOLVED' : 'DISMISSED', resolutionNotes: notes })
      : communityAdminService.createModerationAction(id, { action: kind, notes }), true);
  };
  return <div className="space-y-6"><PageHeading title="Reports & Moderation" description="Review reports and take documented action on unsafe content or members." actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>} /><div className={`${panelClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}><label className="relative"><span className="sr-only">Search reports</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" /><input className={`${controlClass} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports" /></label><select aria-label="Status" className={controlClass} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}><option value="">All statuses</option>{['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map((v) => <option key={v}>{v}</option>)}</select><select aria-label="Community" className={controlClass} value={filters.communityId} onChange={(e) => setFilters((f) => ({ ...f, communityId: e.target.value }))}><option value="">All communities</option>{communities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}</select><input aria-label="Reported since" title="Reported since" type="date" className={controlClass} value={filters.dateFrom} onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))} /></div>
    {(optionData.error || (error && result)) && <p role="alert" className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">{optionData.error || error}</p>}
    <section className={panelClass}>{loading ? <div className="p-5"><CommunityPageSkeleton /></div> : error && !result ? <div className="p-5"><EmptyCommunityState title="" error={error} retry={() => void load()} /></div> : !result?.items.length ? <div className="p-5"><EmptyCommunityState title="No reports found" description="No reports match the current filters." /></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-forum-50 text-xs uppercase tracking-wide text-ink-muted"><tr><th className="p-4">Reporter</th><th className="p-4">Reported member</th><th className="p-4">Community</th><th className="p-4">Message</th><th className="p-4">Reason</th><th className="p-4">Date</th><th className="p-4">Status</th><th className="p-4">Assigned</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-paper-border">{result.items.map((report) => <tr key={report.id}><td className="p-4">{report.reporterName}</td><td className="p-4">{report.reportedMemberName ?? '—'}</td><td className="p-4">{report.communityName}</td><td className="max-w-[220px] truncate p-4">{report.reportedMessage?.isDeleted ? 'This message was deleted.' : report.reportedMessage?.content ?? '—'}</td><td className="max-w-[220px] truncate p-4">{report.reason}</td><td className="p-4">{formatDate(report.createdAt)}</td><td className="p-4"><CommunityStatusBadge status={report.status} /></td><td className="p-4">{report.assignedAdminName ?? 'Unassigned'}</td><td className="p-4"><div className="flex justify-end gap-1"><Icon disabled={busy} title="View report" onClick={() => setDetails(report)}><Eye /></Icon>{report.status === 'OPEN' && <Icon disabled={busy} title="Start review" onClick={() => void startReview(report)}><RefreshCw /></Icon>}<Icon disabled={busy} title="Moderation action" onClick={() => { if (!mutationLock.current) { setActionError(null); setAction(report.id); } }}><Gavel /></Icon></div></td></tr>)}</tbody></table></div><CommunityPagination meta={result.pagination} onPage={setPage} /></>}</section>{details && (detailData.data ? <CommunityReportDetailsDrawer report={detailData.data} close={() => setDetails(null)} /> : <Drawer title="Report details" close={() => setDetails(null)}>{detailData.loading ? <CommunityPageSkeleton /> : <EmptyCommunityState title="Details unavailable" error={detailData.error} retry={() => void detailData.refresh()} />}</Drawer>)}{action && <ModerationActionModal key={`${user?.id}:${action}`} actions={actionData.data?.availableActions ?? null} loading={actionData.loading} error={actionError?.message || actionData.error} fields={actionError?.fieldErrors ?? {}} busy={busy} retry={() => void actionData.refresh(false)} close={() => { if (!mutationLock.current) setAction(null); }} submit={(kind, notes) => void moderate(kind, notes)} />}{toast && <CommunityToast {...toast} close={() => setToast(null)} />}</div>;
}
function Icon({ title, children, onClick, disabled }: { title: string; children: React.ReactNode; onClick: () => void; disabled?: boolean }) { return <button type="button" disabled={disabled} title={title} aria-label={title} onClick={onClick} className="rounded-md p-2 text-forum-700 hover:bg-forum-50 [&>svg]:h-4 [&>svg]:w-4">{children}</button>; }
