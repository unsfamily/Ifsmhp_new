import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Images,
  FolderKanban,
  Pencil,
  Trash2,
  ArrowUpDown,
  Upload,
  X,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  FileImage,
  ChevronUp,
  ChevronDown,
  MoveRight,
  RotateCcw,
  Save,
  FolderPlus,
  ImagePlus,
  PanelLeft,
  ListOrdered,
} from 'lucide-react';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { Card } from '../../components/common/Card';
import { useAdminGallery } from '../../context/GalleryContext';
import GalleryImage from '../../components/gallery/GalleryImage';
import { normalizeError } from '../../api/client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { GalleryPolicy } from '../../services/galleryService';
import type {
  GalleryCategory,
  GalleryPhoto,
  PhotoUploadTask,
} from '../../types/gallery';

type TabId = 'categories' | 'photos' | 'upload';

const ADMIN_TABS: Array<{ id: TabId; label: string; icon: typeof FolderKanban }> = [
  { id: 'categories', label: 'Categories', icon: FolderKanban },
  { id: 'photos', label: 'Photographs', icon: Images },
  { id: 'upload', label: 'Upload Photos', icon: Upload },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function AdminGalleryPage() {
  const {
    categories,
    photos,
    createCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryPublished,
    reorderCategory,
    updatePhoto,
    deletePhoto,
    togglePhotoPublished,
    movePhoto,
    reorderPhoto,
    uploadPhoto, loading, error, refresh, policy, setPhotoFilters,
  } = useAdminGallery();

  const [activeTab, setActiveTab] = useState<TabId>('categories');

  const [catFilter, setCatFilter] = useState<string>('all');
  useEffect(() => { if (!loading && catFilter !== 'all' && !categories.some(c => c.id === catFilter)) setCatFilter('all'); }, [loading, catFilter, categories]);
  const [catSearch, setCatSearch] = useState('');

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const filteredPhotos = photos;
  const search = useDebouncedValue(catSearch);
  useEffect(() => { setPhotoFilters({ categoryId: catFilter, search }); }, [catFilter, search, setPhotoFilters]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [notice, setNotice] = useState<{ message: string; error?: boolean } | null>(null);
  const run = async (operation: () => Promise<unknown>, message: string) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true); setNotice(null);
    try { await operation(); setNotice({ message }); return true; }
    catch (failure) { const details = normalizeError(failure); setNotice({ message: Object.values(details.fieldErrors).join(' ') || details.message, error: true }); return false; }
    finally { busyRef.current = false; setBusy(false); }
  };
  const MAX_UPLOAD_MB = policy ? policy.maxBytes / 1024 / 1024 : '…';

  const [editingCategory, setEditingCategory] = useState<GalleryCategory | null>(null);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<GalleryPhoto | null>(null);

  const [uploadTasks, setUploadTasks] = useState<PhotoUploadTask[]>([]);
  const [defaultUploadCategoryId, setDefaultUploadCategoryId] = useState<string>(
    sortedCategories.find((c) => c.published)?.id ?? sortedCategories[0]?.id ?? ''
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadingRef = useRef(false);

  useEffect(() => {
    if (!loading && !sortedCategories.find((c) => c.id === defaultUploadCategoryId)) {
      setDefaultUploadCategoryId(sortedCategories[0]?.id ?? '');
    }
  }, [sortedCategories, defaultUploadCategoryId, loading]);

  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => () => uploadController.current?.abort(), []);
  useEffect(() => {
    if (uploadingRef.current) return;
    const queued = uploadTasks.find(t => t.status === 'queued');
    if (!queued) return;
    uploadingRef.current = true;
    const controller = new AbortController(); uploadController.current = controller;
    const update = (patch: Partial<PhotoUploadTask>) => setUploadTasks(previous => previous.map(task => task.id === queued.id ? { ...task, ...patch } : task));
    update({ status: 'uploading' });
    void uploadPhoto(queued.file, queued.categoryId, controller.signal, progress => update({ progress }))
      .then(photo => { if (!controller.signal.aborted) update({ photo, status: 'success', progress: 100 }); })
      .catch(failure => { if (!controller.signal.aborted) update({ status: 'error', error: normalizeError(failure).message }); })
      .finally(() => { uploadingRef.current = false; if (!controller.signal.aborted) setUploadTasks(previous => [...previous]); });
  }, [uploadTasks, uploadPhoto]);

  const handleFiles = (files: FileList | File[]) => {
    if (!policy || !defaultUploadCategoryId) return;
    const next = Array.from(files).map((file): PhotoUploadTask => {
      const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
      const error = !file.size ? 'Choose a non-empty image.' : !policy.extensions.includes(extension) || !policy.mimeTypes.includes(file.type) ? 'Choose a JPEG, PNG, or WebP image.' : file.size > policy.maxBytes ? `Image exceeds ${MAX_UPLOAD_MB} MB.` : null;
      return { id: crypto.randomUUID(), categoryId: defaultUploadCategoryId, file, name: file.name, sizeBytes: file.size, status: error ? 'error' : 'queued', error, progress: 0, photo: null, previewUrl: null };
    });
    setUploadTasks(previous => [...previous, ...next]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const photoCatForSelect = (p: GalleryPhoto) =>
    categories.find((c) => c.id === p.categoryId)?.name ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 inline-flex items-center gap-1.5">
            <PanelLeft className="h-3 w-3" /> Content Hub
          </p>
          <h1 className="font-display text-2xl font-semibold text-forum-900 sm:text-3xl">
            Media Gallery Management
          </h1>
          <p className="text-sm text-ink-muted max-w-2xl">
            Organise collections, upload photographs, and control what appears
            on the IFSMHP homepage gallery. Max{' '}
            <span className="font-semibold text-forum-800">{MAX_UPLOAD_MB} MB</span> per image.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={busy || loading}
            onClick={() => void refresh()}
          >
            <RotateCcw className="h-4 w-4" /> Refresh
          </Button>
          <Button
            onClick={() => setActiveTab('upload')}
            className="bg-forum-900 hover:bg-forum-800"
          >
            <ImagePlus className="h-4 w-4" /> Upload photos
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-paper-border bg-white p-1.5 shadow-sm inline-flex flex-wrap gap-1">
        {ADMIN_TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                active
                  ? 'bg-forum-900 text-white shadow-sm'
                  : 'text-forum-700 hover:bg-forum-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && <p role="status" className="text-sm text-ink-muted">Loading gallery…</p>}
      {error && <div role="alert" className="rounded-lg bg-danger-50 p-3 text-danger-700">{error} <button className="underline" onClick={() => void refresh()}>Retry</button></div>}
      {notice && <div role={notice.error ? 'alert' : 'status'} className={`rounded-lg p-3 text-sm ${notice.error ? 'bg-danger-50 text-danger-700' : 'bg-forum-50 text-forum-900'}`}>{notice.message}</div>}
      <fieldset disabled={busy || loading || uploadTasks.some(t => t.status === 'uploading')} className="min-w-0 space-y-6">
      {activeTab === 'categories' ? (
        <CategoriesPanel
          categories={sortedCategories}
          getCount={(id) => categories.find(c => c.id === id)?.photoCount ?? 0}
          onEdit={c => { setNotice(null); setEditingCategory(c); }}
          onDelete={(c) => {
            if (
              window.confirm(
                `Delete category "${c.name}"? All photographs inside it will also be removed. This cannot be undone.`
              )
            ) {
              void run(() => deleteCategory(c.id), 'Collection deleted.');
            }
          }}
          onReorderUp={(c) => void run(() => reorderCategory(c.id, -1), 'Collection order updated.')}
          onReorderDown={(c) => void run(() => reorderCategory(c.id, 1), 'Collection order updated.')}
          onTogglePublish={id => void run(() => toggleCategoryPublished(id), 'Collection status updated.')}
          onNew={() => { setNotice(null); setNewCatOpen(true); }}
        />
      ) : null}

      {activeTab === 'photos' ? (
        <PhotosPanel
          photos={filteredPhotos}
          loading={loading}
          loadError={error}
          categories={sortedCategories}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          catSearch={catSearch}
          setCatSearch={setCatSearch}
          onEdit={p => { setNotice(null); setEditingPhoto(p); }}
          onDelete={(p) => {
            if (
              window.confirm(
                `Delete photograph "${p.title}"? This cannot be undone.`
              )
            ) {
              void run(() => deletePhoto(p.id), 'Photograph deleted.');
            }
          }}
          onReorderUp={(p) => void run(() => reorderPhoto(p.id, -1), 'Photo order updated.')}
          onReorderDown={(p) => void run(() => reorderPhoto(p.id, 1), 'Photo order updated.')}
          onTogglePublish={id => void run(() => togglePhotoPublished(id), 'Photo status updated.')}
          onMove={(p, target) => void run(() => movePhoto(p.id, target), 'Photograph moved.')}
          photoCatForSelect={photoCatForSelect}
          onUploadTab={() => setActiveTab('upload')}
        />
      ) : null}

      {activeTab === 'upload' ? (
        <UploadPanel
          categories={sortedCategories}
          defaultCategoryId={defaultUploadCategoryId}
          setDefaultCategoryId={setDefaultUploadCategoryId}
          uploadTasks={uploadTasks}
          setUploadTasks={setUploadTasks}
          isDragging={isDragging}
          setIsDragging={setIsDragging}
          fileInputRef={fileInputRef}
          handleFiles={handleFiles}
          policy={policy}
        />
      ) : null}

      </fieldset>
      {editingCategory || newCatOpen ? (
        <CategoryDialog
          initial={editingCategory}
          busy={busy}
          serverError={notice?.error ? notice.message : null}
          existingNames={categories.map((c) => c.name)}
          onClose={() => {
            if (!busy) { setEditingCategory(null); setNewCatOpen(false); }
          }}
          onSave={async (data) => {
            const ok = await run(() => editingCategory ? updateCategory(editingCategory.id, data) : createCategory(data), editingCategory ? 'Collection updated.' : 'Collection created.');
            if (ok) { setEditingCategory(null); setNewCatOpen(false); }
          }}
        />
      ) : null}

      {editingPhoto ? (
        <PhotoDialog
          photo={editingPhoto}
          busy={busy}
          serverError={notice?.error ? notice.message : null}
          categories={sortedCategories}
          onClose={() => { if (!busy) setEditingPhoto(null); }}
          onSave={async (patch) => {
            if (await run(() => updatePhoto(editingPhoto.id, patch), 'Photograph updated.')) setEditingPhoto(null);
          }}
        />
      ) : null}
    </div>
  );
}

function CategoriesPanel({
  categories,
  getCount,
  onEdit,
  onDelete,
  onReorderUp,
  onReorderDown,
  onTogglePublish,
  onNew,
}: {
  categories: GalleryCategory[];
  getCount: (id: string) => number;
  onEdit: (c: GalleryCategory) => void;
  onDelete: (c: GalleryCategory) => void;
  onReorderUp: (c: GalleryCategory) => void;
  onReorderDown: (c: GalleryCategory) => void;
  onTogglePublish: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forum-900">
            Gallery collections
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Create and reorder collections. Changes appear immediately on the
            homepage <span className="font-medium text-forum-800">Media Gallery</span>.
          </p>
        </div>
        <Button onClick={onNew} className="bg-brass-500 hover:bg-brass-700 text-forum-950">
          <FolderPlus className="h-4 w-4" /> New category
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-paper-border">
            <thead className="bg-forum-50/70">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-24">
                  <div className="flex items-center gap-1">
                    <ListOrdered className="h-3.5 w-3.5" /> Order
                  </div>
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                  Collection
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-24">
                  Photos
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-32">
                  Visibility
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-48">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-border bg-white">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-forum-50 text-forum-500 ring-1 ring-forum-100">
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <p className="font-medium text-forum-900">No categories yet</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Create your first collection above to start organising photos.
                    </p>
                  </td>
                </tr>
              ) : (
                categories.map((c, idx) => {
                  const count = getCount(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-forum-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-ink-muted">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-forum-700 w-6">
                            {c.displayOrder}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => onReorderUp(c)}
                              className="h-6 w-6 rounded-md text-forum-600 hover:bg-forum-100 disabled:opacity-30 disabled:hover:bg-transparent inline-flex items-center justify-center"
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === categories.length - 1}
                              onClick={() => onReorderDown(c)}
                              className="h-6 w-6 rounded-md text-forum-600 hover:bg-forum-100 disabled:opacity-30 disabled:hover:bg-transparent inline-flex items-center justify-center"
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-9 w-9 rounded-lg bg-forum-900/90 text-brass-200 ring-1 ring-forum-900/5 inline-flex items-center justify-center shrink-0">
                            <FolderKanban className="h-4.5 w-4.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-forum-900 leading-snug">
                              {c.name}
                            </div>
                            <p className="mt-0.5 text-sm text-ink-muted line-clamp-2 max-w-2xl">
                              {c.description || <span className="italic text-ink-subtle">No description provided.</span>}
                            </p>
                            <div className="mt-1 text-[11px] text-ink-subtle">
                              Created {new Date(c.createdAt).toLocaleDateString()} · Updated{' '}
                              {new Date(c.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="default" className="inline-flex items-center gap-1">
                          <Images className="h-3 w-3" /> {count}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          type="button"
                          onClick={() => onTogglePublish(c.id)}
                          className={`group relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            c.published ? 'bg-forum-900' : 'bg-ink-subtle/25'
                          }`}
                          aria-label="Toggle published"
                        >
                          <span
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transform transition-transform ${
                              c.published ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          >
                            {c.published ? (
                              <Eye className="h-3 w-3 text-forum-900" />
                            ) : (
                              <EyeOff className="h-3 w-3 text-ink-muted" />
                            )}
                          </span>
                        </button>
                        <div className="mt-1 text-[11px]">
                          {c.published ? (
                            <span className="text-success-700 font-medium">Published</span>
                          ) : (
                            <span className="text-ink-muted">Draft</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEdit(c)}
                            className="h-8 w-8 rounded-lg border border-paper-border text-forum-700 hover:bg-forum-50 hover:border-forum-200 inline-flex items-center justify-center"
                            aria-label="Edit category"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(c)}
                            className="h-8 w-8 rounded-lg border border-danger-200 text-danger-600 hover:bg-danger-50 hover:border-danger-300 inline-flex items-center justify-center"
                            aria-label="Delete category"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PhotosPanel({
  loading,
  loadError,
  photos,
  categories,
  catFilter,
  setCatFilter,
  catSearch,
  setCatSearch,
  onEdit,
  onDelete,
  onReorderUp,
  onReorderDown,
  onTogglePublish,
  onMove,
  photoCatForSelect,
  onUploadTab,
}: {
  photos: GalleryPhoto[];
  loading: boolean;
  loadError: string;
  categories: GalleryCategory[];
  catFilter: string;
  setCatFilter: (v: string) => void;
  catSearch: string;
  setCatSearch: (v: string) => void;
  onEdit: (p: GalleryPhoto) => void;
  onDelete: (p: GalleryPhoto) => void;
  onReorderUp: (p: GalleryPhoto) => void;
  onReorderDown: (p: GalleryPhoto) => void;
  onTogglePublish: (id: string) => void;
  onMove: (p: GalleryPhoto, target: string) => void;
  photoCatForSelect: (p: GalleryPhoto) => string;
  onUploadTab: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-forum-900">
            Photographs
          </h2>
          <p className="text-sm text-ink-muted mt-1">
            Edit caption, alt text, category assignment, and publishing status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="h-10 appearance-none rounded-lg border border-paper-border bg-white pl-3 pr-9 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
            >
              <option value="all">All collections</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          </div>
          <div className="relative">
            <input
              value={catSearch}
              onChange={(e) => setCatSearch(e.target.value)}
              placeholder="Search title, caption, alt…"
              className="h-10 w-full sm:w-64 rounded-lg border border-paper-border bg-white px-3 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
            />
          </div>
          <Button onClick={onUploadTab} className="bg-forum-900 hover:bg-forum-800">
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </div>

      {photos.length === 0 ? (loading || loadError ? null : (
        <Card className="p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-forum-50 text-forum-400 ring-1 ring-forum-100">
            <Images className="h-6 w-6" />
          </div>
          <p className="font-medium text-forum-900">No photographs match your filter</p>
          <p className="mt-1 text-sm text-ink-muted">
            Try another collection or upload new photographs.
          </p>
        </Card>
      )) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-paper-border">
              <thead className="bg-forum-50/70">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-28">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                    Photograph
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-40">
                    Collection
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-24">
                    <div className="flex items-center gap-1">
                      <ArrowUpDown className="h-3.5 w-3.5" /> Order
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-28">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-ink-subtle w-56">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-border bg-white">
                {photos.map((p) => {
                  const siblingCount = categories.find(c => c.id === p.categoryId)?.photoCount ?? 0;
                  return (
                    <tr key={p.id} className="hover:bg-forum-50/30 transition-colors">
                      <td className="px-4 py-3 align-top">
                        <div className="h-16 w-20 overflow-hidden rounded-lg ring-1 ring-paper-border bg-forum-100">
                          <GalleryImage
                            src={p.imageUrl}
                            alt={p.altText || p.title}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-forum-900 leading-snug">
                          {p.title || (
                            <span className="italic text-ink-subtle">Untitled</span>
                          )}
                        </div>
                        {p.caption ? (
                          <p className="mt-1 text-sm text-ink-muted line-clamp-2 max-w-xl">
                            {p.caption}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-ink-subtle">
                          <span>
                            {new Date(p.uploadedAt).toLocaleDateString()}
                          </span>
                          {p.fileSizeBytes ? (
                            <span>{formatFileSize(p.fileSizeBytes)}</span>
                          ) : null}
                          {p.aspect ? (
                            <span className="uppercase">{p.aspect}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <select
                          value={p.categoryId}
                          onChange={(e) => onMove(p, e.target.value)}
                          className="h-9 w-40 rounded-lg border border-paper-border bg-white px-2 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                          title={photoCatForSelect(p)}
                        >
                          {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-forum-700 w-5 text-right">
                            {p.displayOrder}
                          </span>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              disabled={p.displayOrder <= 1}
                              onClick={() => onReorderUp(p)}
                              className="h-6 w-6 rounded-md text-forum-600 hover:bg-forum-100 disabled:opacity-30 inline-flex items-center justify-center"
                              aria-label="Reorder up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={p.displayOrder >= siblingCount}
                              onClick={() => onReorderDown(p)}
                              className="h-6 w-6 rounded-md text-forum-600 hover:bg-forum-100 disabled:opacity-30 inline-flex items-center justify-center"
                              aria-label="Reorder down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <button
                          type="button"
                          aria-label={p.published ? 'Unpublish' : 'Publish'}
                          onClick={() => onTogglePublish(p.id)}
                          className={`group relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                            p.published ? 'bg-forum-900' : 'bg-ink-subtle/25'
                          }`}
                        >
                          <span
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transform transition-transform ${
                              p.published ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          >
                            {p.published ? (
                              <Eye className="h-3 w-3 text-forum-900" />
                            ) : (
                              <EyeOff className="h-3 w-3 text-ink-muted" />
                            )}
                          </span>
                        </button>
                        <div className="mt-1 text-[11px]">
                          {p.published ? (
                            <span className="text-success-700 font-medium">Live</span>
                          ) : (
                            <span className="text-ink-muted">Hidden</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onEdit(p)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-paper-border px-2.5 text-xs font-medium text-forum-700 hover:bg-forum-50 hover:border-forum-200"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(p)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-danger-200 px-2.5 text-xs font-medium text-danger-600 hover:bg-danger-50 hover:border-danger-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function UploadPanel({
  categories,
  defaultCategoryId,
  setDefaultCategoryId,
  uploadTasks,
  setUploadTasks,
  isDragging,
  setIsDragging,
  fileInputRef,
  handleFiles,
  policy,
}: {
  categories: GalleryCategory[];
  defaultCategoryId: string;
  setDefaultCategoryId: (v: string) => void;
  uploadTasks: PhotoUploadTask[];
  setUploadTasks: React.Dispatch<React.SetStateAction<PhotoUploadTask[]>>;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  handleFiles: (f: FileList | File[]) => void;
  policy: GalleryPolicy | null;
}) {
  const MAX_UPLOAD_MB = (policy?.maxBytes ?? 0) / 1024 / 1024;
  const ACCEPTED_EXTENSIONS = policy?.extensions ?? [];
  const ACCEPTED_FILE_ATTR = [...(policy?.mimeTypes ?? []), ...ACCEPTED_EXTENSIONS.map(e => `.${e}`)].join(',');
  const anyQueued = uploadTasks.some((t) => t.status === 'queued' || t.status === 'uploading');
  const successCount = uploadTasks.filter((t) => t.status === 'success').length;
  const errorCount = uploadTasks.filter((t) => t.status === 'error').length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-forum-900">
          Upload photographs
        </h2>
        <p className="text-sm text-ink-muted mt-1">
          Drop images below, or click to browse. You can queue multiple
          photographs at once. Original images are stored securely and displayed
          in the gallery when published.
        </p>
      </div>

      <Card className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Default collection
            </label>
            <div className="relative">
              <select
                value={defaultCategoryId}
                onChange={(e) => setDefaultCategoryId(e.target.value)}
                disabled={categories.length === 0}
                className="h-11 w-full appearance-none rounded-xl border border-paper-border bg-white pl-3 pr-10 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100 disabled:opacity-50"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </div>
            {categories.length === 0 ? (
              <p className="mt-1 text-xs text-danger-600">
                You must first create at least one category.
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Upload limits
            </label>
            <div className="h-11 flex items-center gap-3 rounded-xl border border-paper-border bg-forum-50/60 px-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white ring-1 ring-paper-border text-brass-700 shrink-0">
                <FileImage className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs leading-snug">
                <div className="font-semibold text-forum-800">
                  Max {MAX_UPLOAD_MB.toFixed(0)} MB per photograph
                </div>
                <div className="text-ink-muted">
                  Accepted formats:{' '}
                  <span className="uppercase font-medium">{ACCEPTED_EXTENSIONS.join(', ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative cursor-pointer select-none rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center transition-colors ${
            isDragging
              ? 'border-forum-500 bg-forum-50'
              : 'border-forum-200 bg-white hover:bg-forum-50/50 hover:border-forum-300'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_ATTR}
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
            className="sr-only"
          />
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forum-900 text-brass-100 shadow-sm ring-1 ring-inset ring-white/10">
            <Upload className="h-6.5 w-6.5" />
          </div>
          <p className="font-display text-lg font-semibold text-forum-900">
            {isDragging ? 'Drop your photographs here' : 'Drag & drop photographs'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            or <span className="font-semibold text-forum-700 underline-offset-2 hover:underline">click to browse</span>.
            Multi-select supported.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11px]">
            <Badge variant="default" className="bg-white ring-1 ring-forum-100">
              JPG / JPEG
            </Badge>
            <Badge variant="default" className="bg-white ring-1 ring-forum-100">
              PNG
            </Badge>
            <Badge variant="default" className="bg-white ring-1 ring-forum-100">
              WebP
            </Badge>
            <Badge
              variant="info"
              className="bg-forum-50 text-forum-700 ring-1 ring-forum-100"
            >
              ≤ {MAX_UPLOAD_MB.toFixed(0)} MB
            </Badge>
          </div>
        </div>

        {uploadTasks.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {successCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-success-700 ring-1 ring-success-100 font-medium">
                    <Check className="h-3 w-3" /> {successCount} successful
                  </span>
                ) : null}
                {errorCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2.5 py-1 text-danger-700 ring-1 ring-danger-100 font-medium">
                    <AlertCircle className="h-3 w-3" /> {errorCount} rejected
                  </span>
                ) : null}
                {anyQueued ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-forum-50 px-2.5 py-1 text-forum-700 ring-1 ring-forum-100 font-medium animate-pulse">
                    <Upload className="h-3 w-3" /> Processing…
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() =>
                  setUploadTasks((prev) =>
                    prev.filter(
                      (t) => t.status === 'queued' || t.status === 'uploading'
                    )
                  )
                }
                disabled={anyQueued}
                className="inline-flex items-center gap-1 rounded-lg border border-paper-border bg-white px-2.5 py-1.5 text-xs font-medium text-forum-700 hover:bg-forum-50 disabled:opacity-40"
              >
                <X className="h-3.5 w-3.5" /> Clear completed
              </button>
            </div>
            <div className="divide-y divide-paper-border rounded-xl border border-paper-border bg-white">
              {uploadTasks.map((t) => (
                <div key={t.id} className="grid grid-cols-[1fr_auto] items-center gap-4 px-3 sm:px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg ring-1 ring-paper-border bg-forum-50 flex items-center justify-center">
                      {t.previewUrl ? (
                        <GalleryImage
                          src={t.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <FileImage className="h-4.5 w-4.5 text-forum-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="truncate text-sm font-medium text-forum-900">
                          {t.name}
                        </p>
                        <span className="shrink-0 text-[11px] text-ink-subtle">
                          {formatFileSize(t.sizeBytes)}
                        </span>
                      </div>
                      {t.status === 'error' ? (
                        <p className="mt-0.5 text-xs text-danger-700 inline-flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {t.error ?? 'Upload failed.'}
                        </p>
                      ) : t.status === 'success' ? (
                        <p className="mt-0.5 text-xs text-success-700 inline-flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Photograph added. You can edit title, caption, and alt text in the Photographs tab.
                        </p>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-forum-100">
                            <div
                              className={`h-full transition-[width] duration-150 ease-out rounded-full ${
                                t.status === 'uploading' || t.status === 'queued'
                                  ? 'bg-forum-700'
                                  : 'bg-forum-400'
                              }`}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-medium text-forum-700 tabular-nums w-10 text-right">
                            {t.progress}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {t.status === 'success' ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-success-50 text-success-700 ring-1 ring-success-100">
                        <Check className="h-4 w-4" />
                      </span>
                    ) : t.status === 'error' ? (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-danger-50 text-danger-600 ring-1 ring-danger-100">
                        <AlertCircle className="h-4 w-4" />
                      </span>
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-forum-50 text-forum-600 ring-1 ring-forum-100 animate-pulse">
                        <Upload className="h-4 w-4" />
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setUploadTasks((prev) => prev.filter((p) => p.id !== t.id))
                      }
                      className="h-8 w-8 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700 inline-flex items-center justify-center"
                      aria-label="Remove task"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

function CategoryDialog({
  initial,
  existingNames,
  onClose,
  onSave,
  busy,
  serverError,
}: {
  busy: boolean;
  serverError: string | null;
  initial: GalleryCategory | null;
  existingNames: string[];
  onClose: () => void;
  onSave: (data: {
    name: string;
    description: string;
    displayOrder: number;
    published: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [displayOrder, setDisplayOrder] = useState<number>(initial?.displayOrder ?? 10);
  const [published, setPublished] = useState<boolean>(initial?.published ?? true);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a category name.');
      return;
    }
    const duplicate = existingNames.some(
      (n) => n.toLowerCase() === trimmed.toLowerCase() && n !== initial?.name
    );
    if (duplicate) {
      setError('A category with this name already exists.');
      return;
    }
    void onSave({
      name: trimmed,
      description: description.trim(),
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 10,
      published,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-forum-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        role="dialog" aria-modal="true"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl ring-1 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <fieldset disabled={busy} className="min-w-0 overflow-y-auto">
        {serverError && <p role="alert" className="m-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{serverError}</p>}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-paper-border bg-forum-50/60">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900">
              {initial ? 'Edit collection' : 'New collection'}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Collections appear on the homepage Media Gallery when published.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-paper-border bg-white text-forum-700 hover:bg-forum-50 inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Category name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Spring Symposium 2026"
              className="h-11 w-full rounded-xl border border-paper-border bg-white px-3 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the contents of this collection for the homepage heading."
              className="w-full resize-y rounded-xl border border-paper-border bg-white px-3 py-2.5 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Display order
              </label>
              <input
                type="number"
                min={1}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value) || 1)}
                className="h-11 w-full rounded-xl border border-paper-border bg-white px-3 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Visibility
              </label>
              <div className="h-11 rounded-xl border border-paper-border bg-white px-3 flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Published"
                  onClick={() => setPublished((v) => !v)}
                  className={`group relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    published ? 'bg-forum-900' : 'bg-ink-subtle/25'
                  }`}
                  aria-pressed={published}
                >
                  <span
                    className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transform transition-transform ${
                      published ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  >
                    {published ? (
                      <Eye className="h-3 w-3 text-forum-900" />
                    ) : (
                      <EyeOff className="h-3 w-3 text-ink-muted" />
                    )}
                  </span>
                </button>
                <span className="text-sm font-medium text-forum-800">
                  {published ? 'Published' : 'Draft'}
                </span>
              </div>
            </div>
          </div>
          {error ? (
            <div className="rounded-xl bg-danger-50 ring-1 ring-danger-100 text-danger-700 px-3 py-2.5 text-sm inline-flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-paper-border bg-forum-50/40">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="bg-forum-900 hover:bg-forum-800">
            <Save className="h-4 w-4" /> {initial ? 'Save changes' : 'Create category'}
          </Button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}

function PhotoDialog({
  photo,
  categories,
  onClose,
  onSave,
  busy,
  serverError,
}: {
  photo: GalleryPhoto;
  busy: boolean;
  serverError: string | null;
  categories: GalleryCategory[];
  onClose: () => void;
  onSave: (patch: Partial<Pick<GalleryPhoto, 'categoryId' | 'title' | 'caption' | 'altText' | 'published' | 'displayOrder'>>) => Promise<void>;
}) {
  const [title, setTitle] = useState(photo.title ?? '');
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [altText, setAltText] = useState(photo.altText ?? '');
  const [displayOrder, setDisplayOrder] = useState<number>(photo.displayOrder ?? 1);
  const [published, setPublished] = useState<boolean>(photo.published ?? true);
  const [categoryId, setCategoryId] = useState<string>(photo.categoryId);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) { setError('Please enter a photograph title.'); return; }
    if (!categories.some((c) => c.id === categoryId)) {
      setError('Please assign a valid category.');
      return;
    }
    void onSave({
      title: title.trim(),
      caption: caption.trim(),
      altText: altText.trim(),
      displayOrder: Number.isFinite(displayOrder) ? displayOrder : 1,
      published,
      categoryId,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-forum-950/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <form
        role="dialog" aria-modal="true"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl ring-1 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
      >
        <fieldset disabled={busy} className="min-w-0 overflow-y-auto">
        {serverError && <p role="alert" className="m-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-700">{serverError}</p>}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-paper-border bg-forum-50/60">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900">
              Edit photograph
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              Update metadata, accessibility, and category assignment.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg border border-paper-border bg-white text-forum-700 hover:bg-forum-50 inline-flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                Preview
              </label>
              <div className="overflow-hidden rounded-2xl ring-1 ring-paper-border bg-forum-100 aspect-video">
                <GalleryImage
                  src={photo.imageUrl}
                  alt={photo.altText || photo.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="mt-3 rounded-xl bg-forum-50 ring-1 ring-forum-100 p-3.5 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-ink-subtle">Uploaded</span>
                  <span className="text-forum-800 font-medium">
                    {new Date(photo.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
                {photo.fileSizeBytes ? (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-subtle">File size</span>
                    <span className="text-forum-800 font-medium">
                      {formatFileSize(photo.fileSizeBytes)}
                    </span>
                  </div>
                ) : null}
                {photo.aspect ? (
                  <div className="flex items-center justify-between">
                    <span className="text-ink-subtle">Aspect</span>
                    <span className="text-forum-800 font-medium uppercase">
                      {photo.aspect}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="md:col-span-3 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Formal title for this photograph"
                  className="h-11 w-full rounded-xl border border-paper-border bg-white px-3 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={3}
                  placeholder="Optional narrative caption shown under the thumbnail on the homepage."
                  className="w-full resize-y rounded-xl border border-paper-border bg-white px-3 py-2.5 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Alternative text
                </label>
                <textarea
                  value={altText}
                  onChange={(e) => setAltText(e.target.value)}
                  rows={2}
                  placeholder="Describe the image for screen readers and search engines."
                  className="w-full resize-y rounded-xl border border-paper-border bg-white px-3 py-2.5 text-sm text-forum-800 placeholder:text-ink-muted focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                    <span className="inline-flex items-center gap-1">
                      <MoveRight className="h-3 w-3" /> Collection
                    </span>
                  </label>
                  <div className="relative">
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-paper-border bg-white pl-3 pr-10 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                    Display order
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value) || 1)}
                    className="h-11 w-full rounded-xl border border-paper-border bg-white px-3 text-sm text-forum-800 focus:border-forum-400 focus:outline-none focus:ring-2 focus:ring-forum-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                  Visibility
                </label>
                <div className="h-11 rounded-xl border border-paper-border bg-white px-3 flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Published"
                  onClick={() => setPublished((v) => !v)}
                    aria-pressed={published}
                    className={`group relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                      published ? 'bg-forum-900' : 'bg-ink-subtle/25'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/5 transform transition-transform ${
                        published ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    >
                      {published ? (
                        <Eye className="h-3 w-3 text-forum-900" />
                      ) : (
                        <EyeOff className="h-3 w-3 text-ink-muted" />
                      )}
                    </span>
                  </button>
                  <span className="text-sm font-medium text-forum-800">
                    {published ? 'Published on homepage' : 'Hidden (draft)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {error ? (
            <div className="rounded-xl bg-danger-50 ring-1 ring-danger-100 text-danger-700 px-3 py-2.5 text-sm inline-flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5" /> {error}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-paper-border bg-forum-50/40">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="bg-forum-900 hover:bg-forum-800">
            <Save className="h-4 w-4" /> Save photograph
          </Button>
        </div>
        </fieldset>
      </form>
    </div>
  );
}
