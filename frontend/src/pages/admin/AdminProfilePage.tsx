import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Building2,
  User,
  IdCard,
  CheckCircle2,
  ShieldCheck,
  Save,
  Bell,
  Key,
  Globe2,
  Briefcase,
  FileText,
  Users,
  Upload,
  X,
  Clock,
  History as HistoryIcon,
  Shield,
  Phone,
  AlertCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAdminProfile } from '../../hooks/useAdminProfile';
import AdminSessionsDialog from './AdminSessionsDialog';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

export default function AdminProfilePage() {
  const state = useAdminProfile();
  const { profile, data, overview, busy, error, success, fields, denied, conflict } = state;
  const { firstName, lastName, displayName, phone, institution, country, timezone, bio, orcid, website } = profile;
  const title = profile.jobTitle, email = profile.workEmail, role = profile.designation;
  const set = (key: keyof typeof profile, value: string) => state.setProfile(p => ({ ...p, [key]: value }));
  const setFirstName = (v: string) => set('firstName', v), setLastName = (v: string) => set('lastName', v), setDisplayName = (v: string) => set('displayName', v), setTitle = (v: string) => set('jobTitle', v), setEmail = (v: string) => set('workEmail', v), setPhone = (v: string) => set('phone', v), setInstitution = (v: string) => set('institution', v), setCountry = (v: string) => set('country', v), setTimezone = (v: string) => set('timezone', v), setRole = (v: string) => set('designation', v), setBio = (v: string) => set('bio', v), setOrcid = (v: string) => set('orcid', v), setWebsite = (v: string) => set('website', v);
  const notif = state.preferences, setNotif = state.setPreferences;
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [currentPw, setCurrentPw] = useState(''), [newPw, setNewPw] = useState(''), [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null), [sessionsOpen, setSessionsOpen] = useState(false);
  useEffect(() => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setSessionsOpen(false); }, [data?.account.id, denied]);
  const fileInput = useRef<HTMLInputElement>(null);
  const initials = (data?.account.fullName ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('');
  const at = (value?: string | null) => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: data?.profile.timezone || 'UTC' }).format(new Date(value)) + ' · ' + (data?.profile.timezone || 'UTC') : 'Unavailable';
  const auditLink = '/admin/audit-log?actorId=' + encodeURIComponent(data?.account.id ?? '');
  const assignedQueues = overview?.queues ?? [];
  const recentApprovals = (overview?.approvals ?? []).map(a => ({ id: a.id, member: a.entity, at: at(a.createdAt), type: a.action }));
  const activity = (overview?.activity ?? []).map(a => ({ id: a.id, at: at(a.createdAt), action: a.action.replace(/([a-z])([A-Z])/g, '$1 $2'), detail: a.description, severity: a.severity.toLowerCase() }));
  const pwScore = (() => {
    const s = newPw;
    let score = 0;
    if (s.length >= 8) score++;
    if (s.length >= 14) score++;
    if (/[A-Z]/.test(s) && /[a-z]/.test(s)) score++;
    if (/\d/.test(s)) score++;
    if (/[^A-Za-z0-9]/.test(s)) score++;
    return Math.min(score, 5);
  })();

  const savePassword = async () => {
    setPwError(null);
    if (!currentPw) { setPwError('Current password is required.'); return; }
    if ([...newPw].length < 14) { setPwError('New password must be at least 14 characters.'); return; }
    if (new TextEncoder().encode(newPw).length > 72) { setPwError('New password must not exceed 72 UTF-8 bytes.'); return; }
    if (newPw !== confirmPw) { setPwError('New password and confirmation do not match.'); return; }
    if (await state.password(currentPw, newPw, confirmPw)) { setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
  };
  if (!data || denied) return <Card><CardContent><h1 className="font-display text-2xl">Admin Profile &amp; Preferences</h1><p role={error ? 'alert' : 'status'} className="my-4">{error || 'Loading your profile…'}</p>{!denied && <Button onClick={() => void state.load()}>Retry</Button>}</CardContent></Card>;
  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-lg border border-danger-600/30 bg-danger-50 p-3 text-danger-700">{error}{Object.entries(fields).map(([key, message]) => <p key={key}>{message}</p>)}{conflict && <div className="mt-2"><p>Your edits are preserved. Load the latest saved values, review them against your draft, then save again.</p><Button variant="outline" onClick={() => void state.load(true)}>Load latest for review</Button></div>}</div>}
      {state.reviewRequired && <div className="rounded-lg border border-paper-border p-4"><h2 className="font-semibold">Review latest saved values</h2><p className="text-sm">Your draft remains in the form below. Saving will apply that draft to the refreshed profile.</p><details><summary>Latest saved profile and preferences</summary><pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify({ ...data.profile, preferences: data.preferences }, null, 2)}</pre></details><Button onClick={state.confirmReview}>I have reviewed the latest values</Button></div>}
      {success && <p role="status" className="rounded-lg bg-success-50 p-3 text-success-700">{success}</p>}
      {busy && <p role="status">Saving…</p>}
      <fieldset disabled={!!busy || state.loading || conflict} className="min-w-0 space-y-6">

      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Link to="/admin" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              <ArrowLeft className="h-3 w-3" /> Admin home
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Admin Profile &amp; Preferences</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Manage your CRO administrator profile, contact information, notification subscriptions, and account security.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> {data.account.status}</Badge>
          <Badge variant="brass" className="gap-1"><ShieldCheck className="h-2.5 w-2.5" />{data.account.role}</Badge>
          <Button variant="outline" size="sm" onClick={() => void state.save('all')}>
            <Save className="h-3.5 w-3.5" /> Save All Changes
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-forum-600 via-forum-700 to-slateteal-600 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        </div>
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="relative -mt-14 w-28 shrink-0">
                <input ref={fileInput} type="file" className="sr-only" aria-label="Avatar image" accept={data.policy.avatarFormats.join(',')} onChange={e => { const file = e.target.files?.[0]; if (file) void state.upload(file); e.target.value = ''; }} />
                <div className="h-28 w-28 rounded-2xl bg-gradient-to-br from-brass-500 to-forum-600 ring-4 ring-paper-raised shadow-lg flex items-center justify-center text-white font-display text-3xl font-bold">
                  {state.avatarUrl ? <img src={state.avatarUrl} alt="Your avatar" className="h-full w-full rounded-2xl object-cover" /> : initials}
                </div>
                <button className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-paper-raised border border-paper-border text-forum-700 flex items-center justify-center shadow-sm hover:bg-forum-50" aria-label="Change avatar" onClick={() => fileInput.current?.click()}>
                  <Upload className="h-4 w-4" />
                </button>
              </div>
              <div className="pb-2 min-w-0">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{displayName || data.account.fullName}</h2>
                <p className="text-base text-ink-muted mt-0.5">{title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Mail className="h-3.5 w-3.5" />{email}</span>
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Building2 className="h-3.5 w-3.5" />{institution}</span>
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Globe2 className="h-3.5 w-3.5" />{timezone}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={auditLink} className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-xs font-medium text-forum-700 hover:bg-forum-50">
                <HistoryIcon className="h-3.5 w-3.5" /> View my audit log
              </Link>
              <span className="text-xs text-ink-subtle">API tokens unavailable</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                  <User className="h-5 w-5 text-forum-600" /> Personal &amp; Contact
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Your administrator contact details and professional information.
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput required hint={data.profile.firstName ? undefined : `Current account name: ${data.account.fullName}. Enter your name components to update your profile.`} label="First name" error={fields['profile.firstName']} value={firstName} onChange={(e) => setFirstName(e.target.value)} icon={<User className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Last name" error={fields['profile.lastName']} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Display name" error={fields['profile.displayName']} value={displayName} onChange={(e) => setDisplayName(e.target.value)} hint="Shown on your administrator profile." />
                <SelectInput label="Professional designation" hint="Profile information only; does not change access permissions." value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Not specified</option>{data.policy.designations.map(r => <option key={r}>{r}</option>)}
                </SelectInput>
              </div>
              <TextInput label="Job Title" error={fields['profile.jobTitle']} value={title} onChange={(e) => setTitle(e.target.value)} icon={<Briefcase className="h-4 w-4 text-ink-subtle" />} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput hint={`Contact information only. Login email: ${data.account.loginEmail}`} label="Work Email" error={fields['profile.workEmail']} type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Work Phone" error={fields['profile.phone']} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} icon={<Phone className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <TextInput label="Office / Institution" error={fields['profile.institution']} value={institution} onChange={(e) => setInstitution(e.target.value)} icon={<Building2 className="h-4 w-4 text-ink-subtle" />} />
                </div>
                <TextInput label="Country" error={fields['profile.country']} value={country} onChange={(e) => setCountry(e.target.value)} icon={<Globe2 className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectInput label="Working Timezone" error={fields['profile.timezone']} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {[...new Set(['UTC', ...data.policy.timezones, timezone])].map(tz => <option key={tz}>{tz}</option>)}
                </SelectInput>
                <TextInput label="ORCID iD" error={fields['profile.orcid']} value={orcid} onChange={(e) => setOrcid(e.target.value)} icon={<IdCard className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <TextInput label="Personal / Lab website (optional)" error={fields['profile.website']} value={website} onChange={(e) => setWebsite(e.target.value)} icon={<Globe2 className="h-4 w-4 text-ink-subtle" />} />
              <TextArea maxLength={600} label="Short Bio / Professional Statement" error={fields['profile.bio']} rows={5} value={bio} onChange={(e) => setBio(e.target.value)} hint={`${bio.length}/600 characters`} />
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-paper-border">
                <Button variant="ghost" size="sm" onClick={() => state.setProfile(data.profile)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Discard
                </Button>
                <Button variant="primary" size="sm" onClick={() => void state.save('profile')}>
                  <Save className="h-3.5 w-3.5" /> Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                  <Bell className="h-5 w-5 text-forum-600" /> Notification Preferences
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5">Enabled subscriptions add email to in-app notifications. Unsupported categories are unavailable.</p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {(!data.capabilities.emailConfigured || !data.capabilities.emailWorkerEnabled) && <p className="text-xs text-ink-muted">Email delivery is currently unavailable. Preferences are saved; in-app notifications continue.</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <SectionGroup label="Membership & Credentialing">
                  <Checkbox id="n1" name="n1" label="New application submitted" checked={notif.appNewMember} onChange={(e) => setNotif({ ...notif, appNewMember: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n2" name="n2" label="Escalated / SLA-breaching applications — unavailable" checked={false} disabled />
                  <Checkbox id="n3" name="n3" label="Daily approval digest — unavailable" checked={false} disabled />
                </SectionGroup>
                <SectionGroup label="Support Requests">
                  <Checkbox id="n4" name="n4" label="Urgent / High-priority support requests" checked={notif.supportUrgent} onChange={(e) => setNotif({ ...notif, supportUrgent: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n5" name="n5" label="All support request updates (high volume)" checked={notif.supportAll} onChange={(e) => setNotif({ ...notif, supportAll: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n6" name="n6" label="SAB review requested (your assigned) — unavailable" checked={false} disabled />
                </SectionGroup>
                <SectionGroup label="Inquiries & Events">
                  <Checkbox id="n7" name="n7" label="New public contact form inquiry" checked={notif.inquiryNew} onChange={(e) => setNotif({ ...notif, inquiryNew: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n8" name="n8" label="Daily inquiry triage digest — unavailable" checked={false} disabled />
                  <Checkbox id="n9" name="n9" label="Event reminders (events you organize) — unavailable" checked={false} disabled />
                </SectionGroup>
                <SectionGroup label="System & Communications">
                  <Checkbox id="n10" name="n10" label="Scheduled maintenance & outage notices — unavailable" checked={false} disabled />
                  <Checkbox id="n11" name="n11" label="Weekly CRO summary digest (Fridays) — unavailable" checked={false} disabled />
                  <Checkbox id="n12" name="n12" label="Community & marketing communications — unavailable" checked={false} disabled />
                </SectionGroup>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-paper-border">
                <Button variant="ghost" size="sm" onClick={() => setNotif(data.defaults)}>Use defaults</Button>
                <Button variant="primary" size="sm" onClick={() => void state.save('preferences')}>
                  <Save className="h-3.5 w-3.5" /> Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                  <Key className="h-5 w-5 text-forum-600" /> Change Password
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Use at least 14 characters and no more than 72 UTF-8 bytes. Updating your password signs out other sessions.
                </p>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4">
                <div className="relative">
                  <TextInput label="Current password" type={showPass.current ? 'text' : 'password'} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} icon={<Shield className="h-4 w-4 text-ink-subtle" />} />
                  <button onClick={() => setShowPass((p) => ({ ...p, current: !p.current }))} className="absolute right-3 top-9 text-ink-subtle hover:text-forum-700" aria-label="Toggle password">
                    {showPass.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <TextInput label="New password (min 14 chars)" type={showPass.new ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)} />
                    <button onClick={() => setShowPass((p) => ({ ...p, new: !p.new }))} className="absolute right-3 top-9 text-ink-subtle hover:text-forum-700" aria-label="Toggle">
                      {showPass.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <TextInput label="Confirm new password" type={showPass.confirm ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} error={confirmPw && newPw !== confirmPw ? 'Passwords do not match.' : undefined} />
                    <button onClick={() => setShowPass((p) => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-9 text-ink-subtle hover:text-forum-700" aria-label="Toggle">
                      {showPass.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {newPw && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Password strength</p>
                    <span className={`text-xs font-semibold ${
                      pwScore >= 4 ? 'text-success-600' : pwScore >= 2 ? 'text-brass-700' : 'text-danger-600'
                    }`}>
                      {pwScore === 5 ? 'Excellent' : pwScore >= 4 ? 'Strong' : pwScore >= 2 ? 'Fair' : 'Weak'}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className={`h-1.5 rounded-full ${
                        i <= pwScore
                          ? pwScore >= 4 ? 'bg-success-500' : pwScore >= 2 ? 'bg-brass-500' : 'bg-danger-500'
                          : 'bg-paper-border'
                      }`} />
                    ))}
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-ink-muted">
                    <li className="inline-flex items-center gap-1">{[...newPw].length >= 14 ? <CheckCircle2 className="h-3 w-3 text-success-600" /> : <X className="h-3 w-3 text-danger-500" />} 14+ characters</li>
                    <li className="inline-flex items-center gap-1">
                      {/[A-Z]/.test(newPw) && /[a-z]/.test(newPw) ? <CheckCircle2 className="h-3 w-3 text-success-600" /> : <X className="h-3 w-3 text-danger-500" />} Mixed case
                    </li>
                    <li className="inline-flex items-center gap-1">{/\d/.test(newPw) ? <CheckCircle2 className="h-3 w-3 text-success-600" /> : <X className="h-3 w-3 text-danger-500" />} Number</li>
                    <li className="inline-flex items-center gap-1">{/[^A-Za-z0-9]/.test(newPw) ? <CheckCircle2 className="h-3 w-3 text-success-600" /> : <X className="h-3 w-3 text-danger-500" />} Symbol</li>
                  </ul>
                </div>
              )}

              {pwError && (
                <div className="rounded-lg border border-danger-600/30 bg-danger-50 p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-danger-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-danger-700">{pwError}</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-paper-border">
                <Button variant="ghost" size="sm" onClick={() => { setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError(null); }}>Reset</Button>
                <Button variant="primary" size="sm" onClick={() => void savePassword()}>
                  <Key className="h-3.5 w-3.5" /> Update Password
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Shield className="h-5 w-5 text-success-600" /> Security &amp; Access
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <Info2Row icon={<ShieldCheck className="h-4 w-4" />} label="Multi-Factor Authentication" value={<span className="text-xs text-ink-subtle">Unavailable — not configured for this application</span>} />
              <Info2Row icon={<Key className="h-4 w-4" />} label="Last password change" value={at(overview?.security.passwordChangedAt)} />
              <Info2Row icon={<Globe2 className="h-4 w-4" />} label="Last login" value={at(overview?.security.lastLoginAt)} />
              <Info2Row icon={<AlertTriangle className="h-4 w-4" />} label="Active sessions" value={<div className="flex flex-wrap items-center gap-2"><span>{overview ? `${overview.security.activeSessions} active sessions` : 'Loading…'}</span><Button variant="ghost" size="sm" onClick={() => setSessionsOpen(true)}>Review</Button></div>} />
              {state.overviewError && <p role="alert" className="text-xs text-danger-600">{state.overviewError} <button onClick={() => void state.refreshOverview()}>Retry overview</button></p>}

            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-forum-600" /> Work Queues
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {assignedQueues.map((q) => (
                <Link key={q.name} to={q.link}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-forum-900">{q.name}</p>
                      <p className="text-[11px] text-ink-subtle mt-0.5">
                        {q.open} open{(q.slaBreach ?? 0) > 0 && <span className="text-danger-600 font-semibold ml-1">· {q.slaBreach} breaching SLA</span>}
                      </p>
                    </div>
                    <Badge variant={(q.slaBreach ?? 0) > 0 ? 'danger' : 'default'} className="!py-0">{q.open}</Badge>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success-600" /> Your Recent Approvals
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {!overview ? <p className="text-xs">Loading approvals…</p> : !recentApprovals.length && <p className="text-xs text-ink-subtle">No approvals recorded yet.</p>}
              {recentApprovals.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg hover:bg-forum-50/40">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-forum-900 truncate">{a.member}</p>
                    <p className="text-[11px] text-ink-subtle"><Badge variant="default" className="!text-[10px] !py-0 mr-1">{a.type}</Badge><Clock className="h-3 w-3 inline mr-1 opacity-60" />{a.at}</p>
                  </div>
                  <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded shrink-0">{a.id}</code>
                </div>
              ))}
              <Link to={auditLink} className="flex w-full mt-1 justify-center gap-1 text-sm text-forum-700">
                <FileText className="h-3.5 w-3.5" /> View in Audit Log
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-slateteal-500" /> Recent Activity
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              {!overview ? <p className="text-xs">Loading activity…</p> : !activity.length && <p className="text-xs text-ink-subtle">No activity recorded yet.</p>}
              <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                {activity.map((a) => {
                  const color = a.severity === 'success' ? 'bg-success-600' : a.severity === 'warning' ? 'bg-warning-600' : a.severity === 'danger' ? 'bg-danger-600' : a.severity === 'info' ? 'bg-slateteal-600' : 'bg-forum-600';
                  return (
                    <li key={a.id} className="relative">
                      <span className={`absolute -left-[27px] top-0.5 h-5 w-5 rounded-full ring-4 ring-paper-raised flex items-center justify-center text-white ${color}`}>
                        {a.severity === 'success' ? <CheckCircle2 className="h-3 w-3" /> : a.severity === 'danger' || a.severity === 'warning' ? <AlertCircle className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                      </span>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <p className="text-sm font-medium text-forum-900">{a.action}</p>
                        <span className="text-[11px] text-ink-subtle">{a.at}</span>
                      </div>
                      <p className="text-xs text-ink-muted mt-1">{a.detail}</p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
      </fieldset>
      {sessionsOpen && <AdminSessionsDialog close={() => setSessionsOpen(false)} updated={() => void state.refreshOverview()} denied={state.fail} />}
    </div>
  );
}

function SectionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-paper-border p-4 space-y-2.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-subtle">{label}</h4>
      {children}
    </div>
  );
}

function Info2Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-paper-border last:border-0">
      <div className="flex items-start gap-2 min-w-0">
        <div className="h-8 w-8 shrink-0 rounded-md bg-forum-50 text-forum-700 flex items-center justify-center text-ink-subtle mt-0.5">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{label}</p>
          <div className="text-sm mt-0.5 text-forum-900">{value}</div>
        </div>
      </div>
    </div>
  );
}
