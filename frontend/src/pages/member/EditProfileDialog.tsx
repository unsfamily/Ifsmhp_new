import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { RefreshCw, Save, X } from 'lucide-react';
import Button from '../../components/common/Button';
import { TextInput } from '../../components/common/Input';
import { memberApi, type MemberProfileData, type MemberProfileUpdate } from '../../api/member';
import { normalizeError } from '../../api/client';

const fields = [
  { name: 'websiteUrl', label: 'Institutional / Professional Website', type: 'url', maxLength: 2048 },
  { name: 'scholarUrl', label: 'Google Scholar URL', type: 'url', maxLength: 2048 },
  { name: 'orcid', label: 'ORCID', type: 'text', maxLength: 19 },
] as const;

const phoneMessage = 'Enter exactly 10 digits, without spaces or a country code.';
const validPhone = (value: string | null): value is string => value !== null && value.length === 10 && !/[^0-9]/.test(value);

export default function EditProfileDialog({ profile, onClose, onSaved }: {
  profile: MemberProfileData;
  onClose: () => void;
  onSaved: (profile: MemberProfileData) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const phoneInput = useRef<HTMLInputElement>(null);
  const legacyPhoneId = useId();
  const alive = useRef(true);
  const [values, setValues] = useState<MemberProfileUpdate>({
    phone: validPhone(profile.phone) ? profile.phone : '', websiteUrl: profile.websiteUrl, scholarUrl: profile.scholarUrl, orcid: profile.orcid,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const changePhone = (value: string) => {
    if (value.length > 10 || /[^0-9]/.test(value)) {
      setFieldErrors(previous => ({ ...previous, phone: phoneMessage }));
      return;
    }
    setValues(previous => ({ ...previous, phone: value }));
    setFieldErrors(previous => ({ ...previous, phone: previous.phone && !validPhone(value) ? phoneMessage : '' }));
  };

  const insertPhoneText = (text: string, input: HTMLInputElement) => {
    const start = input.selectionStart ?? values.phone.length;
    const end = input.selectionEnd ?? start;
    const next = values.phone.slice(0, start) + text + values.phone.slice(end);
    // Intercept paste/drop before native maxLength silently truncates the text.
    if (/[^0-9]/.test(text) || next.length > 10) {
      setFieldErrors(previous => ({ ...previous, phone: phoneMessage }));
      return;
    }
    changePhone(next);
    requestAnimationFrame(() => {
      if (alive.current) input.setSelectionRange(start + text.length, start + text.length);
    });
  };

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

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!validPhone(values.phone)) {
      setFieldErrors(previous => ({ ...previous, phone: phoneMessage }));
      phoneInput.current?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const updated = await memberApi.updateProfile(values);
      if (alive.current) onSaved(updated);
    } catch (failure) {
      if (alive.current) {
        const normalized = normalizeError(failure);
        setError(normalized.message);
        setFieldErrors(normalized.fieldErrors);
        if (normalized.fieldErrors.phone) phoneInput.current?.focus();
      }
    } finally {
      if (alive.current) setSaving(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="edit-profile-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-6 text-ink shadow-xl backdrop:bg-forum-900/50"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 id="edit-profile-title" className="font-display text-lg font-semibold text-forum-900">Edit Profile</h2>
        <Button type="button" variant="ghost" size="sm" aria-label="Close edit profile" title="Close" disabled={saving} onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <form onSubmit={(event) => void save(event)} className="space-y-4" aria-busy={saving}>
        {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
        <div>
          <TextInput ref={phoneInput} label="Phone" type="tel" inputMode="numeric" autoComplete="tel-national"
            maxLength={10} value={values.phone} disabled={saving} aria-required="true"
            error={fieldErrors.phone} hint={phoneMessage}
            aria-describedby={!validPhone(profile.phone) ? legacyPhoneId : undefined}
            onChange={event => changePhone(event.target.value)}
            onBlur={() => setFieldErrors(previous => ({ ...previous, phone: validPhone(values.phone) ? '' : phoneMessage }))}
            onPaste={event => { event.preventDefault(); insertPhoneText(event.clipboardData.getData('text'), event.currentTarget); }}
            onDrop={event => { event.preventDefault(); insertPhoneText(event.dataTransfer.getData('text'), event.currentTarget); }} />
          {!validPhone(profile.phone) && <p id={legacyPhoneId} className="mt-1 break-words text-xs text-ink-subtle">
            {profile.phone ? <>Saved phone: {profile.phone}. </> : 'No phone number is saved. '}
            Enter a valid 10-digit number before saving. Your saved profile stays unchanged until you save.
          </p>}
        </div>
        {fields.map((field) => <TextInput key={field.name} label={field.label} type={field.type}
          maxLength={field.maxLength} value={values[field.name] ?? ''} disabled={saving}
          error={fieldErrors[field.name]}
          onChange={(event) => setValues((previous) => ({ ...previous, [field.name]: event.target.value }))} />)}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
