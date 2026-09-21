import { useMemo, useState } from 'react';
import { Archive, Eye, Pencil, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Button from '../../../components/common/Button';
import CommunityAvatar from '../../../components/community/CommunityAvatar';
import CommunityDeleteDialog from '../../../components/community/CommunityDeleteDialog';
import CommunityDetailsDrawer from '../../../components/community/CommunityDetailsDrawer';
import CommunityFormModal from '../../../components/community/CommunityFormModal';
import CommunityStatusBadge from '../../../components/community/CommunityStatusBadge';
import EmptyCommunityState from '../../../components/community/EmptyCommunityState';
import { CommunityPagination, CommunityToast, PageHeading, controlClass, formatShortDate, panelClass, samplePage } from '../../../components/community/AdminCommunityUi';
import { SAMPLE_ADMIN, communityAdminData } from '../../../data/communityAdminData';
import type { Community, CommunityPayload, CommunityStatus } from '../../../types/community';

type ConfirmAction = { community: Community; action: 'delete' | 'archive' };
export default function AdminCommunitiesPage() {
  /* Sample-data page: communities come from the local dataset and mutations stay in memory. Swap for communityAdminService calls once /admin/community/communities exists. */
  const [communities, setCommunities] = useState<Community[]>(communityAdminData.communities);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ status: '', visibility: '', category: '', sort: 'createdAt:desc' });
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Community | 'new' | null>(null); const [details, setDetails] = useState<Community | null>(null); const [confirm, setConfirm] = useState<ConfirmAction | null>(null); const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const categories = useMemo(() => Array.from(new Set(communities.map((item) => item.category))).sort(), [communities]);
  const notify = (message: string, isError = false) => { setToast({ message, error: isError }); window.setTimeout(() => setToast(null), 3500); };
  const result = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = communities.filter((community) => (!term || [community.name, community.slug, community.description].some((value) => value.toLowerCase().includes(term))) && (!filters.status || community.status === filters.status) && (!filters.visibility || community.visibility === filters.visibility) && (!filters.category || community.category === filters.category));
    const sorted = [...filtered].sort((a, b) => { switch (filters.sort) { case 'createdAt:asc': return a.createdAt.localeCompare(b.createdAt); case 'name:asc': return a.name.localeCompare(b.name); case 'memberCount:desc': return b.memberCount - a.memberCount; default: return b.createdAt.localeCompare(a.createdAt); } });
    return samplePage(sorted, page);
  }, [communities, query, filters, page]);
  const save = async (payload: CommunityPayload) => {
    const { image, banner, ...fields } = payload;
    if (editor === 'new') {
      const created: Community = { ...fields, id: `c-new-${Date.now()}`, createdById: SAMPLE_ADMIN.id, createdByName: SAMPLE_ADMIN.name, memberCount: 0, conversationCount: 0, messageCount: 0, imageUrl: image ? URL.createObjectURL(image) : undefined, bannerUrl: banner ? URL.createObjectURL(banner) : undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      setCommunities((prev) => [created, ...prev]);
      notify('Community created.');
    } else if (editor) {
      setCommunities((prev) => prev.map((item) => item.id === editor.id ? { ...item, ...fields, imageUrl: image ? URL.createObjectURL(image) : item.imageUrl, bannerUrl: banner ? URL.createObjectURL(banner) : item.bannerUrl, updatedAt: new Date().toISOString() } : item));
      notify('Community updated.');
    }
    setEditor(null);
  };
  const status = (community: Community, next: CommunityStatus) => { setCommunities((prev) => prev.map((item) => item.id === community.id ? { ...item, status: next, updatedAt: new Date().toISOString() } : item)); notify(`Community ${next.toLowerCase()}.`); setConfirm(null); };
  const remove = (community: Community) => { setCommunities((prev) => prev.filter((item) => item.id !== community.id)); notify('Community deleted.'); setConfirm(null); };
  const changeFilter = (key: keyof typeof filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return <div className="space-y-6"><PageHeading title="Manage Communities" description="Create, update, archive, and monitor all communities." actions={<Button onClick={() => setEditor('new')}><Plus className="h-4 w-4" />Add Community</Button>} />
    <div className={`${panelClass} p-4`}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><label className="relative"><span className="sr-only">Search communities</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-subtle" /><input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Search communities" className={`${controlClass} w-full pl-9`} /></label><Filter label="Status" value={filters.status} onChange={(v) => changeFilter('status', v)} options={['ACTIVE', 'INACTIVE', 'ARCHIVED']} /><Filter label="Visibility" value={filters.visibility} onChange={(v) => changeFilter('visibility', v)} options={['PUBLIC', 'PRIVATE']} /><Filter label="Category" value={filters.category} onChange={(v) => changeFilter('category', v)} options={categories} /><Filter label="Sort" value={filters.sort} onChange={(v) => changeFilter('sort', v)} options={['createdAt:desc', 'createdAt:asc', 'name:asc', 'memberCount:desc']} /></div></div>
    <section className={panelClass}>{!result.items.length ? <div className="p-5"><EmptyCommunityState title="No communities found" description="Try changing the filters or add the first community." /></div> : <><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-forum-50 text-xs uppercase tracking-wide text-ink-muted"><tr><th className="p-4">Community</th><th className="p-4">Category</th><th className="p-4">Visibility</th><th className="p-4">Status</th><th className="p-4">Members</th><th className="p-4">Created</th><th className="p-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-paper-border">{result.items.map((community) => <tr key={community.id}><td className="p-4"><div className="flex items-center gap-3"><CommunityAvatar name={community.name} src={community.imageUrl} /><div><p className="font-medium text-forum-900">{community.name}</p><p className="text-xs text-ink-muted">/{community.slug}</p></div></div></td><td className="p-4">{community.category}</td><td className="p-4">{community.visibility}</td><td className="p-4"><CommunityStatusBadge status={community.status} /></td><td className="p-4">{community.memberCount.toLocaleString()}</td><td className="p-4">{formatShortDate(community.createdAt)}</td><td className="p-4"><div className="flex justify-end gap-1"><Action title="View" onClick={() => setDetails(community)}><Eye /></Action><Action title="Edit" onClick={() => setEditor(community)}><Pencil /></Action><Action title={community.status === 'ACTIVE' ? 'Deactivate' : 'Activate'} onClick={() => status(community, community.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}><RefreshCw /></Action><Action title="Archive" onClick={() => setConfirm({ community, action: 'archive' })}><Archive /></Action><Action title="Delete" danger onClick={() => setConfirm({ community, action: 'delete' })}><Trash2 /></Action></div></td></tr>)}</tbody></table></div><CommunityPagination meta={result.pagination} onPage={setPage} /></>}</section>
    {editor && <CommunityFormModal community={editor === 'new' ? undefined : editor} busy={false} onClose={() => setEditor(null)} onSubmit={save} />}{details && <CommunityDetailsDrawer community={details} close={() => setDetails(null)} />}{confirm && <CommunityDeleteDialog title={confirm.action === 'delete' ? 'Delete community?' : 'Archive community?'} description={confirm.action === 'delete' ? `Delete ${confirm.community.name}? This cannot be undone.` : `Archive ${confirm.community.name}? Members will no longer be able to use it.`} confirmLabel={confirm.action === 'delete' ? 'Delete' : 'Archive'} busy={false} onClose={() => setConfirm(null)} onConfirm={() => confirm.action === 'delete' ? remove(confirm.community) : status(confirm.community, 'ARCHIVED')} />}{toast && <CommunityToast {...toast} close={() => setToast(null)} />}
  </div>;
}
function Filter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${controlClass} w-full`}><option value="">All {label.toLowerCase()}</option>{options.map((option) => <option key={option} value={option}>{option.replace(':', ' ')}</option>)}</select>; }
function Action({ title, children, danger = false, onClick }: { title: string; children: React.ReactElement<{ className?: string }>; danger?: boolean; onClick: () => void }) { return <button type="button" title={title} aria-label={title} onClick={onClick} className={`rounded-md p-2 hover:bg-forum-50 ${danger ? 'text-danger-600' : 'text-forum-700'}`}>{children && <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>}</button>; }
