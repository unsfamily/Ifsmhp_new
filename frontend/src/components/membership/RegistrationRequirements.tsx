import { useRef, useState } from 'react';
import type { RegistrationPolicy } from '../../services/membershipService';
import { uploadRegistrationDocument, removeRegistrationDocument, type RegistrationDocumentUpload } from '../../api/auth';
import { normalizeError } from '../../api/client';
import { TextInput, TextArea } from '../common/Input';
import Button from '../common/Button';
export interface ReferralInput { name: string; email: string; organization: string }
export default function RegistrationRequirements({ policy, referrals, setReferrals, letters, setLetters, waiver, setWaiver, setUploading }: {
  policy: RegistrationPolicy; referrals: ReferralInput[]; setReferrals: (v: ReferralInput[]) => void;
  letters: RegistrationDocumentUpload[]; setLetters: (v: RegistrationDocumentUpload[]) => void;
  waiver: string; setWaiver: (v: string) => void; setUploading: (v: boolean) => void;
}) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false); const lock = useRef(false);
  const upload = async (files: FileList | null) => {
    if (!files?.length || lock.current) return;
    if (files.length + letters.length > 5) { setError('Upload at most five reference letters.'); return; }
    lock.current = true; setBusy(true); setUploading(true); setError(''); const next = [...letters];
    try { for (const file of Array.from(files)) { const result = await uploadRegistrationDocument(file); next.push(result); setLetters([...next]); } }
    catch (e) { setError(normalizeError(e).message); }
    finally { lock.current = false; setBusy(false); setUploading(false); }
  };
  const remove = async (letter: RegistrationDocumentUpload) => {
    if (lock.current) return; lock.current = true; setBusy(true); setUploading(true); setError('');
    try { await removeRegistrationDocument({ id: letter.id, claimToken: letter.claimToken }); setLetters(letters.filter(l => l.id !== letter.id)); }
    catch (e) { setError(normalizeError(e).message); }
    finally { lock.current = false; setBusy(false); setUploading(false); }
  };
  return <section className="space-y-4"><h2 className="font-display text-xl font-semibold">Membership requirements</h2>
    {error && <p role="alert" className="text-danger-700">{error}</p>}
    {Array.from({ length: policy.referralCount }, (_, index) => <fieldset key={index} className="border border-paper-border p-3 rounded-lg space-y-3"><legend>Referrer {index + 1}</legend>{(['name', 'email', 'organization'] as const).map(key => <TextInput key={key} label={`Referrer ${index + 1} ${key}`} type={key === 'email' ? 'email' : 'text'} required={key !== 'organization'} maxLength={key === 'organization' ? 200 : 191} value={referrals[index]?.[key] ?? ''} onChange={e => { const next = [...referrals]; next[index] = { name: '', email: '', organization: '', ...next[index], [key]: e.target.value }; setReferrals(next); }} />)}</fieldset>)}
    {(policy.referenceLetterCount > 0 || letters.length > 0) && <div className="space-y-2"><label className="block font-medium" htmlFor="membership-letters">Reference letters ({policy.referenceLetterCount} required)</label><input id="membership-letters" type="file" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" disabled={busy} onChange={e => { void upload(e.target.files); e.target.value = ''; }} /><p className="text-sm">PDF, DOC, DOCX, JPG or PNG; up to 10 MB each.</p>{letters.map(letter => <div key={letter.id} className="flex flex-wrap gap-2 items-center"><span>{letter.name}</span><Button type="button" variant="outline" disabled={busy} onClick={() => void remove(letter)}>Remove {letter.name}</Button></div>)}</div>}
    <p>Application fee: {policy.applicationFeeEnabled ? `${policy.currency} ${policy.applicationFee}` : 'No fee'}. Annual dues: {policy.annualDuesEnabled ? `${policy.currency} ${policy.annualDues}, first charged at approval and annually thereafter; payable within 30 days` : 'No dues'}.</p>
    {policy.paymentInstructions && (policy.applicationFeeEnabled || policy.annualDuesEnabled) && <p className="whitespace-pre-wrap rounded-lg bg-paper p-3">{policy.paymentInstructions}</p>}
    {policy.applicationFeeEnabled && <p className="text-sm">After verifying your email, view your charge on the application status page. An administrator must record your payment or approve a waiver before membership approval.</p>}
    {policy.waiversEnabled && policy.applicationFeeEnabled && <TextArea label="Application fee waiver reason (optional)" value={waiver} maxLength={2000} hint="Explain your request in at least 10 characters. It is visible only to you and authorized administrators." onChange={e => setWaiver(e.target.value)} />}
  </section>;
}
