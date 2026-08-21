import { useState } from 'react';
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
  Sparkles,
  Upload,
  X,
  Clock,
  History as HistoryIcon,
  Shield,
  Phone,
  AlertCircle,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type AdminRole = 'CRO Lead' | 'CRO Administrator' | 'SAB Member' | 'Grants Officer' | 'Communications' | 'Wellness Committee' | 'Auditor (Read-only)';
type MfaStatus = 'Enabled' | 'Not configured' | 'Pending';

interface ActivityItem {
  at: string;
  action: string;
  detail: string;
  severity: 'success' | 'info' | 'warning' | 'danger' | 'default';
}

const activity: ActivityItem[] = [
  { at: 'Today · 14:22 UTC', action: 'Approved member application', detail: 'IFSMHP-APP-2026-01847 — Dr. A. Kapoor', severity: 'success' },
  { at: 'Today · 11:08 UTC', action: 'Edited event', detail: 'Symposium 2026 — updated cover banner', severity: 'info' },
  { at: 'Today · 09:41 UTC', action: 'Assigned SAB reviewer', detail: 'PUB-00344 — Wearable EEG study', severity: 'info' },
  { at: 'Yesterday · 18:03 UTC', action: 'Sent support request response', detail: 'SR-00240 — Official letter of support', severity: 'success' },
  { at: 'Yesterday · 15:44 UTC', action: 'Failed login attempt', detail: 'Blocked — 2FA challenge failed', severity: 'warning' },
  { at: 'Aug 19, 2026 · 10:08 UTC', action: 'Rejected spam inquiry', detail: 'INQ-0144 — mailing list purchase', severity: 'danger' },
];

const recentApprovals: { id: string; member: string; at: string; type: string }[] = [
  { id: 'PA-00021', member: 'Dr. T. Mbeki (Wits)', at: 'Aug 20, 08:12', type: 'Project' },
  { id: 'PUB-00341', member: 'Prof. M. Chen (Stanford)', at: 'Aug 19, 14:02', type: 'Publication' },
  { id: 'SR-00239', member: 'Dr. L. Rossi (Milan)', at: 'Aug 19, 10:18', type: 'Support Request' },
];

const assignedQueues: { name: string; open: number; slaBreach: number; link: string }[] = [
  { name: 'Membership Applications', open: 6, slaBreach: 2, link: '/admin/members/pending' },
  { name: 'Publication Review (SAB)', open: 11, slaBreach: 1, link: '/admin/publications' },
  { name: 'Support Queue · Official', open: 4, slaBreach: 0, link: '/admin/support' },
  { name: 'Inquiries · Press/Media', open: 3, slaBreach: 0, link: '/admin/inquiries' },
];

export default function AdminProfilePage() {
  const [firstName, setFirstName] = useState('Eleanor');
  const [lastName, setLastName] = useState('Whitfield');
  const [displayName, setDisplayName] = useState('Dr. E. Whitfield');
  const [title, setTitle] = useState('Chief Research Officer (CRO Lead)');
  const [email, setEmail] = useState('e.whitfield@ifsmhp.example');
  const [phone, setPhone] = useState('+44 20 7946 0593');
  const [institution, setInstitution] = useState('IFSMHP CRO Office · London');
  const [country, setCountry] = useState('United Kingdom');
  const [timezone, setTimezone] = useState('Europe/London (BST/GMT)');
  const [role, setRole] = useState<AdminRole>('CRO Lead');
  const [bio, setBio] = useState('CRO Lead at the IFSMHP Central Research Office. Clinical neuroscientist and cognitive neurologist by training. Responsible for Scientific Advisory Board coordination, membership credentialing, and scientific integrity oversight across the seven professional tracks.');
  const [orcid, setOrcid] = useState('0000-0002-1825-382X');
  const [website, setWebsite] = useState('https://ifsmhp.example/about/whitfield');
  const [saved, setSaved] = useState<null | 'profile' | 'password' | 'notif' | 'security'>(null);
  const [mfa, setMfa] = useState<MfaStatus>('Enabled');
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [notif, setNotif] = useState({
    appNewMember: true,
    memberEscalated: true,
    memberApprovalDigest: true,
    supportUrgent: true,
    supportAll: false,
    sabRequired: true,
    inquiryNew: false,
    inquiryDigest: true,
    eventReminder: true,
    systemOutage: true,
    weeklyDigest: true,
    marketing: false,
  });

  const notifyFlash = (key: typeof saved) => { setSaved(key); setTimeout(() => setSaved(null), 2500); };

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

  const savePassword = () => {
    setPwError(null);
    if (!currentPw) { setPwError('Current password is required.'); return; }
    if (newPw.length < 14) { setPwError('New password must be at least 14 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('New password and confirmation do not match.'); return; }
    notifyFlash('password');
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
  };

  const handleToggleMfa = () => {
    if (mfa === 'Enabled') setMfa('Pending'); // simulate disable flow confirmation pending
    else setMfa('Enabled');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />{DEMO_LABEL}</Badge>
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
          <Badge variant="success" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Account Active</Badge>
          <Badge variant="brass" className="gap-1"><ShieldCheck className="h-2.5 w-2.5" />{role}</Badge>
          <Button variant="outline" size="sm" onClick={() => notifyFlash('profile')}>
            {saved === 'profile' ? <><Check className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Save All Changes</>}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-28 bg-gradient-to-br from-forum-600 via-forum-700 to-slateteal-600 relative">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        </div>
        <CardContent className="pt-0 -mt-14">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="relative">
                <div className="h-28 w-28 rounded-2xl bg-gradient-to-br from-brass-500 to-forum-600 ring-4 ring-paper-raised shadow-lg flex items-center justify-center text-white font-display text-3xl font-bold">
                  EW
                </div>
                <button className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-paper-raised border border-paper-border text-forum-700 flex items-center justify-center shadow-sm hover:bg-forum-50" aria-label="Change avatar">
                  <Upload className="h-4 w-4" />
                </button>
              </div>
              <div className="pb-2 min-w-0">
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">{displayName}</h2>
                <p className="text-base text-ink-muted mt-0.5">{title}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Mail className="h-3.5 w-3.5" />{email}</span>
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Building2 className="h-3.5 w-3.5" />{institution}</span>
                  <span className="inline-flex items-center gap-1 text-ink-subtle"><Globe2 className="h-3.5 w-3.5" />{timezone}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/audit-log" className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-xs font-medium text-forum-700 hover:bg-forum-50">
                <HistoryIcon className="h-3.5 w-3.5" /> View my audit log
              </Link>
              <Button variant="outline" size="sm"><Key className="h-3.5 w-3.5" />View API tokens</Button>
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
                  How your contact information appears to members when you sign correspondence as CRO Office or SAB.
                </p>
              </div>
              {saved === 'profile' && <Badge variant="success" className="!py-1"><Check className="h-3 w-3 mr-1" /> Saved</Badge>}
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} icon={<User className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} hint="Shown on signed correspondence." />
                <SelectInput label="Professional / Administrative Role" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
                  {(['CRO Lead', 'CRO Administrator', 'SAB Member', 'Grants Officer', 'Communications', 'Wellness Committee', 'Auditor (Read-only)'] as AdminRole[]).map((r) => <option key={r}>{r}</option>)}
                </SelectInput>
              </div>
              <TextInput label="Job Title" value={title} onChange={(e) => setTitle(e.target.value)} icon={<Briefcase className="h-4 w-4 text-ink-subtle" />} />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextInput label="Work Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<Mail className="h-4 w-4 text-ink-subtle" />} />
                <TextInput label="Work Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} icon={<Phone className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <TextInput label="Office / Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} icon={<Building2 className="h-4 w-4 text-ink-subtle" />} />
                </div>
                <TextInput label="Country" value={country} onChange={(e) => setCountry(e.target.value)} icon={<Globe2 className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectInput label="Working Timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                  {['Europe/London (BST/GMT)', 'Europe/Stockholm (CET)', 'Europe/Berlin', 'America/New_York (ET)', 'America/Los_Angeles (PT)', 'Asia/Kolkata (IST)', 'Asia/Tokyo (JST)', 'Australia/Sydney (AEST)'].map((tz) => <option key={tz}>{tz}</option>)}
                </SelectInput>
                <TextInput label="ORCID iD" value={orcid} onChange={(e) => setOrcid(e.target.value)} icon={<IdCard className="h-4 w-4 text-ink-subtle" />} />
              </div>
              <TextInput label="Personal / Lab website (optional)" value={website} onChange={(e) => setWebsite(e.target.value)} icon={<Globe2 className="h-4 w-4 text-ink-subtle" />} />
              <TextArea label="Short Bio / Professional Statement" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} hint={`${bio.length}/600 characters`} />
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-paper-border">
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-3.5 w-3.5" /> Discard
                </Button>
                <Button variant="primary" size="sm" onClick={() => notifyFlash('profile')}>
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
                <p className="text-xs text-ink-subtle mt-0.5">Control what you receive by email vs. in-app only. Weekly digest aggregates non-urgent items.</p>
              </div>
              {saved === 'notif' && <Badge variant="success" className="!py-1"><Check className="h-3 w-3 mr-1" />Updated</Badge>}
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <SectionGroup label="Membership & Credentialing">
                  <Checkbox id="n1" name="n1" label="New application submitted" checked={notif.appNewMember} onChange={(e) => setNotif({ ...notif, appNewMember: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n2" name="n2" label="Escalated / SLA-breaching applications" checked={notif.memberEscalated} onChange={(e) => setNotif({ ...notif, memberEscalated: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n3" name="n3" label="Daily approval digest" checked={notif.memberApprovalDigest} onChange={(e) => setNotif({ ...notif, memberApprovalDigest: (e.target as HTMLInputElement).checked })} />
                </SectionGroup>
                <SectionGroup label="Support Requests">
                  <Checkbox id="n4" name="n4" label="Urgent / High-priority support requests" checked={notif.supportUrgent} onChange={(e) => setNotif({ ...notif, supportUrgent: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n5" name="n5" label="All support request updates (high volume)" checked={notif.supportAll} onChange={(e) => setNotif({ ...notif, supportAll: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n6" name="n6" label="SAB review requested (your assigned)" checked={notif.sabRequired} onChange={(e) => setNotif({ ...notif, sabRequired: (e.target as HTMLInputElement).checked })} />
                </SectionGroup>
                <SectionGroup label="Inquiries & Events">
                  <Checkbox id="n7" name="n7" label="New public contact form inquiry" checked={notif.inquiryNew} onChange={(e) => setNotif({ ...notif, inquiryNew: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n8" name="n8" label="Daily inquiry triage digest" checked={notif.inquiryDigest} onChange={(e) => setNotif({ ...notif, inquiryDigest: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n9" name="n9" label="Event reminders (events you organize)" checked={notif.eventReminder} onChange={(e) => setNotif({ ...notif, eventReminder: (e.target as HTMLInputElement).checked })} />
                </SectionGroup>
                <SectionGroup label="System & Communications">
                  <Checkbox id="n10" name="n10" label="Scheduled maintenance & outage notices" checked={notif.systemOutage} onChange={(e) => setNotif({ ...notif, systemOutage: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n11" name="n11" label="Weekly CRO summary digest (Fridays)" checked={notif.weeklyDigest} onChange={(e) => setNotif({ ...notif, weeklyDigest: (e.target as HTMLInputElement).checked })} />
                  <Checkbox id="n12" name="n12" label="Community & marketing communications" checked={notif.marketing} onChange={(e) => setNotif({ ...notif, marketing: (e.target as HTMLInputElement).checked })} />
                </SectionGroup>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2 border-t border-paper-border">
                <Button variant="ghost" size="sm">Use defaults</Button>
                <Button variant="primary" size="sm" onClick={() => notifyFlash('notif')}>
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
                  IFSMHP requires admin passwords of at least 14 characters, multi-factor authentication, and rotation every 180 days.
                </p>
              </div>
              {saved === 'password' && <Badge variant="success" className="!py-1"><Check className="h-3 w-3 mr-1" /> Password changed</Badge>}
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
                    <li className="inline-flex items-center gap-1">{newPw.length >= 14 ? <CheckCircle2 className="h-3 w-3 text-success-600" /> : <X className="h-3 w-3 text-danger-500" />} 14+ characters</li>
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
                <Button variant="primary" size="sm" onClick={savePassword}>
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
              <Info2Row icon={<ShieldCheck className="h-4 w-4" />} label="Multi-Factor Authentication" value={
                <div className="flex items-center justify-between gap-2">
                  <Badge variant={mfa === 'Enabled' ? 'success' : mfa === 'Not configured' ? 'danger' : 'warning'} className="!py-1">
                    {mfa === 'Enabled' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {mfa}
                  </Badge>
                  <Button variant={mfa === 'Enabled' ? 'outline' : 'primary'} size="sm" onClick={handleToggleMfa}>
                    {mfa === 'Enabled' ? 'Manage' : mfa === 'Pending' ? 'Cancel disable' : 'Set up 2FA'}
                  </Button>
                </div>
              } />
              <Info2Row icon={<Key className="h-4 w-4" />} label="Last password change" value={<span className="text-xs text-ink"><Clock className="h-3.5 w-3.5 inline mr-1" />42 days ago · expires in 138 days</span>} />
              <Info2Row icon={<Globe2 className="h-4 w-4" />} label="Last login" value={<span className="text-xs text-ink">Today · 08:02 BST · London, UK</span>} />
              <Info2Row icon={<AlertTriangle className="h-4 w-4 text-warning-600" />} label="Active sessions" value={
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-ink">2 active sessions</span>
                  <Button variant="ghost" size="sm">Review</Button>
                </div>
              } />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-forum-600" /> Assigned Queues
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {assignedQueues.map((q) => (
                <Link key={q.name} to={q.link}>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-forum-900">{q.name}</p>
                      <p className="text-[11px] text-ink-subtle mt-0.5">
                        {q.open} open{q.slaBreach > 0 && <span className="text-danger-600 font-semibold ml-1">· {q.slaBreach} breaching SLA</span>}
                      </p>
                    </div>
                    <Badge variant={q.slaBreach > 0 ? 'danger' : 'default'} className="!py-0">{q.open}</Badge>
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
              {recentApprovals.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg hover:bg-forum-50/40">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-forum-900 truncate">{a.member}</p>
                    <p className="text-[11px] text-ink-subtle"><Badge variant="default" className="!text-[10px] !py-0 mr-1">{a.type}</Badge><Clock className="h-3 w-3 inline mr-1 opacity-60" />{a.at}</p>
                  </div>
                  <code className="font-mono text-[10px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded shrink-0">{a.id}</code>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full mt-1 justify-center">
                <FileText className="h-3.5 w-3.5" /> View in Audit Log
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-slateteal-500" /> Recent Activity
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                {activity.map((a, i) => {
                  const color = a.severity === 'success' ? 'bg-success-600' : a.severity === 'warning' ? 'bg-warning-600' : a.severity === 'danger' ? 'bg-danger-600' : a.severity === 'info' ? 'bg-slateteal-600' : 'bg-forum-600';
                  return (
                    <li key={i} className="relative">
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
