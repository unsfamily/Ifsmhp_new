import { FormEvent, useCallback, useRef, useState } from 'react';
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

export function useCeremonyRegistration() {
  const submittingRef = useRef(false);
  const [form, setForm] = useState(emptyCeremonyRegistration);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const reset = useCallback(() => {
    submittingRef.current = false;
    setForm(emptyCeremonyRegistration);
    setErrors({});
    setFormError(null);
    setSubmitting(false);
    setSubmitted(false);
  }, []);

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

  return { form, errors, formError, submitting, submitted, submittingRef, update, submit, reset };
}

export function CeremonyRegistrationSuccess() {
  return (
    <p id="ceremony-registration-success" tabIndex={-1} role="status" className="rounded-lg border border-slateteal-500/30 bg-slateteal-100 px-4 py-3 text-sm text-forum-900 outline-none">
      {CEREMONY_SUCCESS_MESSAGE}
    </p>
  );
}

export function CeremonyRegistrationNotices() {
  return (
    <>
      <p className="rounded-lg border border-brass-500/30 bg-brass-50 px-4 py-3 text-sm text-forum-900">{CEREMONY_DATE_NOTICE}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">{CEREMONY_INTEREST_NOTICE}</p>
      <p className="mt-3 text-sm text-ink-muted">
        This is not a membership application.{' '}
        <a href="/register" target="_blank" rel="noopener noreferrer" className="font-medium text-forum-700 underline">Membership registration</a>
        {' '}stays on its own page.
      </p>
    </>
  );
}

export function CeremonyRegistrationFields({
  registration,
}: {
  registration: ReturnType<typeof useCeremonyRegistration>;
}) {
  const { form, errors, submitting, update } = registration;
  return (
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
  );
}

export function CeremonyRegistrationSubmit({
  formId,
  submitting,
  className = 'w-full sm:w-auto',
}: {
  formId?: string;
  submitting: boolean;
  className?: string;
}) {
  return (
    <Button type="submit" form={formId} className={className} disabled={submitting} aria-busy={submitting}>
      {submitting ? 'Submitting...' : 'Submit registration'}
    </Button>
  );
}
