import { communityChanged, useCommunityResource } from '../../../hooks/useCommunityResource';
import { useEffect, useRef, useState } from 'react';
import { Eye, RefreshCw, Search, Shield, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react';
import { normalizeError, SESSION_CHANGED, attachmentSessionIdentity } from '../../../api/client';
import Button from '../../../components/common/Button';
import CommunityAvatar from '../../../components/community/CommunityAvatar';
import CommunityMemberDetailsDrawer from '../../../components/community/CommunityMemberDetailsDrawer';
import CommunityPageSkeleton from '../../../components/community/CommunityPageSkeleton';
import EmptyCommunityState from '../../../components/community/EmptyCommunityState';
import MemberStatusDialog from '../../../components/community/MemberStatusDialog';
import MembershipStatusBadge from '../../../components/community/MembershipStatusBadge';
import { Drawer, CommunityPagination, CommunityToast, PageHeading, controlClass, formatDate, panelClass } from '../../../components/community/AdminCommunityUi';
import { useAuth } from '../../../context/AuthContext';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { communityAdminService } from '../../../services/communityAdminService';
import type { CommunityMember, CommunityRole, MembershipStatus, MemberStatusAction } from '../../../types/community';

type MemberAction = { member: CommunityMember; status?: MembershipStatus; statusAction?: MemberStatusAction; role?: CommunityRole; remove?: boolean; label: string; needsReason?: boolean };
const statusDecisions: Record<MemberStatusAction, { label: string; status: MembershipStatus; needsReason: boolean }> = {
  APPROVE: { label: 'Approve', status: 'ACTIVE', needsReason: false },
  REJECT: { label: 'Reject', status: 'REJECTED', needsReason: true },
  BLOCK: { label: 'Block', status: 'BLOCKED', needsReason: true },
  UNBLOCK: { label: 'Unblock', status: 'ACTIVE', needsReason: false },
  SUSPEND: { label: 'Suspend', status: 'SUSPENDED', needsReason: true },
  UNSUSPEND: { label: 'Unsuspend', status: 'ACTIVE', needsReason: false },
};
export default function AdminCommunityMembersPage() {
  const { user } = useAuth(); const [query, setQuery] = useState(''); const search = useDebouncedValue(query); const [filters, setFilters] = useState({ communityId: '', role: '', status: '' }); const [page, setPage] = useState(1); const [details, setDetails] = useState<CommunityMember | null>(null); const [action, setAction] = useState<MemberAction | null>(null); const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const memberData = useCommunityResource(JSON.stringify(['members', page, search, filters]), () => communityAdminService.getMembers({ page, limit: 10, search, ...filters }));
  const { data: result, loading, error, refresh: load } = memberData;
  const [actionError, setActionError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [reviewedMember, setReviewedMember] = useState<CommunityMember | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const mutation = useRef(false);
  const epoch = useRef(0);
  const optionData = useCommunityResource('admin-options', communityAdminService.getOptions);
  const communities = optionData.data?.communities ?? [];
  const detailData = useCommunityResource(details ? `member-detail:${details.id}` : null, () => communityAdminService.getMember(details!.id));
  useEffect(() => { setPage(1); }, [search, filters]);
  const notify = (message: string, isError = false) => { setToast({ message, error: isError }); window.setTimeout(() => setToast(null), 3500); };
  useEffect(() => {
    const generation = epoch;
    const clearProtected = () => { epoch.current++; mutation.current = false; setBusy(false); setAction(null); setDetails(null); setReason(''); setToast(null); setReviewedMember(null); };
    clearProtected();
    window.addEventListener(SESSION_CHANGED, clearProtected);
    return () => { generation.current++; window.removeEventListener(SESSION_CHANGED, clearProtected); };
  }, [user?.id, user?.role]);
  useEffect(() => { if (error && !result) { epoch.current++; setAction(null); setDetails(null); setReason(''); setReviewedMember(null); } }, [error, result]);
  useEffect(() => { if (result && page !== result.pagination.page) setPage(result.pagination.page); }, [result, page]);
  const reconcile = (updated: CommunityMember) => {
    memberData.replaceData(current => {
      if (!current) return current;
      const matches = (!filters.status || filters.status === updated.status) && (!filters.role || filters.role === updated.role);
      const items = current.items.flatMap(item => item.id !== updated.id ? [item] : matches ? [updated] : []);
      const total = current.pagination.total - (current.items.length - items.length);
      const pages = Math.max(1, Math.ceil(total / current.pagination.limit));
      return { ...current, items, pagination: { ...current.pagination, total, pages, page: Math.min(current.pagination.page, pages) } };
    });
    if (details?.id === updated.id) detailData.replaceData(() => updated);
  };
  const reviewCurrent = async (member: CommunityMember) => {
    const version = epoch.current; setReviewLoading(true); setReviewedMember(null);
    try { const current = await communityAdminService.getMember(member.id); if (epoch.current !== version) return; reconcile(current); setReviewedMember(current); }
    catch (failure) { if (epoch.current === version) { const normalized = normalizeError(failure); setActionError(normalized.message); if ([401, 403, 404].includes(normalized.status ?? 0)) { setAction(null); communityChanged(); } } }
    finally { if (epoch.current === version) setReviewLoading(false); }
  };
  const perform = async () => {
    if (!action || mutation.current || conflict) return;
    const note = reason.trim();
    if (note.length > 2000 || (action.needsReason && !note)) { setReasonError(note.length > 2000 ? 'Reason must be 2,000 characters or fewer.' : 'A reason is required.'); return; }
    mutation.current = true; setBusy(true); setActionError(''); setReasonError('');
    const version = epoch.current, session = attachmentSessionIdentity();
    try {
      let updated: CommunityMember | undefined;
      if (action.remove) await communityAdminService.removeMember(action.member.id, note);
      else if (action.status) updated = await communityAdminService.updateMemberStatus(action.member.id, action.status, action.member.status, note || undefined);
      else if (action.role) updated = await communityAdminService.updateMemberRole(action.member.id, action.role);
      if (epoch.current !== version || session !== attachmentSessionIdentity()) return;
      if (updated) reconcile(updated);
      notify(`${action.member.fullName}: ${action.label} completed${updated ? `. Status: ${updated.status}` : ''}.`);
      setAction(null); setReason(''); communityChanged();
    } catch (failure) {
      if (epoch.current !== version || session !== attachmentSessionIdentity()) return;
      const normalized = normalizeError(failure); setActionError(normalized.message); setReasonError(normalized.fieldErrors.reason ?? '');
      if (normalized.status === 409) { setConflict(true); await reviewCurrent(action.member); communityChanged(); }
      else if ([401, 403, 404].includes(normalized.status ?? 0)) { notify(normalized.message, true); setAction(null); setDetails(null); setReason(''); setReviewedMember(null); memberData.replaceData(() => null); communityChanged(); }
    } finally { if (epoch.current === version) { mutation.current = false; setBusy(false); } }
  };
  const choose = (member: CommunityMember, next: Omit<MemberAction, 'member'>) => { epoch.current++; setToast(null); setActionError(''); setReasonError(''); setConflict(false); setReviewedMember(null); setReviewLoading(false); setReason(''); setAction({ member, ...next }); };
  const closeAction = () => { if (mutation.current) return; epoch.current++; setAction(null); setReason(''); };
  const clear = () => { setQuery(''); setFilters({ communityId: '', role: '', status: '' }); };
  return <div className="space-y-6"><PageHeading title="Member Directory" description="Review community memberships, roles, activity, and safety status." actions={<><Button variant="outline" onClick={clear}>Clear Filters</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></>} />
    <div className={`${panelClass} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4`}><label className="relative"><span className="sr-only">Search members</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" /><input className={`${controlClass} w-full pl-9`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" /></label><CommunitySelect label="Community" value={filters.communityId} communities={communities} onChange={(value) => setFilters((f) => ({ ...f, communityId: value }))} /><Select label="Role" value={filters.role} values={['MEMBER', 'MODERATOR', 'ADMIN']} onChange={(value) => setFilters((f) => ({ ...f, role: value }))} /><Select label="Status" value={filters.status} values={['PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED']} onChange={(value) => setFilters((f) => ({ ...f, status: value }))} /></div>
    {(optionData.error || (error && result)) && <p role="alert" className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">{optionData.error || error}</p>}
    <section className={panelClass}>{loading ? <div className="p-5"><CommunityPageSkeleton /></div> : error && !result ? <div className="p-5"><EmptyCommunityState title="" error={error} retry={() => void load()} /></div> : !result?.items.length ? <div className="p-5"><EmptyCommunityState title="No members found" description="No membership records match the current filters." /></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-left text-sm"><thead className="bg-forum-50 text-xs uppercase tracking-wide text-ink-muted"><tr><th className="p-4">Member</th><th className="p-4">Role</th><th className="p-4">Status</th><th className="p-4">Community</th><th className="p-4">Joined</th><th className="p-4">Last active</th><th className="p-4">Messages</th><th className="p-4">Reports</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-paper-border">{result.items.map((member) => { const self = member.userId === user?.id || member.role === 'ADMIN' || (user?.role !== 'ADMIN' && member.role !== 'MEMBER'); return <tr key={member.id}><td className="p-4"><div className="flex items-center gap-3"><CommunityAvatar name={member.fullName} src={member.profileImageUrl} className="rounded-full" /><div><p className="font-medium text-forum-900">{member.fullName}</p><p className="text-xs text-ink-muted">{member.email}</p></div></div></td><td className="p-4">{member.role}</td><td className="p-4"><MembershipStatusBadge status={member.status} /></td><td className="p-4">{member.communityName}<p className="text-xs text-ink-muted">{member.communitiesJoined ?? 1} joined</p></td><td className="p-4">{formatDate(member.joinedAt ?? member.requestedAt)}</td><td className="p-4">{formatDate(member.lastActiveAt)}</td><td className="p-4">{member.messageCount ?? 0}</td><td className="p-4">{member.reportCount ?? 0}</td><td className="p-4"><div className="flex justify-end gap-1"><Icon title="View details" onClick={() => setDetails(member)}><Eye /></Icon>{member.role === 'MODERATOR' ? <Icon title="Remove moderator" disabled={self || user?.role !== 'ADMIN' || member.status !== 'ACTIVE'} onClick={() => choose(member, { role: 'MEMBER', label: 'Remove moderator role' })}><ShieldOff /></Icon> : <Icon title="Assign moderator" disabled={self || user?.role !== 'ADMIN' || member.status !== 'ACTIVE'} onClick={() => choose(member, { role: 'MODERATOR', label: 'Assign moderator role' })}><Shield /></Icon>}{(member.availableStatusActions ?? []).map(kind => { const decision = statusDecisions[kind]; return <Icon key={kind} title={decision.label} danger={decision.needsReason} disabled={busy} onClick={() => choose(member, { ...decision, statusAction: kind })}>{kind === 'BLOCK' ? <ShieldOff /> : decision.needsReason ? <UserX /> : <UserCheck />}</Icon>; })}<Icon title="Remove member" danger disabled={self} onClick={() => choose(member, { remove: true, label: 'Remove', needsReason: true })}><Trash2 /></Icon></div></td></tr>; })}</tbody></table></div><CommunityPagination meta={result.pagination} onPage={setPage} /></>}</section>
    {details && (detailData.data ? <CommunityMemberDetailsDrawer member={detailData.data} close={() => setDetails(null)} /> : <Drawer title="Member details" close={() => setDetails(null)}>{detailData.loading ? <CommunityPageSkeleton /> : <EmptyCommunityState title="Details unavailable" error={detailData.error} retry={() => void detailData.refresh()} />}</Drawer>)}{action && <MemberStatusDialog title={`${action.label} member?`} description={`This action affects ${action.member.fullName}'s membership in ${action.member.communityName}.${action.status ? ` Status: ${action.member.status} → ${action.status}.` : ''}`} confirmLabel={action.label} busy={busy} reason={reason} requireReason={action.needsReason} onReason={value => { setReason(value); setReasonError(''); }} onClose={closeAction} onConfirm={() => void perform()} error={actionError} reasonError={reasonError} reasonMaxLength={2000} confirmDisabled={conflict}>
      {conflict && <div className="mt-3 space-y-2 text-sm"><p>{reviewLoading ? 'Refreshing membership…' : reviewedMember ? `Current status: ${reviewedMember.status}. Review an available action below before confirming.` : 'Refresh the membership before deciding.'}</p>
        <div className="flex flex-wrap gap-2">{!reviewLoading && <Button size="sm" variant="outline" onClick={() => void reviewCurrent(action.member)}>Refresh current status</Button>}
        {reviewedMember && (reviewedMember.availableStatusActions ?? []).map(kind => <Button key={kind} size="sm" variant="outline" onClick={() => { setAction({ member: reviewedMember, ...statusDecisions[kind], statusAction: kind }); setConflict(false); setActionError(''); }}>Review {statusDecisions[kind].label}</Button>)}</div>
      </div>}
    </MemberStatusDialog>}{toast && <CommunityToast {...toast} close={() => setToast(null)} />}
  </div>;
}
function Select({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) { return <select aria-label={label} className={controlClass} value={value} onChange={(e) => onChange(e.target.value)}><option value="">All {label.toLowerCase()}</option>{values.map((v) => <option key={v}>{v}</option>)}</select>; }
function CommunitySelect({ label, value, communities, onChange }: { label: string; value: string; communities: { id: string; name: string }[]; onChange: (value: string) => void }) { return <select aria-label={label} className={controlClass} value={value} onChange={(e) => onChange(e.target.value)}><option value="">All {label.toLowerCase()}</option>{communities.map((community) => <option key={community.id} value={community.id}>{community.name}</option>)}</select>; }
function Icon({ title, children, onClick, danger = false, disabled = false }: { title: string; children: React.ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) { return <button type="button" title={disabled ? 'This action is unavailable for this membership' : title} aria-label={title} disabled={disabled} onClick={onClick} className={`rounded-md p-2 disabled:cursor-not-allowed disabled:opacity-30 ${danger ? 'text-danger-600 hover:bg-danger-50' : 'text-forum-700 hover:bg-forum-50'} [&>svg]:h-4 [&>svg]:w-4`}>{children}</button>; }
