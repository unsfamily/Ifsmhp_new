import { FormEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import Button from '../common/Button';
import { TextArea, TextInput } from '../common/Input';
import { normalizeError } from '../../api/client';
import { publicApi } from '../../api/public';
import {
  CEREMONY_DATE_NOTICE,
  CEREMONY_INTEREST_NOTICE,
  CEREMONY_MESSAGE_LIMIT,
  CEREMONY_SLUG,
  CEREMONY_SUCCESS_MESSAGE,
  PARTICIPATION_OPTIONS,
  ceremonyRegistrationSchema,
  emptyCeremonyRegistration,
  type ParticipationValue,
} from '../../domain/ceremonyRegistration';

const fieldIds = {
  fullName: 'ceremony-full-name',
  email: 'ceremony-email',
  phone: 'ceremony-phone',
  institution: 'ceremony-institution',
  designation: 'ceremony-designation',
  participationType: 'ceremony-participation',
  message: 'ceremony-message',
  consent: 'ceremony-consent',
} as const;

const focusOrder = ['fullName', 'email', 'phone', 'institution', 'designation', 'participationType', 'message', 'consent'] as const;
const focusableSelector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function fieldMap(issues: { path: (string | number)[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function focusField(key: string) {
  if (key === 'participationType') {
    document.querySelector<HTMLElement>('input[name="ceremonyParticipation"]')?.focus();
    return;
  }
  document.getElementById(fieldIds[key as keyof typeof fieldIds])?.focus();
}

/**
 * Modal dialog for ceremony interest registration.
 * Uses the native dialog element, as the document-exchange modal does, and adds
 * focus return, a scroll lock, and a nearly full-screen layout on small screens.
 */
export default function CeremonyRegistrationDialog({
  open,
  onClose,
  returnFocusId,
}: {
  open: boolean;
  onClose: () => void;
  returnFocusId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(false);
  const titleId = useId();
  const [form, setForm] = useState(emptyCeremonyRegistration);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  onCloseRef.current = onClose;
  submittingRef.current = submitting;

  useEffect(() => {
    if (!open && submitted) {
      setSubmitted(false);
      setForm(emptyCeremonyRegistration);
      setErrors({});
      setFormError(null);
    }
  }, [open, submitted]);

  useLayoutEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-dialog-title]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!submittingRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(focusableSelector)].filter((element) => element.tabIndex !== -1);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const activeInside = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        if (activeInside <= 0) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeInside < 0 || activeInside >= items.length - 1) {
        event.preventDefault();
        first.focus();
      }
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      if (!submittingRef.current) onCloseRef.current();
    };
    dialog.addEventListener('keydown', onKeyDown);
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('cancel', onCancel);
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
      document.getElementById(returnFocusId)?.focus();
    };
  }, [open, returnFocusId]);

  useEffect(() => {
    if (open && submitted) document.getElementById('ceremony-registration-success')?.focus();
  }, [open, submitted]);

  if (!open) return null;

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submittingRef.current) return;
    const parsed = ceremonyRegistrationSchema.safeParse(form);
    if (!parsed.success) {
      const next = fieldMap(parsed.error.issues);
      setErrors(next);
      setFormError('Please correct the highlighted fields.');
      const first = focusOrder.find((key) => next[key]);
      if (first) focusField(first);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const result = await publicApi.registerCeremony(CEREMONY_SLUG, {
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        institution: parsed.data.institution,
        designation: parsed.data.designation || undefined,
        participationType: parsed.data.participationType,
        message: parsed.data.message || undefined,
        consent: true,
      });
      if (!result.success || result.data?.received !== true) {
        setFormError('Could not save your registration. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch (error) {
      const problem = normalizeError(error);
      setErrors(problem.fieldErrors);
      setFormError(Object.keys(problem.fieldErrors).length ? 'Please correct the highlighted fields.' : problem.message);
      const first = focusOrder.find((key) => problem.fieldErrors[key]);
      if (first) focusField(first);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="ceremony-dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget && !submittingRef.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-paper-border px-4 py-4 sm:px-5">
        <h2 id={titleId} data-dialog-title tabIndex={-1} className="font-display text-xl font-semibold text-forum-900 outline-none">
          Register for the Ceremony
        </h2>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forum-600 disabled:opacity-50"
          aria-disabled={submitting}
          onClick={() => { if (!submitting) onClose(); }}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Close
        </button>
      </div>

      {submitted ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-5">
          <p id="ceremony-registration-success" tabIndex={-1} role="status" className="rounded-lg border border-slateteal-500/30 bg-slateteal-100 px-4 py-3 text-sm text-forum-900 outline-none">
            {CEREMONY_SUCCESS_MESSAGE}
          </p>
        </div>
      ) : (
        <form id="ceremony-registration-form" noValidate onSubmit={(event) => { void submit(event); }} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <p className="rounded-lg border border-brass-500/30 bg-brass-50 px-4 py-3 text-sm text-forum-900">{CEREMONY_DATE_NOTICE}</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{CEREMONY_INTEREST_NOTICE}</p>
          <p className="mt-3 text-sm text-ink-muted">
            This is not a membership application.{' '}
            <a href="/register" target="_blank" rel="noopener noreferrer" className="font-medium text-forum-700 underline">Membership registration</a>
            {' '}stays on its own page.
          </p>

          {formError && <p role="alert" className="mt-4 rounded-lg border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm text-danger-600">{formError}</p>}

          <div className="mt-5 space-y-4">
            <TextInput id={fieldIds.fullName} label="Full name" required autoComplete="name" maxLength={120} value={form.fullName} error={errors.fullName} disabled={submitting} onChange={(event) => update('fullName', event.target.value)} />
            <TextInput id={fieldIds.email} label="Email address" type="email" required autoComplete="email" maxLength={191} value={form.email} error={errors.email} disabled={submitting} onChange={(event) => update('email', event.target.value)} />
            <TextInput id={fieldIds.phone} label="Phone number, including country code" type="tel" inputMode="tel" required autoComplete="tel" maxLength={30} value={form.phone} error={errors.phone} hint="Include the country code, for example +44 7700 900123." disabled={submitting} onChange={(event) => update('phone', event.target.value)} />
            <TextInput id={fieldIds.institution} label="Institution / organisation" required autoComplete="organization" maxLength={200} value={form.institution} error={errors.institution} disabled={submitting} onChange={(event) => update('institution', event.target.value)} />
            <TextInput id={fieldIds.designation} label="Designation" autoComplete="organization-title" maxLength={120} value={form.designation} error={errors.designation} hint="Optional" disabled={submitting} onChange={(event) => update('designation', event.target.value)} />

            <fieldset id={fieldIds.participationType} aria-invalid={Boolean(errors.participationType)} aria-describedby={errors.participationType ? 'ceremony-participation-error' : undefined}>
              <legend className="mb-2 text-sm font-medium text-ink">Participation type<span className="ml-1 text-danger-600">*</span></legend>
              <div className="space-y-2">
                {PARTICIPATION_OPTIONS.map((option) => (
                  <label key={option.value} className="flex items-start gap-2.5 text-sm text-ink">
                    <input
                      type="radio"
                      name="ceremonyParticipation"
                      className="mt-0.5 h-4 w-4 accent-forum-700"
                      value={option.value}
                      checked={form.participationType === option.value}
                      disabled={submitting}
                      onChange={() => update('participationType', option.value as ParticipationValue)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              {errors.participationType && <p id="ceremony-participation-error" role="alert" className="mt-1 text-xs text-danger-600">{errors.participationType}</p>}
            </fieldset>

            <TextArea
              id={fieldIds.message}
              label="Additional message"
              rows={4}
              maxLength={CEREMONY_MESSAGE_LIMIT}
              value={form.message}
              error={errors.message}
              hint={`${form.message.length} / ${CEREMONY_MESSAGE_LIMIT.toLocaleString('en-GB')}`}
              disabled={submitting}
              onChange={(event) => update('message', event.target.value)}
            />

            <div>
              <div className="flex items-start gap-2.5">
                <input
                  id={fieldIds.consent}
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-paper-border accent-forum-700"
                  checked={form.consent}
                  disabled={submitting}
                  aria-invalid={Boolean(errors.consent)}
                  aria-describedby={errors.consent ? 'ceremony-consent-error' : undefined}
                  onChange={(event) => update('consent', event.target.checked)}
                />
                <label htmlFor={fieldIds.consent} className="text-sm text-ink-muted">
                  I acknowledge the{' '}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="font-medium text-forum-700 underline" onClick={(event) => event.stopPropagation()}>privacy policy</a>
                  {' '}and consent to be contacted about this ceremony.
                  <span className="ml-1 text-danger-600">*</span>
                </label>
              </div>
              {errors.consent && <p id="ceremony-consent-error" role="alert" className="mt-1 text-xs text-danger-600">{errors.consent}</p>}
            </div>
          </div>
        </form>
      )}

      {!submitted && (
        <div className="border-t border-paper-border px-4 py-4 sm:px-5">
          <Button type="submit" form="ceremony-registration-form" className="w-full" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'Submitting...' : 'Submit registration'}
          </Button>
        </div>
      )}
    </dialog>
  );
}
