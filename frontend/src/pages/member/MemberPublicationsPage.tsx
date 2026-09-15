import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  TrendingUp,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput } from '../../components/common/Input';
import {
  manuscriptOf,
  memberApi,
  type MemberPublication,
  type MemberPublicationsResult,
  type PublicationStatusLabel,
} from '../../api/member';
import { normalizeError } from '../../api/client';
import { downloadAttachment } from '../../api/messaging';
import { useApiData } from '../../hooks/useApiData';
import { localFileError } from '../../hooks/useAttachments';
import { useAuth } from '../../context/AuthContext';

interface PaperForm {
  title: string;
  category: string;
  articleType: string;
  journal: string;
  authors: string;
  correspondingAuthor: string;
  email: string;
  orcid: string;
  abstract: string;
  keywords: string;
  funding: string;
  conflicts: string;
  ethicsApproval: string;
  coverLetter: string;
}

const emptyForm: PaperForm = {
  title: '', category: '', articleType: '', journal: '', authors: '', correspondingAuthor: '',
  email: '', orcid: '', abstract: '', keywords: '', funding: '', conflicts: '',
  ethicsApproval: '', coverLetter: '',
};

type Status = 'All' | PublicationStatusLabel;

const STATUS_OPTIONS: Status[] = ['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Published'];
const PAGE_SIZE = 20;

const statusConfig: Record<PublicationStatusLabel, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: FileText },
  Submitted: { variant: 'info', icon: Clock },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'info', icon: ShieldCheck },
  Rejected: { variant: 'danger', icon: XCircle },
  Published: { variant: 'success', icon: BookOpenCheck },
};

const categoryColors: Record<string, 'default' | 'success' | 'warning' | 'info' | 'brass'> = {
  'Mental Health': 'info',
  'Scientific Research': 'default',
  'Product Reviews': 'warning',
  'Service Analysis': 'success',
};

/**
 * The API names these fields for the domain; the form names them for the user.
 * Without this map a 422 on `researchType` would attach its message to a field
 * that does not exist and the member would see nothing at all.
 */
const SERVER_FIELD_TO_FORM: Record<string, string> = {
  researchType: 'articleType',
  venue: 'journal',
  correspondingEmail: 'email',
  manuscriptFileId: 'paperFile',
  supplementaryFileId: 'supplementaryFile',
};

/** Extensions the server's upload allowlist actually accepts (no ZIP, no legacy XLS). */
const SUPPLEMENTARY_EXTENSIONS = ['pdf', 'doc', 'docx', 'xlsx'];

const inputClass = 'w-full rounded-md border border-paper-border bg-paper px-3 py-2.5 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600';

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : '—';

export default function MemberPublicationsPage() {
  const { user } = useAuth();

  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<Status>('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);

  // Rows accumulate across "Load more", so they live here rather than being
  // read straight off the latest response.
  const [rows, setRows] = useState<MemberPublication[]>([]);
  const [total, setTotal] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<PaperForm>(emptyForm);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [supplementaryFile, setSupplementaryFile] = useState<File | null>(null);
  const [confirmOriginal, setConfirmOriginal] = useState(false);
  const [confirmPolicy, setConfirmPolicy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /**
   * File ids already uploaded for the form currently open. A failed create must
   * not cost the member a second upload of a 20 MB PDF on retry; cleared
   * whenever the chosen file changes or the modal closes.
   */
  const uploaded = useRef<{ manuscript?: string; supplementary?: string }>({});

  // One request per pause in typing, not one per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // Any filter change restarts paging; otherwise page 2 of the old filter leaks in.
  useEffect(() => { setPage(1); }, [status, category, debouncedSearch]);

  const { data, loading, error } = useApiData<MemberPublicationsResult>(
    () => memberApi.publications({ status, category, q: debouncedSearch, page, limit: PAGE_SIZE }),
    [status, category, debouncedSearch, page, reloadKey],
  );

  useEffect(() => {
    if (!data) return;
    setTotal(data.pagination.total);
    setRows((previous) => (data.pagination.page === 1 ? data.items : [...previous, ...data.items]));
  }, [data]);

  const stats = data?.stats ?? null;
  const hasActiveFilters = status !== 'All' || category !== 'All' || search.trim() !== '';
  const clearFilters = () => { setStatus('All'); setCategory('All'); setSearch(''); };
  const refresh = () => { setPage(1); setReloadKey((key) => key + 1); };

  const initialLoading = loading && page === 1;
  const loadingMore = loading && page > 1;
  const showList = !initialLoading && !error && rows.length > 0;
  const canLoadMore = showList && rows.length < total;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3500);
  };

  const updateForm = (field: keyof PaperForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const openModal = () => {
    // The corresponding author is almost always the member submitting, so the
    // two fields they would retype are filled in for them.
    setForm({ ...emptyForm, correspondingAuthor: user?.fullName ?? '', email: user?.email ?? '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setPaperFile(null);
    setSupplementaryFile(null);
    setConfirmOriginal(false);
    setConfirmPolicy(false);
    setErrors({});
    setSubmitError('');
    uploaded.current = {};
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!form.title.trim()) nextErrors.title = 'Paper title is required.';
    if (!form.category) nextErrors.category = 'Select a category.';
    if (!form.articleType) nextErrors.articleType = 'Select an article type.';
    if (!form.journal) nextErrors.journal = 'Select a preferred journal.';
    if (!form.authors.trim()) nextErrors.authors = 'Enter all author names.';
    if (!form.correspondingAuthor.trim()) nextErrors.correspondingAuthor = 'Corresponding author is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email address.';
    if (form.orcid.trim() && !/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(form.orcid.trim())) {
      nextErrors.orcid = 'Enter an ORCID as 0000-0000-0000-0000.';
    }
    if (form.abstract.trim().length < 100) nextErrors.abstract = 'Abstract must contain at least 100 characters.';
    if (!form.keywords.trim()) nextErrors.keywords = 'Enter at least three keywords.';
    if (!form.conflicts.trim()) nextErrors.conflicts = 'Enter a conflict-of-interest statement or “None”.';
    if (!paperFile) nextErrors.paperFile = 'Upload the manuscript PDF.';
    else if (paperFile.type !== 'application/pdf') nextErrors.paperFile = 'The manuscript must be a PDF file.';
    else if (paperFile.size > 20 * 1024 * 1024) nextErrors.paperFile = 'PDF size must not exceed 20 MB.';
    if (supplementaryFile) {
      const invalid = localFileError(supplementaryFile, SUPPLEMENTARY_EXTENSIONS);
      if (invalid) nextErrors.supplementaryFile = invalid;
    }
    if (!confirmOriginal) nextErrors.confirmOriginal = 'Confirm that this is original work.';
    if (!confirmPolicy) nextErrors.confirmPolicy = 'Accept the publication policy.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // A second submit while the first is in flight would create a duplicate
    // manuscript; the server's title check is the backstop, this is the guard.
    if (isSubmitting) return;
    setSubmitError('');
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      if (!uploaded.current.manuscript) {
        uploaded.current.manuscript = (await memberApi.uploadFile(paperFile!)).id;
      }
      if (supplementaryFile && !uploaded.current.supplementary) {
        uploaded.current.supplementary = (await memberApi.uploadFile(supplementaryFile)).id;
      }

      await memberApi.createPublication({
        title: form.title.trim(),
        category: form.category,
        researchType: form.articleType,
        venue: form.journal,
        authors: form.authors.trim(),
        correspondingAuthor: form.correspondingAuthor.trim(),
        correspondingEmail: form.email.trim(),
        ...(form.orcid.trim() ? { orcid: form.orcid.trim() } : {}),
        abstract: form.abstract.trim(),
        keywords: form.keywords.trim(),
        ...(form.funding.trim() ? { funding: form.funding.trim() } : {}),
        conflicts: form.conflicts.trim(),
        ...(form.ethicsApproval.trim() ? { ethicsApproval: form.ethicsApproval.trim() } : {}),
        ...(form.coverLetter.trim() ? { coverLetter: form.coverLetter.trim() } : {}),
        manuscriptFileId: uploaded.current.manuscript!,
        ...(uploaded.current.supplementary ? { supplementaryFileId: uploaded.current.supplementary } : {}),
        confirmOriginal: true,
        confirmPolicy: true,
      });

      closeModal();
      showToast('Paper submitted successfully and sent for approval.');
      // Refetched from the server rather than patched in locally, so the row
      // shows the status the API actually assigned it.
      refresh();
    } catch (failure) {
      const normalized = normalizeError(failure);
      setSubmitError(normalized.message);
      setErrors((current) => {
        const next = { ...current };
        for (const [field, message] of Object.entries(normalized.fieldErrors)) {
          next[SERVER_FIELD_TO_FORM[field] ?? field] = message;
        }
        return next;
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const download = async (publication: MemberPublication) => {
    const file = manuscriptOf(publication);
    if (!file) return;
    setDownloadingId(publication.id);
    try {
      await downloadAttachment(file.id, file.name);
    } catch (failure) {
      showToast(normalizeError(failure).message);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && <div role="status" className="fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-lg bg-forum-900 px-4 py-3 text-sm text-white shadow-xl"><CheckCircle2 className="h-4 w-4" />{toast}<button aria-label="Close notification" onClick={() => setToast('')}><X className="h-4 w-4" /></button></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Published Works', value: stats ? stats.published.toString() : '…', icon: FileText, color: 'bg-forum-50 text-forum-700' },
          { label: 'Total Views', value: stats ? stats.views.toLocaleString() : '…', icon: Eye, color: 'bg-slateteal-100 text-slateteal-700' },
          { label: 'Total Downloads', value: stats ? stats.downloads.toLocaleString() : '…', icon: Download, color: 'bg-brass-100 text-brass-700' },
          {
            label: 'Avg. Readership',
            value: !stats ? '…' : stats.readershipTrend === null ? '—' : `${stats.readershipTrend > 0 ? '+' : ''}${stats.readershipTrend}%`,
            icon: TrendingUp,
            color: 'bg-forum-50 text-forum-700',
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="p-5"><div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div><p className="mt-4 font-display text-2xl font-semibold text-forum-900">{value}</p><p className="mt-0.5 text-sm text-ink-muted">{label}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" /><input type="search" placeholder="Search by title, venue, DOI..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-paper-border bg-paper py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SelectInput label="Status" value={status} onChange={(event) => setStatus(event.target.value as Status)} className="sm:mb-0">{STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'All' ? 'All Statuses' : option}</option>)}</SelectInput>
            <SelectInput label={<span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Category</span>} value={category} onChange={(event) => setCategory(event.target.value)} className="sm:mb-0"><option value="All">All Categories</option><option value="Mental Health">Mental Health</option><option value="Scientific Research">Scientific Research</option><option value="Product Reviews">Product Reviews</option><option value="Service Analysis">Service Analysis</option></SelectInput>
            <Button onClick={openModal}><Upload className="h-4 w-4" />Submit New Paper</Button>
          </div>
        </CardContent>
      </Card>

      {initialLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} onSubmit={openModal} />
      ) : null}

      {showList && (
        <div className="space-y-4">
          {rows.map((publication) => {
            const config = statusConfig[publication.status] ?? statusConfig.Draft;
            const StatusIcon = config.icon;
            const manuscript = manuscriptOf(publication);
            const isPublished = publication.status === 'Published';
            return (
              <Card key={publication.id}><CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={categoryColors[publication.category] || 'default'}>{publication.category}</Badge><Badge variant={config.variant}><StatusIcon className="mr-1 h-2.5 w-2.5" />{publication.status}</Badge>{publication.doi && <span className="inline-flex items-center rounded-md border border-paper-border bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-muted">DOI: {publication.doi}</span>}</div><h3 className="mt-3 text-lg font-semibold leading-snug text-forum-900">{publication.title}</h3>{publication.venue && <p className="mt-1 text-sm text-ink-muted">{publication.venue}</p>}{publication.authors && <p className="mt-1 text-xs text-ink-subtle">Authors: {publication.authors}</p>}<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-subtle"><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{isPublished ? 'Published' : 'Submitted'} {formatDate(isPublished ? publication.publishedAt : publication.submittedAt)}</span><span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{publication.views.toLocaleString()} views</span><span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />{publication.downloads.toLocaleString()} downloads</span></div>{publication.decisionNote && publication.status !== 'Published' && (
                  <div className={`mt-3 rounded-lg border p-3 ${publication.status === 'Rejected' ? 'border-danger-600/20 bg-danger-100' : 'border-paper-border bg-forum-50/60'}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${publication.status === 'Rejected' ? 'text-danger-600' : 'text-ink-subtle'}`}>
                      Reviewer note · {formatDate(publication.decisionNote.at)}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">{publication.decisionNote.comment}</p>
                  </div>
                )}</div></div>
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper-border pt-4">{isPublished && <Button size="sm" variant="ghost" as="link" to={`/research/${publication.slug ?? publication.id}`}><Eye className="h-4 w-4" />View Public Page</Button>}<Button size="sm" variant="outline" disabled={!manuscript || downloadingId === publication.id} onClick={() => void download(publication)}>{downloadingId === publication.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download PDF</Button>{isPublished && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/research/${publication.slug ?? publication.id}`); showToast('Publication link copied.'); }}><Share2 className="h-4 w-4" />Share</Button>}{isPublished && <div className="ml-auto flex items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 font-medium text-brass-700"><TrendingUp className="h-3.5 w-3.5" />Trending</span></div>}</div>
              </CardContent></Card>
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="submit-paper-title">
          <form onSubmit={handleSubmit} className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-paper shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-paper-border bg-paper px-5 py-4 sm:px-7"><div><h2 id="submit-paper-title" className="font-display text-xl font-semibold text-forum-900">Submit New Paper</h2><p className="mt-1 text-sm text-ink-muted">Complete all required fields marked with an asterisk (*).</p></div><button type="button" aria-label="Close submission form" onClick={closeModal} className="rounded-md p-1.5 text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button></div>
            <div className="space-y-7 p-5 sm:p-7">
              {submitError && <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger-600/20 bg-danger-100 p-4"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger-600" /><p className="text-sm text-danger-600">{submitError}</p></div>}

              <section><h3 className="font-semibold text-forum-900">Paper details</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">Paper title *<input value={form.title} onChange={(event) => updateForm('title', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Enter the complete paper title" />{errors.title && <span className="mt-1 block text-xs text-red-600">{errors.title}</span>}</label>
                <label className="text-sm font-medium text-ink-muted">Category *<select value={form.category} onChange={(event) => updateForm('category', event.target.value)} className={`mt-1.5 ${inputClass}`}><option value="">Select category</option><option>Mental Health</option><option>Scientific Research</option><option>Product Reviews</option><option>Service Analysis</option></select>{errors.category && <span className="mt-1 block text-xs text-red-600">{errors.category}</span>}</label>
                <label className="text-sm font-medium text-ink-muted">Article type *<select value={form.articleType} onChange={(event) => updateForm('articleType', event.target.value)} className={`mt-1.5 ${inputClass}`}><option value="">Select article type</option><option>Original Research</option><option>Review Article</option><option>Systematic Review / Meta-analysis</option><option>Case Study</option><option>Short Communication</option><option>Commentary</option></select>{errors.articleType && <span className="mt-1 block text-xs text-red-600">{errors.articleType}</span>}</label>
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">Preferred journal *<select value={form.journal} onChange={(event) => updateForm('journal', event.target.value)} className={`mt-1.5 ${inputClass}`}><option value="">Select journal</option><option>IFSMHP Journal of Clinical Mental Health</option><option>IFSMHP International Journal of Mental Health Systems</option><option>IFSMHP Psychology of Well-Being</option><option>IFSMHP Frontiers in Occupational Mental Health</option></select>{errors.journal && <span className="mt-1 block text-xs text-red-600">{errors.journal}</span>}</label>
              </div></section>

              <section><h3 className="font-semibold text-forum-900">Author information</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">All authors *<input value={form.authors} onChange={(event) => updateForm('authors', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Separate author names with commas" />{errors.authors && <span className="mt-1 block text-xs text-red-600">{errors.authors}</span>}</label>
                <label className="text-sm font-medium text-ink-muted">Corresponding author *<input value={form.correspondingAuthor} onChange={(event) => updateForm('correspondingAuthor', event.target.value)} className={`mt-1.5 ${inputClass}`} />{errors.correspondingAuthor && <span className="mt-1 block text-xs text-red-600">{errors.correspondingAuthor}</span>}</label>
                <label className="text-sm font-medium text-ink-muted">Corresponding email *<input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} className={`mt-1.5 ${inputClass}`} />{errors.email && <span className="mt-1 block text-xs text-red-600">{errors.email}</span>}</label>
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">ORCID ID<input value={form.orcid} onChange={(event) => updateForm('orcid', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0000-0000-0000-0000" />{errors.orcid && <span className="mt-1 block text-xs text-red-600">{errors.orcid}</span>}</label>
              </div></section>

              <section><h3 className="font-semibold text-forum-900">Research summary</h3><div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-ink-muted">Abstract *<textarea rows={6} maxLength={4000} value={form.abstract} onChange={(event) => updateForm('abstract', event.target.value)} className={`mt-1.5 resize-y ${inputClass}`} placeholder="Include background, methods, results and conclusion" /><span className="mt-1 flex justify-between text-xs"><span className="text-red-600">{errors.abstract}</span><span className="text-ink-subtle">{form.abstract.length}/4000</span></span></label>
                <label className="block text-sm font-medium text-ink-muted">Keywords *<input value={form.keywords} onChange={(event) => updateForm('keywords', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Example: telehealth, anxiety, clinical trial" />{errors.keywords && <span className="mt-1 block text-xs text-red-600">{errors.keywords}</span>}</label>
              </div></section>

              <section><h3 className="font-semibold text-forum-900">Compliance declarations</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-ink-muted">Funding information<textarea rows={3} value={form.funding} onChange={(event) => updateForm('funding', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Funding organisation and grant number, or None" /></label>
                <label className="text-sm font-medium text-ink-muted">Conflict of interest *<textarea rows={3} value={form.conflicts} onChange={(event) => updateForm('conflicts', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Declare conflicts, or enter None" />{errors.conflicts && <span className="mt-1 block text-xs text-red-600">{errors.conflicts}</span>}</label>
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">Ethics approval / registration number<textarea rows={3} value={form.ethicsApproval} onChange={(event) => updateForm('ethicsApproval', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Committee name, approval number and date, if applicable" /></label>
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">Cover letter<textarea rows={4} value={form.coverLetter} onChange={(event) => updateForm('coverLetter', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Explain the importance and originality of this paper" /></label>
              </div></section>

              <section><h3 className="font-semibold text-forum-900">Upload files</h3><div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="cursor-pointer rounded-xl border-2 border-dashed border-paper-border p-5 text-center hover:border-forum-400"><Upload className="mx-auto h-6 w-6 text-forum-700" /><span className="mt-2 block text-sm font-medium text-forum-900">Manuscript PDF *</span><span className="mt-1 block text-xs text-ink-subtle">PDF only, maximum 20 MB</span><span className="mt-2 block truncate text-xs text-forum-700">{paperFile?.name ?? 'Choose file'}</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { setPaperFile(event.target.files?.[0] ?? null); uploaded.current.manuscript = undefined; setErrors((current) => ({ ...current, paperFile: '' })); }} />{errors.paperFile && <span className="mt-2 block text-xs text-red-600">{errors.paperFile}</span>}</label>
                <label className="cursor-pointer rounded-xl border-2 border-dashed border-paper-border p-5 text-center hover:border-forum-400"><FileText className="mx-auto h-6 w-6 text-forum-700" /><span className="mt-2 block text-sm font-medium text-forum-900">Supplementary file</span><span className="mt-1 block text-xs text-ink-subtle">PDF, DOC, DOCX or XLSX</span><span className="mt-2 block truncate text-xs text-forum-700">{supplementaryFile?.name ?? 'Choose file'}</span><input type="file" accept=".pdf,.doc,.docx,.xlsx" className="sr-only" onChange={(event) => { setSupplementaryFile(event.target.files?.[0] ?? null); uploaded.current.supplementary = undefined; setErrors((current) => ({ ...current, supplementaryFile: '' })); }} />{errors.supplementaryFile && <span className="mt-2 block text-xs text-red-600">{errors.supplementaryFile}</span>}</label>
              </div></section>

              <section className="space-y-3 rounded-xl bg-forum-50/60 p-4">
                <label className="flex items-start gap-3 text-sm text-ink-muted"><input type="checkbox" checked={confirmOriginal} onChange={(event) => { setConfirmOriginal(event.target.checked); setErrors((current) => ({ ...current, confirmOriginal: '' })); }} className="mt-0.5 h-4 w-4 accent-forum-700" /><span>I confirm that this manuscript is original, has not been published elsewhere and is approved by all listed authors. *</span></label>{errors.confirmOriginal && <p className="text-xs text-red-600">{errors.confirmOriginal}</p>}
                <label className="flex items-start gap-3 text-sm text-ink-muted"><input type="checkbox" checked={confirmPolicy} onChange={(event) => { setConfirmPolicy(event.target.checked); setErrors((current) => ({ ...current, confirmPolicy: '' })); }} className="mt-0.5 h-4 w-4 accent-forum-700" /><span>I agree to the IFSMHP publication, peer-review, ethics and privacy policies. *</span></label>{errors.confirmPolicy && <p className="text-xs text-red-600">{errors.confirmPolicy}</p>}
              </section>
            </div>
            <div className="sticky bottom-0 flex flex-col-reverse justify-end gap-2 border-t border-paper-border bg-paper px-5 py-4 sm:flex-row sm:px-7"><Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit Paper for Review'}{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}</Button></div>
          </form>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading publications">
      {[0, 1, 2].map((key) => (
        <Card key={key}>
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div className="flex gap-2">
              <div className="h-5 w-28 animate-pulse rounded-full border border-paper-border bg-paper" />
              <div className="h-5 w-24 animate-pulse rounded-full border border-paper-border bg-paper" />
            </div>
            <div className="h-6 w-3/4 animate-pulse rounded border border-paper-border bg-paper" />
            <div className="h-4 w-1/2 animate-pulse rounded border border-paper-border bg-paper" />
            <div className="h-9 animate-pulse rounded border border-paper-border bg-paper" />
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
        <h3 className="mt-4 font-semibold text-forum-900">Could not load your publications</h3>
        <p className="mt-1 text-sm text-ink-muted">{message}</p>
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyState({ hasFilters, onClear, onSubmit }: { hasFilters: boolean; onClear: () => void; onSubmit: () => void }) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <BookOpenCheck className="mx-auto h-12 w-12 text-ink-subtle" />
        <h3 className="mt-4 font-semibold text-forum-900">
          {hasFilters ? 'No publications match your filters' : 'No publications yet'}
        </h3>
        <p className="mt-1 text-sm text-ink-muted">
          {hasFilters
            ? 'Try adjusting search or filters, or submit a new paper.'
            : 'Submit your first manuscript to send it for editorial review.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {hasFilters && <Button variant="outline" onClick={onClear}>Clear filters</Button>}
          <Button onClick={onSubmit}>
            <Upload className="h-4 w-4" />
            {hasFilters ? 'Submit New Paper' : 'Submit Your First Paper'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
