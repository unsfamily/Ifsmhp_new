import { useEffect, useRef, useState } from 'react';
import {
  FolderKanban,
  Upload,
  Search,
  Eye,
  Edit3,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  DollarSign,
  Loader2,
  RefreshCw,
  Archive,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput } from '../../components/common/Input';
import {
  memberApi,
  isMemberEditable,
  type MemberProject,
  type Paginated,
  type ProjectStatusLabel,
  type SupportKindLabel,
} from '../../api/member';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import ProjectDetailDialog from './ProjectDetailDialog';
import ProjectEditDialog from './ProjectEditDialog';

type Status = 'All' | ProjectStatusLabel;
type SupportType = 'All' | SupportKindLabel;

const STATUS_OPTIONS: Status[] = ['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Published', 'Archived'];
const SUPPORT_OPTIONS: SupportType[] = ['All', 'Moral', 'Official', 'Funding'];
const PAGE_SIZE = 20;

const statusConfig: Record<ProjectStatusLabel, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: FileText },
  Submitted: { variant: 'info', icon: AlertCircle },
  'Under Review': { variant: 'warning', icon: Clock },
  Approved: { variant: 'info', icon: ShieldCheck },
  Rejected: { variant: 'danger', icon: XCircle },
  Published: { variant: 'success', icon: CheckCircle2 },
  Archived: { variant: 'default', icon: Archive },
};

const supportIcon = {
  Moral: HeartHandshake,
  Official: ShieldCheck,
  Funding: DollarSign,
};

const supportColor = {
  Moral: 'text-slateteal-700',
  Official: 'text-forum-700',
  Funding: 'text-brass-700',
};

const LOCKED_HINT = 'Projects under review can no longer be edited';

export default function MemberProjectsPage() {
  const [status, setStatus] = useState<Status>('All');
  const [support, setSupport] = useState<SupportType>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Rows accumulate across "Load more", so they live here rather than being
  // read straight off the latest response.
  const [rows, setRows] = useState<MemberProject[]>([]);
  const [total, setTotal] = useState(0);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [viewing, setViewing] = useState<MemberProject | null>(null);
  const [editing, setEditing] = useState<MemberProject | null>(null);
  const [confirming, setConfirming] = useState<MemberProject | null>(null);

  // One request per pause in typing, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change restarts paging; otherwise page 2 of the old filter leaks in.
  useEffect(() => { setPage(1); }, [status, support, debouncedSearch]);

  const { data, loading, error } = useApiData<Paginated<MemberProject>>(
    () => memberApi.projects({ status, support, q: debouncedSearch, page, limit: PAGE_SIZE }),
    [status, support, debouncedSearch, page, reloadKey],
  );

  useEffect(() => {
    if (!data) return;
    setTotal(data.pagination.total);
    setRows((previous) => (data.pagination.page === 1 ? data.items : [...previous, ...data.items]));
  }, [data]);

  const hasActiveFilters = status !== 'All' || support !== 'All' || search.trim() !== '';
  const clearFilters = () => { setStatus('All'); setSupport('All'); setSearch(''); };
  const refresh = () => { setPage(1); setReloadKey((key) => key + 1); };

  const initialLoading = loading && page === 1;
  const loadingMore = loading && page > 1;
  const showGrid = !initialLoading && !error && rows.length > 0;
  const canLoadMore = showGrid && rows.length < total;

  const applyUpdate = (updated: MemberProject, message: string) => {
    setRows((previous) => previous.map((row) => (row.id === updated.id ? updated : row)));
    setEditing(null);
    setActionError(null);
    setNotice(message);
  };

  const confirmDelete = async (project: MemberProject) => {
    setConfirming(null);
    setBusyId(project.id);
    setActionError(null);
    setNotice(null);
    const snapshot = rows;
    // Optimistic: drop the card now, put it back if the request fails.
    setRows((previous) => previous.filter((row) => row.id !== project.id));
    setTotal((previous) => Math.max(0, previous - 1));
    try {
      await memberApi.deleteProject(project.id);
      setNotice('Project deleted.');
    } catch (failure) {
      setRows(snapshot);
      setTotal((previous) => previous + 1);
      setActionError(normalizeError(failure).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by project title or category..."
                aria-label="Search projects"
                className="w-full rounded-md border border-paper-border bg-paper pl-10 pr-4 py-2.5 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-4 lg:items-center">
              <SelectInput
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <SelectInput
                label="Support Type"
                value={support}
                onChange={(e) => setSupport(e.target.value as SupportType)}
              >
                {SUPPORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <Button as="link" to="/dashboard/projects/upload" className="lg:mb-0.5 whitespace-nowrap">
                <Upload className="h-4 w-4" />
                Upload Project
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            {initialLoading ? 'Loading projects...' : <>Showing <strong className="text-ink-muted">{rows.length}</strong> of <strong className="text-ink-muted">{total}</strong> projects</>}
            {hasActiveFilters && !initialLoading ? (
              <button type="button" onClick={clearFilters} className="ml-2 font-medium text-forum-700 underline underline-offset-2 hover:text-forum-900">
                Clear filters
              </button>
            ) : null}
          </p>
        </CardContent>
      </Card>

      {notice && (
        <div className="rounded-lg border border-success-600/20 bg-success-100 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0 mt-0.5" />
          <p className="text-sm text-success-600">{notice}</p>
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-600 shrink-0 mt-0.5" />
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      {initialLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
      ) : null}

      {showGrid && (
        <div className="grid gap-5 lg:grid-cols-2">
          {rows.map((p) => {
            const sConfig = statusConfig[p.status] ?? statusConfig.Draft;
            const SIcon = sConfig.icon;
            const editable = isMemberEditable(p.status);
            const busy = busyId === p.id;
            return (
              <Card key={p.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant={sConfig.variant}>
                        <SIcon className="h-3 w-3 mr-1" />
                        {p.status}
                      </Badge>
                      <Badge variant="info">{p.category}</Badge>
                    </div>
                    {p.support.length > 0 ? (
                      <div className="flex items-center gap-1" title={`Support requested: ${p.support.join(', ')}`}>
                        {p.support.map((s) => {
                          const SpprtIcon = supportIcon[s];
                          return SpprtIcon ? <SpprtIcon key={s} className={`h-4 w-4 ${supportColor[s]}`} /> : null;
                        })}
                      </div>
                    ) : (
                      <Badge variant="default">No support requested</Badge>
                    )}
                  </div>
                  <h3 className="mt-4 font-semibold text-forum-900 leading-snug">
                    {p.title}
                  </h3>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Submitted</p>
                      <p className="text-ink-muted mt-0.5">{p.submitted ? new Date(p.submitted).toLocaleDateString() : '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Last Updated</p>
                      <p className="text-ink-muted mt-0.5">{new Date(p.updated).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-paper-border">
                    <span className="text-xs text-ink-subtle flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {p.views.toLocaleString()} views
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewing(p)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-forum-50 hover:text-forum-700 transition-colors"
                        aria-label={`View ${p.title}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(p)}
                        disabled={!editable || busy}
                        title={editable ? 'Edit' : LOCKED_HINT}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-forum-50 hover:text-forum-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
                        aria-label={`Edit ${p.title}`}
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setConfirming(p); setActionError(null); setNotice(null); }}
                        disabled={!editable || busy}
                        title={editable ? 'Delete' : LOCKED_HINT}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-danger-100 hover:text-danger-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink-subtle"
                        aria-label={`Delete ${p.title}`}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => setViewing(p)}>
                        Manage
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="outline" disabled={loadingMore} onClick={() => setPage((current) => current + 1)}>
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loadingMore ? 'Loading...' : `Load more (${total - rows.length} remaining)`}
          </Button>
        </div>
      )}

      {viewing && (
        <ProjectDetailDialog projectId={viewing.id} title={viewing.title} onClose={() => setViewing(null)} />
      )}
      {editing && (
        <ProjectEditDialog project={editing} onClose={() => setEditing(null)} onSaved={applyUpdate} />
      )}
      {confirming && (
        <ConfirmDeleteDialog
          project={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void confirmDelete(confirming)}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-busy="true" aria-label="Loading projects">
      {[0, 1, 2, 3].map((key) => (
        <Card key={key}>
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="flex gap-2">
              <div className="h-5 w-24 rounded-full border border-paper-border bg-paper animate-pulse" />
              <div className="h-5 w-20 rounded-full border border-paper-border bg-paper animate-pulse" />
            </div>
            <div className="h-5 w-3/4 rounded border border-paper-border bg-paper animate-pulse" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-8 rounded border border-paper-border bg-paper animate-pulse" />
              <div className="h-8 rounded border border-paper-border bg-paper animate-pulse" />
            </div>
            <div className="h-8 rounded border border-paper-border bg-paper animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-danger-600" />
        <h3 className="mt-4 font-semibold text-forum-900">Could not load your projects</h3>
        <p className="mt-1 text-ink-muted text-sm">{message}</p>
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <FolderKanban className="mx-auto h-12 w-12 text-ink-subtle" />
        <h3 className="mt-4 font-semibold text-forum-900">
          {hasFilters ? 'No projects match your filters' : 'No projects yet'}
        </h3>
        <p className="mt-1 text-ink-muted text-sm">
          {hasFilters
            ? 'Try adjusting search or filters, or upload a new project.'
            : 'Upload your first research project to submit it for review.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {hasFilters && (
            <Button variant="outline" onClick={onClear}>Clear filters</Button>
          )}
          <Button as="link" to="/dashboard/projects/upload">
            <Upload className="h-4 w-4" />
            {hasFilters ? 'Upload New Project' : 'Upload Your First Project'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmDeleteDialog({ project, onCancel, onConfirm }: {
  project: MemberProject;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

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
      aria-labelledby="confirm-delete-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-forum-900/50"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
    >
      <h2 id="confirm-delete-title" className="font-display text-lg font-semibold text-forum-900">Delete this project?</h2>
      <p className="mt-2 text-sm text-ink-muted">
        &ldquo;{project.title}&rdquo; will be removed from your projects. This cannot be undone from here.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="button" variant="primary" className="bg-danger-600 hover:bg-danger-600/90" onClick={onConfirm}>
          <Trash2 className="h-4 w-4" />
          Delete Project
        </Button>
      </div>
    </dialog>
  );
}
