import { FormEvent, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpenCheck,
  Calendar,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Filter,
  Search,
  Share2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput } from '../../components/common/Input';

interface Pub {
  id: string;
  title: string;
  venue: string;
  publishedOn: string;
  category: string;
  status: 'Published' | 'Under Review' | 'Pending Approval';
  views: number;
  downloads: number;
  doi?: string;
  authors?: string;
  abstract?: string;
  keywords?: string;
  fileName?: string;
}

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

const initialPublications: Pub[] = [
  { id: 'pub1', title: 'Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms: A Meta-Analysis', venue: 'IFSMHP Journal of Clinical Mental Health', publishedOn: 'Jul 15, 2026', category: 'Mental Health', status: 'Published', views: 1247, downloads: 342, doi: '10.ifsmhp.2026.00142' },
  { id: 'pub2', title: 'Youth Telehealth Service Utilization: 5-Nation Comparative Analysis', venue: 'IFSMHP International Journal of Mental Health Systems', publishedOn: 'Nov 22, 2025', category: 'Service Analysis', status: 'Published', views: 982, downloads: 267, doi: '10.ifsmhp.2025.00087' },
  { id: 'pub3', title: 'Mindfulness App Intervention for Generalized Anxiety: 8-Week RCT', venue: 'IFSMHP Psychology of Well-Being', publishedOn: 'Apr 03, 2025', category: 'Scientific Research', status: 'Published', views: 1532, downloads: 418, doi: '10.ifsmhp.2025.00031' },
  { id: 'pub4', title: 'Clinician Burnout Predictors in Hybrid Telehealth Cohorts', venue: 'IFSMHP Frontiers in Occupational Mental Health', publishedOn: 'Oct 14, 2024', category: 'Scientific Research', status: 'Published', views: 694, downloads: 189, doi: '10.ifsmhp.2024.00221' },
];

const emptyForm: PaperForm = {
  title: '', category: '', articleType: '', journal: '', authors: '', correspondingAuthor: '',
  email: '', orcid: '', abstract: '', keywords: '', funding: '', conflicts: '',
  ethicsApproval: '', coverLetter: '',
};

const categoryColors: Record<string, 'default' | 'success' | 'warning' | 'info' | 'brass'> = {
  'Mental Health': 'info',
  'Scientific Research': 'default',
  'Product Reviews': 'warning',
  'Service Analysis': 'success',
};

const inputClass = 'w-full rounded-md border border-paper-border bg-paper px-3 py-2.5 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600';

export default function MemberPublicationsPage() {
  const [publications, setPublications] = useState<Pub[]>(initialPublications);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<PaperForm>(emptyForm);
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [supplementaryFile, setSupplementaryFile] = useState<File | null>(null);
  const [confirmOriginal, setConfirmOriginal] = useState(false);
  const [confirmPolicy, setConfirmPolicy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const totalViews = publications.reduce((acc, publication) => acc + publication.views, 0);
  const totalDownloads = publications.reduce((acc, publication) => acc + publication.downloads, 0);

  const filteredPublications = useMemo(() => publications.filter((publication) => {
    if (category !== 'All' && publication.category !== category) return false;
    const term = search.trim().toLowerCase();
    return !term || [publication.title, publication.venue, publication.doi ?? '', publication.authors ?? '']
      .some((value) => value.toLowerCase().includes(term));
  }), [category, publications, search]);

  const updateForm = (field: keyof PaperForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(emptyForm);
    setPaperFile(null);
    setSupplementaryFile(null);
    setConfirmOriginal(false);
    setConfirmPolicy(false);
    setErrors({});
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
    if (form.abstract.trim().length < 100) nextErrors.abstract = 'Abstract must contain at least 100 characters.';
    if (!form.keywords.trim()) nextErrors.keywords = 'Enter at least three keywords.';
    if (!form.conflicts.trim()) nextErrors.conflicts = 'Enter a conflict-of-interest statement or “None”.';
    if (!paperFile) nextErrors.paperFile = 'Upload the manuscript PDF.';
    else if (paperFile.type !== 'application/pdf') nextErrors.paperFile = 'The manuscript must be a PDF file.';
    else if (paperFile.size > 20 * 1024 * 1024) nextErrors.paperFile = 'PDF size must not exceed 20 MB.';
    if (!confirmOriginal) nextErrors.confirmOriginal = 'Confirm that this is original work.';
    if (!confirmPolicy) nextErrors.confirmPolicy = 'Accept the publication policy.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    window.setTimeout(() => {
      const newPaper: Pub = {
        id: `pub-${Date.now()}`,
        title: form.title.trim(),
        venue: form.journal,
        publishedOn: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        category: form.category,
        status: 'Pending Approval',
        views: 0,
        downloads: 0,
        authors: form.authors,
        abstract: form.abstract,
        keywords: form.keywords,
        fileName: paperFile?.name,
      };
      setPublications((current) => [newPaper, ...current]);
      setIsSubmitting(false);
      closeModal();
      setToast('Paper submitted successfully and sent for approval.');
      window.setTimeout(() => setToast(''), 3500);
    }, 700);
  };

  return (
    <div className="space-y-6">
      {toast && <div role="status" className="fixed right-4 top-4 z-[70] flex items-center gap-2 rounded-lg bg-forum-900 px-4 py-3 text-sm text-white shadow-xl"><CheckCircle2 className="h-4 w-4" />{toast}<button aria-label="Close notification" onClick={() => setToast('')}><X className="h-4 w-4" /></button></div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Published Works', value: publications.length.toString(), icon: FileText, color: 'bg-forum-50 text-forum-700' },
          { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye, color: 'bg-slateteal-100 text-slateteal-700' },
          { label: 'Total Downloads', value: totalDownloads.toLocaleString(), icon: Download, color: 'bg-brass-100 text-brass-700' },
          { label: 'Avg. Readership', value: '+28%', icon: TrendingUp, color: 'bg-forum-50 text-forum-700' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="p-5"><div className={`flex h-11 w-11 items-center justify-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div><p className="mt-4 font-display text-2xl font-semibold text-forum-900">{value}</p><p className="mt-0.5 text-sm text-ink-muted">{label}</p></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-end">
          <div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" /><input type="search" placeholder="Search by title, venue, DOI..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-md border border-paper-border bg-paper py-2.5 pl-10 pr-4 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600" /></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SelectInput label={<span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Category</span>} value={category} onChange={(event) => setCategory(event.target.value)} className="sm:mb-0"><option value="All">All Categories</option><option value="Mental Health">Mental Health</option><option value="Scientific Research">Scientific Research</option><option value="Product Reviews">Product Reviews</option><option value="Service Analysis">Service Analysis</option></SelectInput>
            <Button onClick={() => setIsModalOpen(true)}><Upload className="h-4 w-4" />Submit New Paper</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredPublications.length === 0 && <Card><CardContent className="p-10 text-center"><AlertCircle className="mx-auto h-8 w-8 text-ink-subtle" /><p className="mt-3 font-medium text-forum-900">No publications found</p><Button variant="ghost" className="mt-3" onClick={() => { setSearch(''); setCategory('All'); }}>Clear filters</Button></CardContent></Card>}
        {filteredPublications.map((publication) => (
          <Card key={publication.id}><CardContent className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant={categoryColors[publication.category] || 'default'}>{publication.category}</Badge><Badge variant={publication.status === 'Published' ? 'success' : 'warning'}><BookOpenCheck className="mr-1 h-2.5 w-2.5" />{publication.status}</Badge>{publication.doi && <span className="inline-flex items-center rounded-md border border-paper-border bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-muted">DOI: {publication.doi}</span>}</div><h3 className="mt-3 text-lg font-semibold leading-snug text-forum-900">{publication.title}</h3><p className="mt-1 text-sm text-ink-muted">{publication.venue}</p>{publication.authors && <p className="mt-1 text-xs text-ink-subtle">Authors: {publication.authors}</p>}<div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-subtle"><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{publication.status === 'Published' ? 'Published' : 'Submitted'} {publication.publishedOn}</span><span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" />{publication.views.toLocaleString()} views</span><span className="flex items-center gap-1.5"><Download className="h-3.5 w-3.5" />{publication.downloads.toLocaleString()} downloads</span></div></div></div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-paper-border pt-4"><Button size="sm" variant="ghost" as="link" to={`/research/${publication.id}`}><Eye className="h-4 w-4" />View Public Page</Button><Button size="sm" variant="outline" disabled={publication.status !== 'Published'}><Download className="h-4 w-4" />Download PDF</Button><Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/research/${publication.id}`); setToast('Publication link copied.'); }}><Share2 className="h-4 w-4" />Share</Button>{publication.status === 'Published' && <div className="ml-auto flex items-center gap-2 text-xs"><span className="inline-flex items-center gap-1 font-medium text-brass-700"><TrendingUp className="h-3.5 w-3.5" />Trending</span></div>}</div>
          </CardContent></Card>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="submit-paper-title">
          <form onSubmit={handleSubmit} className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-paper shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-paper-border bg-paper px-5 py-4 sm:px-7"><div><h2 id="submit-paper-title" className="font-display text-xl font-semibold text-forum-900">Submit New Paper</h2><p className="mt-1 text-sm text-ink-muted">Complete all required fields marked with an asterisk (*).</p></div><button type="button" aria-label="Close submission form" onClick={closeModal} className="rounded-md p-1.5 text-ink-muted hover:bg-forum-50"><X className="h-5 w-5" /></button></div>
            <div className="space-y-7 p-5 sm:p-7">
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
                <label className="sm:col-span-2 text-sm font-medium text-ink-muted">ORCID ID<input value={form.orcid} onChange={(event) => updateForm('orcid', event.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0000-0000-0000-0000" /></label>
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
                <label className="cursor-pointer rounded-xl border-2 border-dashed border-paper-border p-5 text-center hover:border-forum-400"><Upload className="mx-auto h-6 w-6 text-forum-700" /><span className="mt-2 block text-sm font-medium text-forum-900">Manuscript PDF *</span><span className="mt-1 block text-xs text-ink-subtle">PDF only, maximum 20 MB</span><span className="mt-2 block truncate text-xs text-forum-700">{paperFile?.name ?? 'Choose file'}</span><input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(event) => { setPaperFile(event.target.files?.[0] ?? null); setErrors((current) => ({ ...current, paperFile: '' })); }} />{errors.paperFile && <span className="mt-2 block text-xs text-red-600">{errors.paperFile}</span>}</label>
                <label className="cursor-pointer rounded-xl border-2 border-dashed border-paper-border p-5 text-center hover:border-forum-400"><FileText className="mx-auto h-6 w-6 text-forum-700" /><span className="mt-2 block text-sm font-medium text-forum-900">Supplementary file</span><span className="mt-1 block text-xs text-ink-subtle">DOCX, XLSX, ZIP or PDF</span><span className="mt-2 block truncate text-xs text-forum-700">{supplementaryFile?.name ?? 'Choose file'}</span><input type="file" accept=".doc,.docx,.xls,.xlsx,.zip,.pdf" className="sr-only" onChange={(event) => setSupplementaryFile(event.target.files?.[0] ?? null)} /></label>
              </div></section>

              <section className="space-y-3 rounded-xl bg-forum-50/60 p-4">
                <label className="flex items-start gap-3 text-sm text-ink-muted"><input type="checkbox" checked={confirmOriginal} onChange={(event) => { setConfirmOriginal(event.target.checked); setErrors((current) => ({ ...current, confirmOriginal: '' })); }} className="mt-0.5 h-4 w-4 accent-forum-700" /><span>I confirm that this manuscript is original, has not been published elsewhere and is approved by all listed authors. *</span></label>{errors.confirmOriginal && <p className="text-xs text-red-600">{errors.confirmOriginal}</p>}
                <label className="flex items-start gap-3 text-sm text-ink-muted"><input type="checkbox" checked={confirmPolicy} onChange={(event) => { setConfirmPolicy(event.target.checked); setErrors((current) => ({ ...current, confirmPolicy: '' })); }} className="mt-0.5 h-4 w-4 accent-forum-700" /><span>I agree to the IFSMHP publication, peer-review, ethics and privacy policies. *</span></label>{errors.confirmPolicy && <p className="text-xs text-red-600">{errors.confirmPolicy}</p>}
              </section>
            </div>
            <div className="sticky bottom-0 flex flex-col-reverse justify-end gap-2 border-t border-paper-border bg-paper px-5 py-4 sm:flex-row sm:px-7"><Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting…' : 'Submit Paper for Review'}<Upload className="h-4 w-4" /></Button></div>
          </form>
        </div>
      )}
    </div>
  );
}
