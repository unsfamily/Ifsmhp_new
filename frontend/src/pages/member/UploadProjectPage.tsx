import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  Send,
  HeartHandshake,
  ShieldCheck,
  DollarSign,
  FileText,
  Link2,
  CheckCircle2,
  Loader2,
  X,
  RefreshCw,
  AlertCircle,
  Save,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput, FileInput } from '../../components/common/Input';
import { useForm } from 'react-hook-form';
import { memberApi, type UploadedFile, type ProjectResourceLinkInput } from '../../api/member';
import { normalizeError } from '../../api/client';
import { formatBytes } from '../../utils/formatBytes';
import { projectDateError, projectToDateError, validProjectDate } from '../../utils/projectTimeline';

interface FormData {
  title: string;
  description: string;
  category: string;
  fromDate: string;
  toDate: string;
  budget: string;
  supportMoral: boolean;
  supportOfficial: boolean;
  supportFunding: boolean;
}

/** Only these map to form inputs; anything else from the server stays in the banner. */
const FIELD_LABELS: Record<string, string> = {
  title: 'Project Title',
  description: 'Project Description',
  category: 'Research Category',
  fromDate: 'From Date',
  toDate: 'To Date',
  budget: 'Budget',
};

/**
 * Mirrors the Zod schema on `POST /members/me/projects`. Kept in step with the
 * server so short input is caught inline instead of coming back as a 422.
 */
const LIMITS = {
  title: { min: 4, max: 220 },
  category: { min: 2, max: 120 },
  description: { min: 20, max: 15000 },
  budget: { max: 120 },
} as const;

/** Matches MAX_UPLOAD_MB on the server; re-checked there with magic bytes. */
const MAX_UPLOAD_MB = 25;
const MAX_FILES = 10;
const MAX_LINKS = 20;

const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx'];
const PRESENTATION_EXTENSIONS = ['ppt', 'pptx', 'pdf'];

/** One attachment as the UI tracks it, from selection through to an id. */
interface Attachment {
  /** Stable key; survives retry so React does not remount the row. */
  key: string;
  name: string;
  sizeBytes: number;
  status: 'uploading' | 'uploaded' | 'failed';
  uploaded: UploadedFile | null;
  error: string | null;
  file: File;
}

function extensionOf(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

/**
 * Catches the obvious rejections before spending a round trip. The server still
 * re-validates, including magic bytes, so this is convenience and not the gate.
 */
function localFileError(file: File, allowed: string[]) {
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `That file is ${formatBytes(file.size)}. The limit is ${MAX_UPLOAD_MB} MB.`;
  }
  if (!allowed.includes(extensionOf(file.name))) {
    return `Choose a ${allowed.join(', ').toUpperCase()} file.`;
  }
  return null;
}

/** Accepts only absolute http(s) URLs; the server enforces the same rule. */
function normalizeLink(raw: string) {
  const value = raw.trim();
  if (!value) return { error: 'Enter a URL.' };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { error: 'Enter a valid URL, including https://' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { error: 'Use an HTTP or HTTPS URL.' };
  }
  return { url: parsed.href };
}

export default function UploadProjectPage() {
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    trigger,
    setFocus,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ defaultValues: { fromDate: '', toDate: '' } });
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const initialDates = useRef(true);
  useEffect(() => {
    if (initialDates.current) { initialDates.current = false; return; }
    void trigger(['fromDate', 'toDate']);
  }, [fromDate, toDate, trigger]);

  const [documents, setDocuments] = useState<Attachment[]>([]);
  const [presentation, setPresentation] = useState<Attachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [links, setLinks] = useState<ProjectResourceLinkInput[]>([]);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<number | null>(null);

  const attachments = [...documents, ...(presentation ? [presentation] : [])];
  const uploadsBusy = attachments.some((a) => a.status === 'uploading');
  const uploadsFailed = attachments.some((a) => a.status === 'failed');

  /** Uploads one file, threading its progress back into the right slot. */
  const runUpload = async (attachment: Attachment, slot: 'document' | 'presentation') => {
    const patch = (next: Partial<Attachment>) => {
      if (slot === 'presentation') {
        setPresentation((current) => (current && current.key === attachment.key ? { ...current, ...next } : current));
      } else {
        setDocuments((current) => current.map((a) => (a.key === attachment.key ? { ...a, ...next } : a)));
      }
    };
    try {
      const uploaded = await memberApi.uploadFile(attachment.file);
      patch({ status: 'uploaded', uploaded, error: null });
    } catch (error) {
      const normalized = normalizeError(error);
      patch({ status: 'failed', uploaded: null, error: normalized.fieldErrors.file ?? normalized.message });
    }
  };

  const addFiles = (fileList: FileList, slot: 'document' | 'presentation') => {
    setFileError(null);
    const allowed = slot === 'presentation' ? PRESENTATION_EXTENSIONS : DOCUMENT_EXTENSIONS;
    const chosen = Array.from(fileList);

    if (slot === 'document' && documents.length + chosen.length > MAX_FILES) {
      setFileError(`Attach no more than ${MAX_FILES} documents.`);
      return;
    }

    for (const file of chosen) {
      const invalid = localFileError(file, allowed);
      if (invalid) { setFileError(`${file.name}: ${invalid}`); continue; }

      const attachment: Attachment = {
        key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sizeBytes: file.size,
        status: 'uploading',
        uploaded: null,
        error: null,
        file,
      };
      if (slot === 'presentation') setPresentation(attachment);
      else setDocuments((current) => [...current, attachment]);
      void runUpload(attachment, slot);
      if (slot === 'presentation') break; // single slot
    }
  };

  const removeAttachment = (key: string, slot: 'document' | 'presentation') => {
    setFileError(null);
    if (slot === 'presentation') setPresentation(null);
    else setDocuments((current) => current.filter((a) => a.key !== key));
  };

  const retryAttachment = (attachment: Attachment, slot: 'document' | 'presentation') => {
    const retrying = { ...attachment, status: 'uploading' as const, error: null };
    if (slot === 'presentation') setPresentation(retrying);
    else setDocuments((current) => current.map((a) => (a.key === attachment.key ? retrying : a)));
    void runUpload(retrying, slot);
  };

  const commitLink = () => {
    const result = normalizeLink(linkDraft);
    if (result.error) { setLinkError(result.error); return; }
    const url = result.url!;
    const duplicate = links.some((link, index) => link.url === url && index !== editingLink);
    if (duplicate) { setLinkError('That link has already been added.'); return; }
    if (editingLink === null && links.length >= MAX_LINKS) {
      setLinkError(`Add no more than ${MAX_LINKS} links.`);
      return;
    }
    setLinks((current) => (editingLink === null
      ? [...current, { url }]
      : current.map((link, index) => (index === editingLink ? { url } : link))));
    setLinkDraft('');
    setLinkError(null);
    setEditingLink(null);
  };

  const onSubmit = async (data: FormData, options: { submit: boolean } = { submit: true }) => {
    setErrorMsg(null);
    try {
      await memberApi.createProject({
        title: data.title,
        category: data.category,
        description: data.description,
        fromDate: data.fromDate,
        toDate: data.toDate,
        budget: data.budget,
        supportTypes: [
          data.supportMoral ? 'Moral Support' : null,
          data.supportOfficial ? 'Official Support' : null,
          data.supportFunding ? 'Funding Support' : null,
        ].filter((kind): kind is string => kind !== null),
        fileIds: attachments.filter((a) => a.uploaded).map((a) => a.uploaded!.id),
        resourceLinks: links,
        submit: options.submit,
      });
      setSubmitted(true);
    } catch (error) {
      const normalized = normalizeError(error);
      // Put server-side validation back on the field it belongs to, so a 422
      // does not surface as a bare "Validation failed" banner.
      const fields = Object.entries(normalized.fieldErrors)
        .filter(([field]) => field in FIELD_LABELS) as [keyof FormData, string][];
      for (const [field, message] of fields) setError(field, { type: 'server', message });
      if (fields[0]) setFocus(fields[0][0]);
      setErrorMsg(fields.length ? 'Please correct the highlighted fields.' : normalized.message);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
              <CheckCircle2 className="h-9 w-9 text-success-600" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-semibold text-forum-900">
              Project Submitted Successfully
            </h2>
            <p className="mt-3 text-ink-muted">
              Your project has been received by the CRO office. You will receive a
              confirmation message in your dashboard inbox within 24 hours.
            </p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              {[
                ['Draft Saved', 'YES'],
                ['CRO Review', 'Pending'],
                ['Support Team', 'Assigned'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-paper-border bg-paper p-4">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle">{k}</p>
                  <p className="mt-1 font-semibold text-forum-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center flex-wrap gap-3">
              <Button as="link" to="/dashboard/projects" variant="outline">
                View All Projects
              </Button>
              <Button as="link" to="/dashboard/projects/upload" onClick={() => setSubmitted(false)}>
                <Upload className="h-4 w-4" />
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = [
    'Clinical Research',
    'Biological Psychiatry',
    'Technology Validation',
    'Health Services',
    'Clinical Trials',
    'Occupational Mental Health',
    'Public Health Policy',
    'Neuroscience',
    'Psychotherapy Research',
    'Other',
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit((data) => onSubmit(data, { submit: true }))} className="space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">
              {errorMsg}
            </div>
          )}
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Project Details
              </h2>
            </CardHeader>
            <CardContent className="pt-0 space-y-5 mt-4">
              <TextInput
                label="Project Title"
                placeholder="Descriptive, specific title for your research"
                required
                error={errors.title?.message}
                {...register('title', {
                  required: 'Please enter a project title',
                  minLength: { value: LIMITS.title.min, message: `Use at least ${LIMITS.title.min} characters` },
                  maxLength: { value: LIMITS.title.max, message: `Use no more than ${LIMITS.title.max} characters` },
                })}
              />
              <SelectInput
                label="Research Category"
                required
                error={errors.category?.message}
                {...register('category', { required: 'Please select a category' })}
              >
                <option value="">Select a category...</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectInput>
              <TextArea
                label="Project Description"
                placeholder={`Objectives, methodology, expected outputs, collaborators... (min ${LIMITS.description.min} characters)`}
                rows={6}
                required
                hint="Include research questions, study design, and expected impact"
                error={errors.description?.message}
                {...register('description', {
                  required: 'Please provide a project description',
                  minLength: { value: LIMITS.description.min, message: `Use at least ${LIMITS.description.min} characters` },
                  maxLength: { value: LIMITS.description.max, message: `Use no more than ${LIMITS.description.max} characters` },
                })}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset>
                  <legend className="mb-1.5 text-sm font-medium text-ink">Project Timeline</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput label="From Date" type="date" min="0001-01-01" max="9999-12-31" required
                      error={errors.fromDate?.message}
                      onInvalid={event => { event.preventDefault(); setError('fromDate', { message: projectDateError(event.currentTarget.value, 'From Date') ?? 'Enter a valid From Date' }, { shouldFocus: true }); }}
                      {...register('fromDate', { validate: value => projectDateError(value, 'From Date') || true })} />
                    <TextInput label="To Date" type="date" min={validProjectDate(fromDate) ? fromDate : '0001-01-01'} max="9999-12-31" required
                      error={errors.toDate?.message}
                      onInvalid={event => { event.preventDefault(); setError('toDate', { message: projectToDateError(fromDate, event.currentTarget.value) ?? 'Enter a valid To Date' }, { shouldFocus: validProjectDate(fromDate) }); }}
                      {...register('toDate', { validate: value => projectToDateError(fromDate, value) || true })} />
                  </div>
                </fieldset>
                <TextInput
                  label="Budget (if applicable)"
                  placeholder="Total budget in USD or N/A"
                  error={errors.budget?.message}
                  {...register('budget', {
                    maxLength: { value: LIMITS.budget.max, message: `Use no more than ${LIMITS.budget.max} characters` },
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slateteal-500" />
                Support Type Needed
              </h2>
              <p className="text-xs text-ink-subtle mt-0.5">
                Select all that apply. You can request multiple types of support.
              </p>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3 sm:grid-cols-3 mt-4">
              {[
                { key: 'supportMoral', icon: HeartHandshake, title: 'Moral Support', desc: 'Peer mentorship, community, encouragement' },
                { key: 'supportOfficial', icon: ShieldCheck, title: 'Official Support', desc: 'Institutional endorsement, credibility' },
                { key: 'supportFunding', icon: DollarSign, title: 'Funding Support', desc: 'Grants, connections, budget guidance' },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <label
                    key={s.key}
                    /*
                     * `has-[:checked]` rather than `peer-checked`: the input is a
                     * descendant here, not a preceding sibling, so the sibling
                     * combinator `peer-*` compiles to never matches.
                     */
                    className="group relative rounded-xl border p-5 cursor-pointer transition-all bg-paper border-paper-border hover:border-forum-200 has-[:checked]:border-forum-600 has-[:checked]:ring-2 has-[:checked]:ring-forum-600/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forum-600"
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      {...register(s.key as 'supportMoral' | 'supportOfficial' | 'supportFunding')}
                    />
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700 group-has-[:checked]:bg-forum-600 group-has-[:checked]:text-white transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-forum-900 text-sm">{s.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted leading-snug">{s.desc}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-brass-700" />
                File Uploads
              </h2>
              <p className="text-xs text-ink-subtle mt-0.5">
                All standard document and presentation formats supported.
              </p>
            </CardHeader>
            <CardContent className="pt-0 grid gap-5 sm:grid-cols-2 mt-4">
              <div className="min-w-0 space-y-3">
                <FileInput
                  label="Project Documents"
                  accept=".pdf,.doc,.docx"
                  multiple
                  hint="PDF, DOC, DOCX — Protocol, IRB, manuscript drafts"
                  onFiles={(files) => addFiles(files, 'document')}
                  onChange={(event) => {
                    if (event.target.files?.length) addFiles(event.target.files, 'document');
                    event.target.value = ''; // allow re-picking the same file
                  }}
                />
                {documents.map((attachment) => (
                  <AttachmentRow
                    key={attachment.key}
                    attachment={attachment}
                    onRemove={() => removeAttachment(attachment.key, 'document')}
                    onRetry={() => retryAttachment(attachment, 'document')}
                  />
                ))}
              </div>
              <div className="min-w-0 space-y-3">
                <FileInput
                  label="Presentation (optional)"
                  accept=".ppt,.pptx,.pdf"
                  hint="PPT, PPTX, PDF — Deck, poster, symposium materials"
                  onFiles={(files) => addFiles(files, 'presentation')}
                  onChange={(event) => {
                    if (event.target.files?.length) addFiles(event.target.files, 'presentation');
                    event.target.value = '';
                  }}
                />
                {presentation && (
                  <AttachmentRow
                    attachment={presentation}
                    onRemove={() => removeAttachment(presentation.key, 'presentation')}
                    onRetry={() => retryAttachment(presentation, 'presentation')}
                  />
                )}
              </div>
              {fileError && (
                <p role="alert" className="sm:col-span-2 flex items-start gap-1.5 text-xs text-danger-600">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {fileError}
                </p>
              )}
              {/* min-w-0: grid items default to min-width:auto, so without it a
                  long unbroken URL widens the whole column instead of truncating. */}
              <div className="min-w-0 sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Additional Resources / Links
                </label>
                <div className="rounded-md border border-dashed border-paper-border bg-paper p-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
                        <input
                          type="url"
                          value={linkDraft}
                          aria-label="Resource URL"
                          aria-invalid={Boolean(linkError)}
                          onChange={(event) => { setLinkDraft(event.target.value); setLinkError(null); }}
                          onKeyDown={(event) => {
                            // Enter must not submit the whole project form.
                            if (event.key === 'Enter') { event.preventDefault(); commitLink(); }
                          }}
                          placeholder="https://... (OSF preregistration, datasets, GitHub)"
                          className={`w-full rounded-md border bg-paper-raised pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-paper ${
                            linkError
                              ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600'
                              : 'border-paper-border focus:border-forum-600 focus:ring-forum-600'
                          }`}
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={commitLink}>
                        {editingLink === null ? 'Add' : 'Save'}
                      </Button>
                      {editingLink !== null && (
                        <Button
                          type="button" variant="ghost" size="sm"
                          onClick={() => { setEditingLink(null); setLinkDraft(''); setLinkError(null); }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>

                    {linkError ? (
                      <p role="alert" className="flex items-start gap-1.5 pl-1 text-xs text-danger-600">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        {linkError}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-subtle pl-1">
                        Paste any relevant URLs above (preregistrations, repositories, supplementary materials).
                      </p>
                    )}

                    {links.length > 0 && (
                      <ul className="space-y-1.5 pt-1">
                        {links.map((link, index) => (
                          <li
                            key={link.url}
                            className="flex items-center gap-2 rounded-md border border-paper-border bg-paper-raised px-3 py-2 text-sm"
                          >
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                            {/* min-w-0 so `truncate` can actually shrink inside the flex row. */}
                            <span className="min-w-0 flex-1 truncate text-ink-muted" title={link.url}>{link.url}</span>
                            <div className="ml-auto flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                onClick={() => { setEditingLink(index); setLinkDraft(link.url); setLinkError(null); }}
                                className="rounded px-2 py-1 text-xs font-medium text-forum-700 hover:bg-forum-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                aria-label={`Remove ${link.url}`}
                                onClick={() => {
                                  setLinks((current) => current.filter((_, i) => i !== index));
                                  if (editingLink === index) { setEditingLink(null); setLinkDraft(''); }
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-subtle hover:bg-danger-100 hover:text-danger-600"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            {uploadsBusy && (
              <p className="flex items-center gap-1.5 text-xs text-ink-subtle sm:mr-auto sm:self-center">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Waiting for uploads to finish...
              </p>
            )}
            {uploadsFailed && !uploadsBusy && (
              <p className="flex items-center gap-1.5 text-xs text-danger-600 sm:mr-auto sm:self-center">
                <AlertCircle className="h-3.5 w-3.5" />
                Retry or remove the failed attachment.
              </p>
            )}
            {/*
              A failed attachment also blocks submit: the member believes the file
              is attached, and submitting would silently drop it.
            */}
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isSubmitting || uploadsBusy || uploadsFailed}
              onClick={handleSubmit((data) => onSubmit(data, { submit: false }))}
            >
              <Save className="h-4.5 w-4.5" />
              Save Draft
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting || uploadsBusy || uploadsFailed}>
              <Send className="h-4.5 w-4.5" />
              {isSubmitting ? 'Submitting...' : uploadsBusy ? 'Uploading...' : 'Submit Project'}
            </Button>
          </div>
        </form>
      </div>

      {/* <aside className="space-y-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-forum-900 flex items-center gap-2">
              <Presentation className="h-4.5 w-4.5 text-brass-700" />
              Submission Checklist
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5 text-sm">
            {[
              'Title clearly describes research scope',
              'Category matches subject matter',
              'Detailed methodology provided',
              'Timeline and milestones defined',
              'Relevant documents attached',
              'Support types selected appropriately',
            ].map((item, i) => (
              <label key={i} className="flex gap-2 items-start cursor-pointer group">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-paper-border text-forum-600 focus:ring-forum-600" />
                <span className="text-ink-muted group-hover:text-ink transition-colors">{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-forum-900 flex items-center gap-2">
              <Badge variant="brass">Tip</Badge>
              Review Timeline
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-ink-muted">
            {[
              ['0-24h', 'Acknowledgement & CRO assignment'],
              ['3-5 days', 'Initial feasibility screening'],
              ['5-10 days', 'Full committee review'],
              ['Day 10+', 'Decision + support allocation'],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="font-mono text-[11px] font-bold text-brass-700 whitespace-nowrap pt-0.5">{t}</span>
                <span>{d}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside> */}
    </div>
  );
}

/** One attachment row: progress while uploading, size when done, retry on failure. */
function AttachmentRow({ attachment, onRemove, onRetry }: {
  attachment: Attachment;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const failed = attachment.status === 'failed';
  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
        failed ? 'border-danger-600/30 bg-danger-100' : 'border-paper-border bg-paper-raised'
      }`}
    >
      {attachment.status === 'uploading'
        ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-forum-600" />
        : failed
          ? <AlertCircle className="h-4 w-4 shrink-0 text-danger-600" />
          : <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />}

      <div className="min-w-0 flex-1">
        <p className="truncate text-ink-muted" title={attachment.name}>{attachment.name}</p>
        <p className={`text-xs ${failed ? 'text-danger-600' : 'text-ink-subtle'}`}>
          {attachment.status === 'uploading'
            ? 'Uploading...'
            : failed
              ? attachment.error
              : formatBytes(attachment.sizeBytes)}
        </p>
      </div>

      {failed && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs font-medium text-forum-700 hover:bg-forum-50"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${attachment.name}`}
        onClick={onRemove}
        disabled={attachment.status === 'uploading'}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-subtle hover:bg-danger-100 hover:text-danger-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
