import { useEffect, useRef, useState } from 'react';
import { AlertCircle, RefreshCw, Save, Send, X } from 'lucide-react';
import Button from '../../components/common/Button';
import { TextInput, TextArea, Checkbox } from '../../components/common/Input';
import { memberApi, type MemberProject, type MemberProjectDetail, type SupportKindLabel } from '../../api/member';
import { useApiData } from '../../hooks/useApiData';
import { normalizeError } from '../../api/client';
import { projectDateError, projectToDateError, validProjectDate } from '../../utils/projectTimeline';

const SUPPORT_KINDS: SupportKindLabel[] = ['Moral', 'Official', 'Funding'];

export default function ProjectEditDialog({ project, onClose, onSaved }: {
  project: MemberProject;
  onClose: () => void;
  onSaved: (project: MemberProject, message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const alive = useRef(true);
  const fromInput = useRef<HTMLInputElement>(null);
  const toInput = useRef<HTMLInputElement>(null);

  // The list row carries no timeline/budget, so the form loads the full record.
  const { data: detail, loading, error: loadError } = useApiData<MemberProjectDetail>(
    () => memberApi.project(project.id),
    [project.id],
  );

  const [values, setValues] = useState({
    title: project.title,
    category: project.category,
    description: project.description,
    fromDate: '',
    toDate: '',
    budget: '',
  });
  const [support, setSupport] = useState<SupportKindLabel[]>(project.support);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    alive.current = true;
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      alive.current = false;
      element?.close();
      previousFocus?.focus();
    };
  }, []);

  // Fill in once the detail lands, without clobbering edits already typed.
  useEffect(() => {
    if (!detail || hydrated) return;
    setValues({
      title: detail.title,
      category: detail.category,
      description: detail.description,
      fromDate: detail.fromDate ?? '',
      toDate: detail.toDate ?? '',
      budget: detail.budget ?? '',
    });
    setSupport(detail.support);
    setHydrated(true);
  }, [detail, hydrated]);

  const toggleSupport = (kind: SupportKindLabel) =>
    setSupport((previous) => previous.includes(kind) ? previous.filter((item) => item !== kind) : [...previous, kind]);

  const dateErrors = (range: typeof values, submit: boolean) => {
    if (fromInput.current?.validity.badInput || toInput.current?.validity.badInput) return {
      fromDate: fromInput.current?.validity.badInput ? 'Enter a valid From Date' : projectDateError(range.fromDate, 'From Date') ?? '',
      toDate: toInput.current?.validity.badInput ? 'Enter a valid To Date' : projectToDateError(range.fromDate, range.toDate) ?? '',
    };
    if (!submit && !detail?.fromDate && !range.fromDate && !range.toDate) return { fromDate: '', toDate: '' };
    return {
      fromDate: projectDateError(range.fromDate, 'From Date') ?? '',
      toDate: projectToDateError(range.fromDate, range.toDate) ?? '',
    };
  };
  const changeDate = (field: 'fromDate' | 'toDate', value: string) => {
    const next = { ...values, [field]: value };
    setValues(next);
    setFieldErrors(previous => ({ ...previous, ...dateErrors(next, false) }));
  };
  const showInvalidDates = () => {
    const invalid = dateErrors(values, false);
    setFieldErrors(previous => ({ ...previous, ...invalid }));
    (invalid.fromDate ? fromInput : toInput).current?.focus();
  };

  // Called from both the form's submit and the "Submit for Review" click.
  const save = async (event: { preventDefault: () => void }, submit: boolean) => {
    event.preventDefault();
    if (saving) return;
    const invalid = dateErrors(values, submit);
    if (invalid.fromDate || invalid.toDate) {
      setFieldErrors(previous => ({ ...previous, ...invalid }));
      (invalid.fromDate ? fromInput : toInput).current?.focus();
      return;
    }
    setSaving(submit ? 'submit' : 'draft');
    setError(null);
    setFieldErrors({});
    try {
      const updated = await memberApi.updateProject(project.id, {
        title: values.title,
        category: values.category,
        description: values.description,
        ...(values.fromDate || values.toDate ? { fromDate: values.fromDate, toDate: values.toDate } : {}),
        budget: values.budget,
        supportTypes: support,
        ...(submit ? { submit: true } : {}),
      });
      if (alive.current) onSaved(updated, submit ? 'Project submitted for review.' : 'Project updated.');
    } catch (failure) {
      if (alive.current) {
        const normalized = normalizeError(failure);
        setError(normalized.message);
        setFieldErrors(normalized.fieldErrors);
        if (normalized.fieldErrors.fromDate) fromInput.current?.focus();
        else if (normalized.fieldErrors.toDate) toInput.current?.focus();
      }
    } finally {
      if (alive.current) setSaving(null);
    }
  };

  const busy = saving !== null;
  const isDraft = (detail?.status ?? project.status) === 'Draft';

  return (
    <dialog
      ref={dialog}
      aria-labelledby="project-edit-title"
      className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-forum-900/50"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="project-edit-title" className="font-display text-lg font-semibold text-forum-900">Edit Project</h2>
        <Button type="button" variant="ghost" size="sm" aria-label="Close edit project" title="Close" disabled={busy} onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading && (
        <div className="space-y-3" aria-busy="true">
          <div className="h-10 rounded border border-paper-border bg-paper animate-pulse" />
          <div className="h-10 rounded border border-paper-border bg-paper animate-pulse" />
          <div className="h-24 rounded border border-paper-border bg-paper animate-pulse" />
        </div>
      )}

      {!loading && loadError && (
        <div className="py-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-danger-600" />
          <p className="mt-3 text-sm text-danger-600">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={onClose}>Close</Button>
        </div>
      )}

      {!loading && !loadError && (
        <form onSubmit={(event) => void save(event, false)} className="space-y-4" aria-busy={busy}>
          {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}

          <TextInput
            label="Project Title" required maxLength={220} value={values.title} disabled={busy}
            error={fieldErrors.title}
            onChange={(event) => setValues((previous) => ({ ...previous, title: event.target.value }))}
          />
          <TextInput
            label="Category" required maxLength={120} value={values.category} disabled={busy}
            error={fieldErrors.category}
            onChange={(event) => setValues((previous) => ({ ...previous, category: event.target.value }))}
          />
          <TextArea
            label="Description" required rows={6} maxLength={15000} value={values.description} disabled={busy}
            error={fieldErrors.description}
            onChange={(event) => setValues((previous) => ({ ...previous, description: event.target.value }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Project Timeline</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput ref={fromInput} label="From Date" type="date" min="0001-01-01" max="9999-12-31"
                  value={values.fromDate} disabled={busy} error={fieldErrors.fromDate}
                  onInvalid={event => { event.preventDefault(); showInvalidDates(); }}
                  required={Boolean(detail?.fromDate || values.fromDate || values.toDate)}
                  onChange={event => changeDate('fromDate', event.target.value)}
                  onBlur={() => setFieldErrors(previous => ({ ...previous, ...dateErrors(values, false) }))} />
                <TextInput ref={toInput} label="To Date" type="date" min={validProjectDate(values.fromDate) ? values.fromDate : '0001-01-01'} max="9999-12-31"
                  value={values.toDate} disabled={busy} error={fieldErrors.toDate}
                  onInvalid={event => { event.preventDefault(); showInvalidDates(); }}
                  required={Boolean(detail?.fromDate || values.fromDate || values.toDate)}
                  onChange={event => changeDate('toDate', event.target.value)}
                  onBlur={() => setFieldErrors(previous => ({ ...previous, ...dateErrors(values, false) }))} />
              </div>
              {!detail?.fromDate && <p className="mt-2 break-words text-xs text-ink-subtle">
                {detail?.timeline ? `Saved timeline: ${detail.timeline}. ` : 'No timeline is saved. '}
                Leave both dates blank to keep it, or provide both to replace it. Valid dates are required before submitting a draft.
              </p>}
            </fieldset>
            <TextInput
              label="Budget" maxLength={120} value={values.budget} disabled={busy}
              error={fieldErrors.budget}
              onChange={(event) => setValues((previous) => ({ ...previous, budget: event.target.value }))}
            />
          </div>

          <fieldset>
            <legend className="mb-1.5 block text-sm font-medium text-ink">Support Requested</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {SUPPORT_KINDS.map((kind) => (
                <Checkbox
                  key={kind} label={kind} checked={support.includes(kind)} disabled={busy}
                  onChange={() => toggleSupport(kind)}
                />
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={isDraft ? 'secondary' : 'primary'} disabled={busy}>
              {saving === 'draft' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving === 'draft' ? 'Saving...' : isDraft ? 'Save Draft' : 'Save Changes'}
            </Button>
            {isDraft && (
              <Button type="button" disabled={busy} onClick={(event) => void save(event, true)}>
                {saving === 'submit' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {saving === 'submit' ? 'Submitting...' : 'Submit for Review'}
              </Button>
            )}
          </div>
        </form>
      )}
    </dialog>
  );
}
