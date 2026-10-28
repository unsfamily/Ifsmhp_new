import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Award } from 'lucide-react';
import Button from '../../components/common/Button';
import { SelectInput, TextArea, TextInput } from '../../components/common/Input';
import { normalizeError } from '../../api/client';
import { publicApi } from '../../api/public';
import {
  DISCIPLINARY_AWARD_OPTIONS,
  DIVISION_OPTIONS,
  NOMINATION_EMAIL_NOTICE,
  NOMINATION_SUCCESS,
  awardNominationSchema,
  emptyAwardNomination,
  nominationWordCount,
} from '../../domain/awardNomination';
import { CEREMONY_ADDRESS, CEREMONY_EVENT_DATE, CEREMONY_VENUE } from '../../domain/ceremonyProgramme';
import { CEREMONY_PAGE_PATH, CEREMONY_SLUG } from '../../domain/ceremonyRegistration';

const longFields = [
  ['careerOverview', 'Professional career overview'],
  ['principalContributions', 'Principal discoveries, achievements, and contributions'],
  ['impact', 'Evidence of national or international impact'],
  ['leadership', 'Leadership, mentoring, and institutional contributions'],
  ['majorAwards', 'Major awards, distinctions, and recognitions'],
  ['publications', 'Research publications / books'],
  ['patents', 'Patents / technologies / creative works'],
  ['projects', 'Research projects / initiatives'],
  ['institutionsEstablished', 'Institutions / programmes established'],
  ['societalImpact', 'Documented societal or professional impact'],
] as const;

function fieldMap(issues: { path: (string | number)[]; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? '');
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export default function AwardNominationPage() {
  const [form, setForm] = useState({ ...emptyAwardNomination, awardKind: 'DISCIPLINARY' as const });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ emailSent: boolean } | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    const previous = document.title;
    document.title = 'Official nomination form · IFSMHP Awards 2026';
    return () => { document.title = previous; };
  }, []);

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
    const parsed = awardNominationSchema.safeParse(form);
    if (!parsed.success) {
      const next = fieldMap(parsed.error.issues);
      setErrors(next);
      setFormError('Please correct the highlighted fields.');
      const first = parsed.error.issues[0]?.path[0];
      if (first) document.getElementById(`nomination-${String(first)}`)?.focus();
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setErrors({});
    setFormError(null);
    try {
      const result = await publicApi.nominateAward(CEREMONY_SLUG, {
        awardCode: parsed.data.awardCode,
        division: parsed.data.awardKind === 'DISCIPLINARY' ? parsed.data.division as 'DISTINGUISHED_FELLOWS' | 'EXCELLENCE' | 'RISING_ACHIEVERS' : undefined,
        nomineeName: parsed.data.nomineeName,
        dateOfBirth: parsed.data.dateOfBirth,
        nationality: parsed.data.nationality,
        qualification: parsed.data.qualification,
        designation: parsed.data.designation,
        institution: parsed.data.institution,
        specialisation: parsed.data.specialisation,
        yearsOfContribution: parsed.data.yearsOfContribution,
        countryOfResidence: parsed.data.countryOfResidence,
        nomineeEmail: parsed.data.nomineeEmail,
        nomineePhone: parsed.data.nomineePhone,
        orcid: parsed.data.orcid || undefined,
        careerOverview: parsed.data.careerOverview,
        principalContributions: parsed.data.principalContributions,
        impact: parsed.data.impact,
        leadership: parsed.data.leadership,
        majorAwards: parsed.data.majorAwards,
        publications: parsed.data.publications,
        patents: parsed.data.patents,
        projects: parsed.data.projects,
        institutionsEstablished: parsed.data.institutionsEstablished,
        societalImpact: parsed.data.societalImpact,
        statement: parsed.data.statement,
        nominationType: parsed.data.nominationType,
        nominatorName: parsed.data.nominatorName,
        nominatorDesignation: parsed.data.nominatorDesignation,
        nominatorInstitution: parsed.data.nominatorInstitution,
        nominatorEmail: parsed.data.nominatorEmail,
        nominatorPhone: parsed.data.nominatorPhone,
        relationship: parsed.data.relationship,
        checklistCv: true,
        checklistStatement: true,
        checklistEvidence: true,
        checklistHonours: parsed.data.checklistHonours,
        checklistRecommendation: parsed.data.checklistRecommendation,
        checklistPhotograph: true,
        checklistConsent: true,
        declaration: true,
      });
      if (!result.success || result.data?.received !== true) {
        setFormError('Could not save your nomination. Please try again.');
        return;
      }
      setSubmitted({ emailSent: result.data.acknowledgementSent === true });
    } catch (error) {
      const problem = normalizeError(error);
      setErrors(problem.fieldErrors);
      setFormError(Object.keys(problem.fieldErrors).length ? 'Please correct the highlighted fields.' : problem.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-paper" aria-labelledby="nomination-heading">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <Link to={CEREMONY_PAGE_PATH} className="inline-flex items-center gap-1.5 text-sm font-medium text-forum-700 hover:text-forum-900">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Second International Awards Ceremony
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-brass-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-700 ring-1 ring-inset ring-brass-500/20">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            2nd International IFSMHP Awards 2026
          </span>
        </div>
        <h1 id="nomination-heading" className="mt-6 font-display text-3xl font-semibold tracking-tight text-forum-900 sm:text-4xl">Official nomination form</h1>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          {CEREMONY_EVENT_DATE} · {CEREMONY_VENUE}. {CEREMONY_ADDRESS}. This nomination is separate from membership registration at{' '}
          <a href="/register" className="font-medium text-forum-700 underline">/register</a>.
          Nomination does not guarantee selection and is subject to independent review.
        </p>

        <div className="mt-8 rounded-2xl border border-paper-border bg-paper-raised p-5 shadow-sm sm:p-8">
          {submitted ? (
            <div role="status" className="space-y-3 rounded-lg border border-slateteal-500/30 bg-slateteal-100 px-4 py-3 text-sm text-forum-900">
              <p>{NOMINATION_SUCCESS}</p>
              {submitted.emailSent && <p>{NOMINATION_EMAIL_NOTICE}</p>}
            </div>
          ) : (
            <form noValidate onSubmit={(event) => { void submit(event); }} className="space-y-8">
              {formError && <p role="alert" className="rounded-lg border border-danger-600/20 bg-danger-100 px-4 py-3 text-sm text-danger-600">{formError}</p>}

              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-semibold text-forum-900">Award nominated for</legend>
                <SelectInput id="nomination-awardCode" label="Commemorative award" required value={form.awardCode} error={errors.awardCode} disabled={submitting} onChange={(event) => update('awardCode', event.target.value)}>
                  <option value="">Select one of the 25 awards</option>
                  {DISCIPLINARY_AWARD_OPTIONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </SelectInput>
                <fieldset id="nomination-division" aria-invalid={Boolean(errors.division)}>
                  <legend className="mb-2 text-sm font-medium text-ink">Recognition division<span className="ml-1 text-danger-600">*</span></legend>
                  <div className="space-y-2">
                    {DIVISION_OPTIONS.map(([code, label]) => (
                      <label key={code} className="flex items-start gap-2.5 text-sm text-ink">
                        <input type="radio" name="nominationDivision" className="mt-0.5 h-4 w-4 accent-forum-700" value={code} checked={form.division === code} disabled={submitting} onChange={() => update('division', code)} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.division && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.division}</p>}
                </fieldset>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-semibold text-forum-900">Nominee details</legend>
                <TextInput id="nomination-nomineeName" label="Full name with title" required value={form.nomineeName} error={errors.nomineeName} disabled={submitting} onChange={(event) => update('nomineeName', event.target.value)} />
                <TextInput id="nomination-dateOfBirth" label="Date of birth" required value={form.dateOfBirth} error={errors.dateOfBirth} disabled={submitting} onChange={(event) => update('dateOfBirth', event.target.value)} />
                <TextInput id="nomination-nationality" label="Nationality" required value={form.nationality} error={errors.nationality} disabled={submitting} onChange={(event) => update('nationality', event.target.value)} />
                <TextInput id="nomination-qualification" label="Highest qualification" required value={form.qualification} error={errors.qualification} disabled={submitting} onChange={(event) => update('qualification', event.target.value)} />
                <TextInput id="nomination-designation" label="Current designation" required value={form.designation} error={errors.designation} disabled={submitting} onChange={(event) => update('designation', event.target.value)} />
                <TextInput id="nomination-institution" label="Institution / organisation" required value={form.institution} error={errors.institution} disabled={submitting} onChange={(event) => update('institution', event.target.value)} />
                <TextInput id="nomination-specialisation" label="Primary discipline / specialisation" required value={form.specialisation} error={errors.specialisation} disabled={submitting} onChange={(event) => update('specialisation', event.target.value)} />
                <TextInput id="nomination-yearsOfContribution" label="Years of professional contribution" required value={form.yearsOfContribution} error={errors.yearsOfContribution} disabled={submitting} onChange={(event) => update('yearsOfContribution', event.target.value)} />
                <TextInput id="nomination-countryOfResidence" label="Country of residence" required value={form.countryOfResidence} error={errors.countryOfResidence} disabled={submitting} onChange={(event) => update('countryOfResidence', event.target.value)} />
                <TextInput id="nomination-nomineeEmail" label="Nominee email address" type="email" required value={form.nomineeEmail} error={errors.nomineeEmail} disabled={submitting} onChange={(event) => update('nomineeEmail', event.target.value)} />
                <TextInput id="nomination-nomineePhone" label="Nominee phone number, including country code" type="tel" required value={form.nomineePhone} error={errors.nomineePhone} disabled={submitting} onChange={(event) => update('nomineePhone', event.target.value)} />
                <TextInput id="nomination-orcid" label="ORCID / professional profile" hint="Optional" value={form.orcid} error={errors.orcid} disabled={submitting} onChange={(event) => update('orcid', event.target.value)} />
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-semibold text-forum-900">Nomination details and achievement record</legend>
                {longFields.map(([key, label]) => (
                  <TextArea key={key} id={`nomination-${key}`} label={label} required rows={4} value={form[key]} error={errors[key]} disabled={submitting} onChange={(event) => update(key, event.target.value)} />
                ))}
                <TextArea id="nomination-statement" label="Nomination statement" required rows={8} value={form.statement} error={errors.statement} hint={`${nominationWordCount(form.statement)} / 1,000 words`} disabled={submitting} onChange={(event) => update('statement', event.target.value)} />
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="font-display text-xl font-semibold text-forum-900">Nominator</legend>
                <SelectInput id="nomination-nominationType" label="Nomination type" required value={form.nominationType} error={errors.nominationType} disabled={submitting} onChange={(event) => update('nominationType', event.target.value)}>
                  <option value="">Select one</option>
                  <option value="SELF">Self</option>
                  <option value="INSTITUTIONAL">Institutional</option>
                  <option value="COLLEAGUE">Professional colleague</option>
                </SelectInput>
                <TextInput id="nomination-nominatorName" label="Nominator full name" required value={form.nominatorName} error={errors.nominatorName} disabled={submitting} onChange={(event) => update('nominatorName', event.target.value)} />
                <TextInput id="nomination-nominatorDesignation" label="Nominator designation" required value={form.nominatorDesignation} error={errors.nominatorDesignation} disabled={submitting} onChange={(event) => update('nominatorDesignation', event.target.value)} />
                <TextInput id="nomination-nominatorInstitution" label="Nominator institution / organisation" required value={form.nominatorInstitution} error={errors.nominatorInstitution} disabled={submitting} onChange={(event) => update('nominatorInstitution', event.target.value)} />
                <TextInput id="nomination-nominatorEmail" label="Nominator email address" type="email" required value={form.nominatorEmail} error={errors.nominatorEmail} disabled={submitting} onChange={(event) => update('nominatorEmail', event.target.value)} />
                <TextInput id="nomination-nominatorPhone" label="Nominator phone number, including country code" type="tel" required value={form.nominatorPhone} error={errors.nominatorPhone} disabled={submitting} onChange={(event) => update('nominatorPhone', event.target.value)} />
                <TextInput id="nomination-relationship" label="Relationship to nominee" required value={form.relationship} error={errors.relationship} disabled={submitting} onChange={(event) => update('relationship', event.target.value)} />
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="font-display text-xl font-semibold text-forum-900">Document checklist</legend>
                <p className="text-sm text-ink-muted">Confirm the materials included in this nomination. The statement above is the nomination statement. This form does not upload files.</p>
                {([
                  ['checklistCv', 'Curriculum vitae / professional biography'],
                  ['checklistStatement', 'Nomination statement'],
                  ['checklistEvidence', 'Supporting evidence of principal contributions'],
                  ['checklistHonours', 'Major honours and awards, where applicable'],
                  ['checklistRecommendation', 'Recommendation letter, where available'],
                  ['checklistPhotograph', 'Recent photograph'],
                  ['checklistConsent', 'Nominee consent'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="flex items-start gap-2.5 text-sm text-ink">
                      <input id={`nomination-${key}`} type="checkbox" className="mt-0.5 h-4 w-4 accent-forum-700" checked={form[key]} disabled={submitting} onChange={(event) => update(key, event.target.checked)} />
                      <span>{label}{key !== 'checklistHonours' && key !== 'checklistRecommendation' ? <span className="ml-1 text-danger-600">*</span> : null}</span>
                    </label>
                    {errors[key] && <p role="alert" className="mt-1 text-xs text-danger-600">{errors[key]}</p>}
                  </div>
                ))}
              </fieldset>

              <div>
                <label className="flex items-start gap-2.5 text-sm text-ink-muted">
                  <input id="nomination-declaration" type="checkbox" className="mt-0.5 h-4 w-4 accent-forum-700" checked={form.declaration} disabled={submitting} onChange={(event) => update('declaration', event.target.checked)} />
                  <span>I declare that the information is accurate, the supporting records are authentic, and the nominee has consented to assessment. I understand that nomination does not guarantee selection.<span className="ml-1 text-danger-600">*</span></span>
                </label>
                {errors.declaration && <p role="alert" className="mt-1 text-xs text-danger-600">{errors.declaration}</p>}
              </div>

              <Button type="submit" disabled={submitting} aria-busy={submitting}>{submitting ? 'Submitting...' : 'Submit nomination'}</Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
