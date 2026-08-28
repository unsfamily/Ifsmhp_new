import { useState } from 'react';
import {
  ArrowLeft,
  Settings as GearIcon,
  ShieldCheck,
  Mail,
  Globe2,
  Save,
  FileText,
  Building2,
  Users,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Clock,
  Lock,
  Eye,
  Database,
  RefreshCw,
  Plus,
  Trash2,
  X,
  Link as LinkIcon,
  Wallet,
  Calendar as CalendarIcon,
  History as HistoryIcon,
  Cloud,
  Cpu,
  FileCheck,
  Award,
  Megaphone,
  Key,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type Tab =
  | 'general'
  | 'membership'
  | 'events'
  | 'communications'
  | 'review'
  | 'security'
  | 'integrations'
  | 'billing'
  | 'backup';

interface ConfigRow {
  name: string;
  description: string;
  current?: string;
}

const TAB_DEFS: { key: Tab; label: string; icon: typeof Globe2; hint?: string }[] = [
  { key: 'general', label: 'General', icon: Globe2, hint: 'Platform-wide names, contact, timezone & locale.' },
  { key: 'membership', label: 'Membership', icon: Users, hint: 'Fees, applications, credentials & ID issuance.' },
  { key: 'events', label: 'Events & Calendar', icon: CalendarIcon, hint: 'Default event policies, reminders & privacy.' },
  { key: 'communications', label: 'Communications', icon: Megaphone, hint: 'Email templates, signatures, announcements, digest.' },
  { key: 'review', label: 'Review & SLA', icon: FileCheck, hint: 'Publication and project review policies, SLAs, delegation.' },
  { key: 'security', label: 'Security & Privacy', icon: ShieldCheck, hint: 'Password policy, sessions, MFA, data retention.' },
  { key: 'integrations', label: 'Integrations & API', icon: LinkIcon, hint: 'SSO, webhooks, API clients, storage endpoints.' },
  { key: 'billing', label: 'Billing & Finance', icon: Wallet, hint: 'Dues, invoicing, payment providers, funding awards.' },
  { key: 'backup', label: 'Backup & Audit', icon: Database, hint: 'Backup schedule, retention, audit log export.' },
];

interface SavedState {
  section: Tab | null;
  at: string;
}

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [saved, setSaved] = useState<SavedState>({ section: null, at: '' });
  const [confirmReset, setConfirmReset] = useState<Tab | null>(null);

  const saveSection = (s: Tab) => {
    setSaved({ section: s, at: 'just now' });
    setTimeout(() => setSaved({ section: null, at: '' }), 3000);
  };

  const resetSection = (s: Tab) => {
    setConfirmReset(s);
    setTimeout(() => setConfirmReset(null), 1500);
  };

  const tabMeta = TAB_DEFS.find((t) => t.key === tab) ?? TAB_DEFS[0]!;

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
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            IFSMHP Administration Settings
          </h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Platform-wide configuration for the Central Research Office. Changes in this area affect all users and are recorded in the immutable audit log.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {saved.section === tab && (
            <Badge variant="success" className="!py-1"><CheckCircle2 className="h-3 w-3 mr-1" />{tabMeta.label} saved {saved.at}</Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => resetSection(tab)}>
            {confirmReset === tab ? <><CheckCircle2 className="h-3.5 w-3.5 text-success-600" /> Reset to defaults</> : <><RefreshCw className="h-3.5 w-3.5" /> Reset to defaults</>}
          </Button>
          <Button variant="primary" size="sm" onClick={() => saveSection(tab)}>
            {saved.section === tab ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Save {tabMeta.label}</>}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-1 lg:self-start sticky top-4">
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <GearIcon className="h-5 w-5 text-forum-600" /> Settings
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-1">
            {TAB_DEFS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-start gap-2 p-2.5 rounded-lg transition-colors text-left ${
                  tab === t.key ? 'bg-forum-50 ring-1 ring-forum-100' : 'hover:bg-forum-50/40'
                }`}
              >
                <div className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center ${
                  tab === t.key ? 'bg-forum-600 text-white' : 'bg-forum-50 text-forum-700'
                }`}>
                  <t.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${tab === t.key ? 'text-forum-900' : 'text-ink'}`}>{t.label}</p>
                  {t.hint && <p className="text-[10px] text-ink-subtle mt-0.5 leading-tight">{t.hint}</p>}
                </div>
                <ChevronRight className={`h-4 w-4 shrink-0 mt-1 ${tab === t.key ? 'text-forum-700' : 'text-paper-border'}`} />
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-4 space-y-5">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-lg bg-forum-50 text-forum-700 flex items-center justify-center">
                    <tabMeta.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-semibold text-forum-900">{tabMeta.label} Settings</h3>
                    {tabMeta.hint && <p className="text-xs text-ink-subtle mt-0.5">{tabMeta.hint}</p>}
                  </div>
                </div>
                <Link to="/admin/audit-log" className="inline-flex items-center gap-1 text-xs font-semibold text-forum-700 hover:underline">
                  <HistoryIcon className="h-3.5 w-3.5" /> View configuration audit trail
                </Link>
              </div>
            </CardHeader>
          </Card>

          {tab === 'general' && <GeneralSettings />}
          {tab === 'membership' && <MembershipSettings />}
          {tab === 'events' && <EventsSettings />}
          {tab === 'communications' && <CommunicationsSettings />}
          {tab === 'review' && <ReviewSLASettings />}
          {tab === 'security' && <SecuritySettings />}
          {tab === 'integrations' && <IntegrationsSettings />}
          {tab === 'billing' && <BillingSettings />}
          {tab === 'backup' && <BackupSettings />}

          <div className="rounded-2xl border border-paper-border bg-paper overflow-hidden">
            <div className="px-5 py-3.5 bg-gradient-to-br from-forum-50 to-brass-50/60 border-b border-paper-border flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-ink-subtle inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-brass-700" />
                Production-only: changing these values in production will send a signed confirmation to all CRO Leads and require their verification via 2FA.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => resetSection(tab)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reset this section
                </Button>
                <Button variant="primary" size="sm" onClick={() => saveSection(tab)}>
                  {saved.section === tab ? <><CheckCircle2 className="h-3.5 w-3.5" /> Saved</> : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== SECTION COMPONENTS ============== */

function GeneralSettings() {
  const [platformName, setPlatformName] = useState('International Federation of Scientists & Mental Health Professionals');
  const [shortName, setShortName] = useState('IFSMHP');
  const [legalName, setLegalName] = useState('International Federation of Scientists & Mental Health Professionals, Ltd.');
  const [regNo, setRegNo] = useState('UK Companies House · 15820943');
  const [address, setAddress] = useState('14 Bloomsbury Square, London, WC1A 2LP, United Kingdom');
  const [contact, setContact] = useState('cro-office@ifsmhp.example · +44 20 7946 0950');
  const [locale, setLocale] = useState('English (UK)');
  const [tz, setTz] = useState('Europe/London (BST/GMT)');
  const [dateFormat, setDateFormat] = useState('DD Month YYYY (18 Sep 2026)');
  const [home, setHome] = useState('https://ifsmhp.example');
  const [community, setCommunity] = useState('https://community.ifsmhp.example');
  const [maintenance, setMaintenance] = useState(false);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Organization &amp; Platform Identity</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Full organization name" value={platformName} onChange={(e) => setPlatformName(e.target.value)} icon={<Building2 className="h-4 w-4 text-ink-subtle" />} />
            <TextInput label="Short / brand name" value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Legal entity name" value={legalName} onChange={(e) => setLegalName(e.target.value)} icon={<FileCheck className="h-4 w-4 text-ink-subtle" />} />
            <TextInput label="Registration / company number" value={regNo} onChange={(e) => setRegNo(e.target.value)} />
          </div>
          <TextArea label="Registered / mailing address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
          <TextInput label="Contact details (displayed in footer)" value={contact} onChange={(e) => setContact(e.target.value)} icon={<Mail className="h-4 w-4 text-ink-subtle" />} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Locale, Dates &amp; URLs</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput label="Default Language" value={locale} onChange={(e) => setLocale(e.target.value)}>
              {['English (UK)', 'English (US)', 'Español', 'Français', 'Deutsch', '日本語', '简体中文', 'हिन्दी', 'العربية'].map((l) => <option key={l}>{l}</option>)}
            </SelectInput>
            <SelectInput label="Default Timezone" value={tz} onChange={(e) => setTz(e.target.value)}>
              {['UTC', 'Europe/London (BST/GMT)', 'Europe/Stockholm (CET)', 'America/New_York (ET)', 'America/Los_Angeles (PT)', 'Asia/Kolkata (IST)', 'Asia/Tokyo (JST)', 'Australia/Sydney (AEST)'].map((t) => <option key={t}>{t}</option>)}
            </SelectInput>
            <SelectInput label="Date Format" value={dateFormat} onChange={(e) => setDateFormat(e.target.value)}>
              {['DD Month YYYY (18 Sep 2026)', 'MM/DD/YYYY (09/18/2026)', 'DD/MM/YYYY (18/09/2026)', 'YYYY-MM-DD (2026-09-18)'].map((d) => <option key={d}>{d}</option>)}
            </SelectInput>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Primary website URL" value={home} onChange={(e) => setHome(e.target.value)} icon={<LinkIcon className="h-4 w-4 text-ink-subtle" />} />
            <TextInput label="Community platform URL" value={community} onChange={(e) => setCommunity(e.target.value)} icon={<Users className="h-4 w-4 text-ink-subtle" />} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-danger-600/30 bg-danger-50/30">
        <CardHeader>
          <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-danger-600" /> Maintenance Mode
          </h3>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Checkbox
            id="mm-toggle"
            name="mm-toggle"
            label={
              <span className="text-danger-700">
                Enable maintenance mode <span className="text-ink-subtle font-normal">(public pages show maintenance banner, login restricted to CRO admins)</span>
              </span>
            }
            checked={maintenance}
            onChange={(e) => setMaintenance((e.target as HTMLInputElement).checked)}
          />
          {maintenance && (
            <TextArea rows={2} label="Maintenance message (shown to visitors)" defaultValue="Scheduled maintenance window. We will be back shortly. Thank you for your patience." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MembershipSettings() {
  const [autoId, setAutoId] = useState(true);
  const [idFmt, setIdFmt] = useState('IFSMHP-YYYY-NNNNNN');
  const [applicationFee, setApplicationFee] = useState('85');
  const [annualDues, setAnnualDues] = useState('240');
  const [waiver, setWaiver] = useState(true);
  const [slaPending, setSlaPending] = useState('10');
  const [slaUnderReview, setSlaUnderReview] = useState('15');
  const [credentialMin, setCredentialMin] = useState('2');
  const [autoRejectDays, setAutoRejectDays] = useState('45');
  const [referralRequired, setReferralRequired] = useState(false);
  const [refLetters, setRefLetters] = useState(1);

  const rows: ConfigRow[] = [
    { name: 'Allow auto-issuance of Member IDs', description: 'Server-side, transactional generation on approval.', current: autoId ? 'Enabled' : 'Manual' },
    { name: 'Member ID format', description: 'Year prefix + 6-digit padded sequence.', current: idFmt },
    { name: 'Application fee (USD)', description: 'Non-refundable processing fee.', current: `$${applicationFee}` },
    { name: 'Annual membership dues', description: 'Renewed on member anniversary.', current: `$${annualDues}/year` },
    { name: 'Hardship waiver requests', description: 'Waives application + first year dues.', current: waiver ? 'Available' : 'Disabled' },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Award className="h-5 w-5 text-brass-700" /> Identity &amp; Issuance</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <Checkbox id="auto-id" name="auto-id" label="Server-side auto-issue Member IDs on committee approval (recommended)." defaultChecked={autoId} onChange={(e) => setAutoId((e.target as HTMLInputElement).checked)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="ID format (next cohort)" value={idFmt} onChange={(e) => setIdFmt(e.target.value)}>
              <option>IFSMHP-YYYY-NNNNNN</option>
              <option>IFSMHP-YY-NNNNNN</option>
              <option>IFSMHP-REGION-NNNNNN</option>
            </SelectInput>
            <SelectInput label="Reference letter requirement" value={refLetters.toString()} onChange={(e) => setRefLetters(Number(e.target.value))}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? 'Not required' : `${n} letter${n > 1 ? 's' : ''} from IFSMHP or institutional reference`}</option>)}
            </SelectInput>
          </div>
          <Checkbox id="referral" name="referral" label="New applications require an IFSMHP member referral." checked={referralRequired} onChange={(e) => setReferralRequired((e.target as HTMLInputElement).checked)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Wallet className="h-5 w-5 text-forum-600" /> Fees &amp; Financials</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Application fee (USD)" type="number" value={applicationFee} onChange={(e) => setApplicationFee(e.target.value)} />
            <TextInput label="Annual dues (USD)" type="number" value={annualDues} onChange={(e) => setAnnualDues(e.target.value)} />
          </div>
          <Checkbox id="waiver" name="waiver" label="Allow financial hardship waiver requests (with review and documentation)." checked={waiver} onChange={(e) => setWaiver((e.target as HTMLInputElement).checked)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Clock className="h-5 w-5 text-slateteal-500" /> Application &amp; Credential Review SLA</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <TextInput label="Pending → Start review (days)" type="number" value={slaPending} onChange={(e) => setSlaPending(e.target.value)} />
            <TextInput label="Under review → decision (days)" type="number" value={slaUnderReview} onChange={(e) => setSlaUnderReview(e.target.value)} />
            <TextInput label="Min. credential documents" type="number" value={credentialMin} onChange={(e) => setCredentialMin(e.target.value)} />
            <TextInput label="Auto-archival after rejection (days)" type="number" value={autoRejectDays} onChange={(e) => setAutoRejectDays(e.target.value)} />
          </div>
          <ReadonlyTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function EventsSettings() {
  const [defaultReminder, setDefaultReminder] = useState('1,3,7');
  const [defaultCapacity, setDefaultCapacity] = useState('200');
  const [rsvpRequired, setRsvpRequired] = useState(true);
  const [autoRecord, setAutoRecord] = useState(false);
  const [chathamDefault, setChathamDefault] = useState(false);
  const [eventDigest, setEventDigest] = useState(true);
  const [calFeed, setCalFeed] = useState(true);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Event Defaults &amp; RSVP</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Default capacity (0 = unlimited)" type="number" value={defaultCapacity} onChange={(e) => setDefaultCapacity(e.target.value)} />
            <TextInput label="Default reminder days (comma-separated)" value={defaultReminder} onChange={(e) => setDefaultReminder(e.target.value)} hint="E.g. 1, 3, 7 = reminders 1 day, 3 days and 7 days before event." />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox id="rsvp" name="rsvp" label="RSVP / Registration is enabled by default on new events." checked={rsvpRequired} onChange={(e) => setRsvpRequired((e.target as HTMLInputElement).checked)} />
            <Checkbox id="autorec" name="autorec" label="Record virtual events automatically (video + transcript)." checked={autoRecord} onChange={(e) => setAutoRecord((e.target as HTMLInputElement).checked)} />
            <Checkbox id="chatham" name="chatham" label="Moral Support / Wellness events default to Chatham House Rules." checked={chathamDefault} onChange={(e) => setChathamDefault((e.target as HTMLInputElement).checked)} />
            <Checkbox id="digest" name="digest" label="Include events in weekly community digest." checked={eventDigest} onChange={(e) => setEventDigest((e.target as HTMLInputElement).checked)} />
            <Checkbox id="ical" name="ical" label="Publish public iCal feed of public + member events." checked={calFeed} onChange={(e) => setCalFeed((e.target as HTMLInputElement).checked)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CommunicationsSettings() {
  const [fromName, setFromName] = useState('IFSMHP Central Research Office');
  const [fromEmail, setFromEmail] = useState('noreply@ifsmhp.example');
  const [replyTo, setReplyTo] = useState('cro-office@ifsmhp.example');
  const [signature, setSignature] = useState('IFSMHP Central Research Office\n14 Bloomsbury Square, London WC1A 2LP\nhttps://ifsmhp.example');
  const [newsletter, setNewsletter] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [attachPdf, setAttachPdf] = useState(false);
  const [announcementModeration, setAnnouncementModeration] = useState(true);
  const [supportReplyTemplate, setSupportReplyTemplate] = useState(
`Dear {member_name},

Thank you for your IFSMHP support request #{sr_id}. Your submission has been received and logged by the CRO Office.

Reference: {sr_id}
Status: Under Review
Assigned to: {assignee}

We will respond within the SLA target for this category. For reference, the full request and any attachments are always available from your Member Dashboard.

Best regards,
{signature}`
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Sender Identity &amp; Default Signature</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="From Name" value={fromName} onChange={(e) => setFromName(e.target.value)} />
            <TextInput label="From Email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} icon={<Mail className="h-4 w-4 text-ink-subtle" />} />
            <TextInput label="Reply-To" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} />
          </div>
          <TextArea label="Default email signature" rows={4} value={signature} onChange={(e) => setSignature(e.target.value)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Newsletters &amp; Announcements</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox id="nsl" name="nsl" label="Weekly community newsletter enabled." checked={newsletter} onChange={(e) => setNewsletter((e.target as HTMLInputElement).checked)} />
            <Checkbox id="wsm" name="wsm" label="Weekly member summary digest (Fridays)." checked={weeklySummary} onChange={(e) => setWeeklySummary((e.target as HTMLInputElement).checked)} />
            <Checkbox id="apdf" name="apdf" label="Attach newsletter as PDF (in addition to HTML body)." checked={attachPdf} onChange={(e) => setAttachPdf((e.target as HTMLInputElement).checked)} />
            <Checkbox id="amod" name="amod" label="Announcements require CRO Lead sign-off before send." checked={announcementModeration} onChange={(e) => setAnnouncementModeration((e.target as HTMLInputElement).checked)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Mail className="h-5 w-5 text-forum-600" /> Support Reply Template</h3>
          <p className="text-xs text-ink-subtle mt-0.5">Available variables: <code className="text-[10px] bg-forum-50 px-1 rounded">{'{member_name}'}</code>, <code className="text-[10px] bg-forum-50 px-1 rounded">{'{sr_id}'}</code>, <code className="text-[10px] bg-forum-50 px-1 rounded">{'{assignee}'}</code>, <code className="text-[10px] bg-forum-50 px-1 rounded">{'{signature}'}</code>.</p>
        </CardHeader>
        <CardContent className="pt-0">
          <TextArea rows={14} value={supportReplyTemplate} onChange={(e) => setSupportReplyTemplate(e.target.value)} label="Acknowledge &amp; queue" />
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewSLASettings() {
  const [pubSLA, setPubSLA] = useState('10');
  const [projSLA, setProjSLA] = useState('15');
  const [supportSLA, setSupportSLA] = useState('7');
  const [autoEscalatePub, setAutoEscalatePub] = useState(true);
  const [autoEscalateProj, setAutoEscalateProj] = useState(true);
  const [maxSimultaneous, setMaxSimultaneous] = useState('8');
  const [doubleBlind, setDoubleBlind] = useState(true);
  const [reviewerConflictCheck, setReviewerConflictCheck] = useState(true);
  const [pubDelegates] = useState([
    { id: 1, name: 'Prof. H. Lindberg', track: 'Scientists', role: 'SAB Chair', limit: '12' },
    { id: 2, name: 'Dr. E. Thompson', track: 'Clinicians', role: 'Review Delegate', limit: '15' },
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900">Review SLAs (Working Days)</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Publications: initial decision (days)" type="number" value={pubSLA} onChange={(e) => setPubSLA(e.target.value)} />
            <TextInput label="Project proposals: decision (days)" type="number" value={projSLA} onChange={(e) => setProjSLA(e.target.value)} />
            <TextInput label="Support request: response (days)" type="number" value={supportSLA} onChange={(e) => setSupportSLA(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Checkbox id="ae1" name="ae1" label="Auto-escalate overdue publications to SAB." checked={autoEscalatePub} onChange={(e) => setAutoEscalatePub((e.target as HTMLInputElement).checked)} />
            <Checkbox id="ae2" name="ae2" label="Auto-escalate overdue projects." checked={autoEscalateProj} onChange={(e) => setAutoEscalateProj((e.target as HTMLInputElement).checked)} />
            <Checkbox id="dbl" name="dbl" label="Double-blind review (default)." checked={doubleBlind} onChange={(e) => setDoubleBlind((e.target as HTMLInputElement).checked)} />
            <Checkbox id="rcc" name="rcc" label="Check COI database before reviewer assignment." checked={reviewerConflictCheck} onChange={(e) => setReviewerConflictCheck((e.target as HTMLInputElement).checked)} />
            <TextInput label="Max simultaneous reviews per reviewer" type="number" value={maxSimultaneous} onChange={(e) => setMaxSimultaneous(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-forum-900">Delegate Reviewers by Track</h3>
          <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Add delegate</Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {pubDelegates.map((d, i) => (
            <div key={d.id} className="grid grid-cols-12 gap-3 items-end p-3 rounded-lg border border-paper-border hover:bg-forum-50/30">
              <div className="col-span-12 sm:col-span-4"><TextInput label="Name" defaultValue={d.name} /></div>
              <div className="col-span-6 sm:col-span-3"><SelectInput label="Track" defaultValue={d.track}>{['Scientists','Mental Health Professionals','Researchers','Academicians','Clinicians','Policy Advisors','Public Health'].map((t) => <option key={t}>{t}</option>)}</SelectInput></div>
              <div className="col-span-6 sm:col-span-3"><TextInput label="Role" defaultValue={d.role} /></div>
              <div className="col-span-10 sm:col-span-1"><TextInput label="Limit" type="number" defaultValue={d.limit} /></div>
              <div className="col-span-2 sm:col-span-1 flex justify-end">
                <button className="p-2 rounded-md text-ink-muted hover:bg-danger-50 hover:text-danger-600" aria-label="Remove">
                  {i < 2 ? <X className="h-4 w-4 opacity-0 pointer-events-none" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SecuritySettings() {
  const [pwMin, setPwMin] = useState('14');
  const [pwMaxAge, setPwMaxAge] = useState('180');
  const [pwHistory, setPwHistory] = useState('6');
  const [mfaRequired, setMfaRequired] = useState(true);
  const [mfaGrace, setMfaGrace] = useState('14');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [sessionIpLock, setSessionIpLock] = useState(true);
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [dataRetentionDays, setDataRetentionDays] = useState('3650');
  const [gdprDpo, setGdprDpo] = useState('dpo@ifsmhp.example');
  const [credRetention, setCredRetention] = useState('Permanent archive');

  const rows: ConfigRow[] = [
    { name: 'Minimum password length', description: 'Strongly recommended ≥ 14 per NIST SP 800-63B.', current: `${pwMin} characters` },
    { name: 'Password rotation (max age)', description: 'Forces password change after N days.', current: `${pwMaxAge} days` },
    { name: 'Password history', description: 'Rejects re-use of last N passwords.', current: `Last ${pwHistory}` },
    { name: 'MFA for all admins', description: 'Grace period days for new accounts.', current: mfaRequired ? `Required · ${mfaGrace} day grace` : 'Optional' },
    { name: 'Idle session timeout', description: 'Force logout after N minutes of inactivity.', current: `${sessionTimeout} min` },
    { name: 'Credential documents', description: 'Storage & retention policy.', current: credRetention },
    { name: 'Data retention (audit + user records)', description: 'Years of online retention before cold archive.', current: `${Number(dataRetentionDays) / 365} years` },
    { name: 'GDPR / data protection officer', description: 'Contact for DSARs, erasure requests.', current: gdprDpo },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Lock className="h-5 w-5 text-success-600" /> Authentication Policy</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Minimum password length (chars)" type="number" value={pwMin} onChange={(e) => setPwMin(e.target.value)} />
            <TextInput label="Max password age (days)" type="number" value={pwMaxAge} onChange={(e) => setPwMaxAge(e.target.value)} />
            <TextInput label="Password history (previous N to block)" type="number" value={pwHistory} onChange={(e) => setPwHistory(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox id="mfa" name="mfa" label="Multi-factor authentication required for all administrators, auditors, and SAB members." checked={mfaRequired} onChange={(e) => setMfaRequired((e.target as HTMLInputElement).checked)} />
            <Checkbox id="ip" name="ip" label="Session IP pinning (prevents session hijack across networks)." checked={sessionIpLock} onChange={(e) => setSessionIpLock((e.target as HTMLInputElement).checked)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="MFA grace period (days)" type="number" value={mfaGrace} onChange={(e) => setMfaGrace(e.target.value)} />
            <TextInput label="Idle session timeout (minutes)" type="number" value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)} />
            <SelectInput label="Enforce SSO for admins" value={ssoEnforced ? 'Enforce' : 'Allow password + 2FA'} onChange={(e) => setSsoEnforced(e.target.value === 'Enforce')}>
              <option>Allow password + 2FA</option><option>Enforce</option>
            </SelectInput>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Eye className="h-5 w-5 text-forum-600" /> Data Retention &amp; Privacy</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="All-user data retention (days)" type="number" value={dataRetentionDays} onChange={(e) => setDataRetentionDays(e.target.value)} />
            <SelectInput label="Credential document storage policy" value={credRetention} onChange={(e) => setCredRetention(e.target.value)}>
              <option>Permanent archive</option>
              <option>Delete 7 years after membership lapse</option>
              <option>Delete 1 year after membership lapse</option>
            </SelectInput>
          </div>
          <TextInput label="DPO / Privacy contact email" type="email" value={gdprDpo} onChange={(e) => setGdprDpo(e.target.value)} />
          <ReadonlyTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsSettings() {
  const [ssoProvider, setSsoProvider] = useState('Google Workspace + Microsoft Entra ID');
  const [ssoDomain, setSsoDomain] = useState('ifsmhp.example');
  const [samlEnabled, setSamlEnabled] = useState(true);
  const [oidcEnabled, setOidcEnabled] = useState(true);
  const [scimEnabled, setScimEnabled] = useState(false);
  const [storageProvider, setStorageProvider] = useState('Encrypted object store (EU-West)');
  const [videoProvider, setVideoProvider] = useState('Zoom Events + YouTube Live');
  const [emailProvider, setEmailProvider] = useState('Transactional: Resend · Bulk: Mailgun');
  const [apiClients] = useState([
    { id: 1, name: 'Members portal (frontend SPA)', key: 'pk_live_5c7a•…•39f2', lastUsed: 'today · 14:22', status: 'Active' },
    { id: 2, name: 'Bulk newsletter pipeline', key: 'sk_prod_910d•…•e091', lastUsed: 'today · 06:00', status: 'Active' },
    { id: 3, name: 'Legacy events importer (deprecated)', key: 'sk_test_b7ff•…•01ac', lastUsed: '12 days ago', status: 'Scheduled for deletion' },
  ]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-slateteal-500" /> Single Sign-On &amp; Identity</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="SSO provider(s)" value={ssoProvider} onChange={(e) => setSsoProvider(e.target.value)} />
            <TextInput label="Primary SSO domain" value={ssoDomain} onChange={(e) => setSsoDomain(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Checkbox id="saml" name="saml" label="SAML 2.0" checked={samlEnabled} onChange={(e) => setSamlEnabled((e.target as HTMLInputElement).checked)} />
            <Checkbox id="oidc" name="oidc" label="OpenID Connect" checked={oidcEnabled} onChange={(e) => setOidcEnabled((e.target as HTMLInputElement).checked)} />
            <Checkbox id="scim" name="scim" label="SCIM user provisioning" checked={scimEnabled} onChange={(e) => setScimEnabled((e.target as HTMLInputElement).checked)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Cpu className="h-5 w-5 text-forum-600" /> Service Providers</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput label="Email delivery" value={emailProvider} onChange={(e) => setEmailProvider(e.target.value)}>
              {['Transactional: Resend · Bulk: Mailgun', 'SES (AWS)', 'Postmark + SendGrid', 'SMTP (custom)'].map((v) => <option key={v}>{v}</option>)}
            </SelectInput>
            <SelectInput label="Document storage" value={storageProvider} onChange={(e) => setStorageProvider(e.target.value)}>
              {['Encrypted object store (EU-West)','AWS S3 (eu-west-2) + KMS','GCP Cloud Storage (EU) + CMEK','Azure Blob + Customer Key'].map((v) => <option key={v}>{v}</option>)}
            </SelectInput>
            <SelectInput label="Video / webinar provider" value={videoProvider} onChange={(e) => setVideoProvider(e.target.value)}>
              {['Zoom Events + YouTube Live','Hopin + StreamYard','Teams Live Events','Inveniam (on-prem Jitsi cluster)'].map((v) => <option key={v}>{v}</option>)}
            </SelectInput>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
            <Key className="h-5 w-5 text-forum-600" /> API Clients &amp; Webhooks
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Plus className="h-3.5 w-3.5" /> Add webhook endpoint</Button>
            <Button variant="primary" size="sm"><Plus className="h-3.5 w-3.5" /> Create new API client</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-border text-left">
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Client / App</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Credential</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Last Used</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiClients.map((c) => (
                  <tr key={c.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                    <td className="py-3 px-2">
                      <p className="font-medium text-forum-900">{c.name}</p>
                      <p className="text-[11px] text-ink-subtle sm:hidden">Key: <code className="font-mono bg-forum-50 px-1 rounded">{c.key}</code></p>
                    </td>
                    <td className="py-3 px-2 hidden sm:table-cell"><code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-2 py-1 rounded">{c.key}</code></td>
                    <td className="py-3 px-2 hidden md:table-cell text-xs text-ink-subtle inline-flex items-center gap-1"><Clock className="h-3 w-3" />{c.lastUsed}</td>
                    <td className="py-3 px-2"><Badge variant={c.status === 'Active' ? 'success' : 'warning'}>{c.status}</Badge></td>
                    <td className="py-3 px-2 text-right">
                      <div className="inline-flex gap-1 justify-end">
                        <button className="p-1.5 rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-900" title="Rotate"><RefreshCw className="h-3.5 w-3.5" /></button>
                        <button className="p-1.5 rounded-md text-ink-muted hover:bg-danger-50 hover:text-danger-600" title="Revoke"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingSettings() {
  const [currency, setCurrency] = useState('USD · United States Dollar ($)');
  const [taxId, setTaxId] = useState('GB-VAT-999 9999 99');
  const [pm, setPm] = useState('Stripe Connect');
  const [awardBudget, setAwardBudget] = useState('125000');
  const [awardFiscal, setAwardFiscal] = useState('FY2026 (Jan 1 – Dec 31, 2026)');
  const [invoicePrefix, setInvoicePrefix] = useState('IFSMHP-INV-');
  const [netTerms, setNetTerms] = useState('NET 30');
  const [lateFee, setLateFee] = useState('2% per month, min $25');

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Wallet className="h-5 w-5 text-brass-700" /> Billing Profile</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectInput label="Default currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {['USD · United States Dollar ($)','EUR · Euro (€)','GBP · British Pound (£)','INR · Indian Rupee (₹)','SEK · Swedish Krona (kr)'].map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
            <TextInput label="Tax / VAT registration ID" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectInput label="Payment processor" value={pm} onChange={(e) => setPm(e.target.value)}>
              {['Stripe Connect','Stripe + GoCardless (SEPA DD)','Adyen','Wise Business + Manual wire'].map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
            <TextInput label="Invoice number prefix" value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} />
            <SelectInput label="Payment terms" value={netTerms} onChange={(e) => setNetTerms(e.target.value)}>
              {['NET 15','NET 30','NET 45','Due on receipt'].map((c) => <option key={c}>{c}</option>)}
            </SelectInput>
          </div>
          <TextInput label="Late payment fee policy" value={lateFee} onChange={(e) => setLateFee(e.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Award className="h-5 w-5 text-forum-600" /> CRO Funding Awards Budget</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Total awards budget (USD)" type="number" value={awardBudget} onChange={(e) => setAwardBudget(e.target.value)} icon={<Wallet className="h-4 w-4 text-ink-subtle" />} />
            <TextInput label="Fiscal year" value={awardFiscal} onChange={(e) => setAwardFiscal(e.target.value)} icon={<CalendarIcon className="h-4 w-4 text-ink-subtle" />} />
          </div>
          <div className="rounded-lg border border-forum-600/20 bg-forum-50/50 p-4 grid sm:grid-cols-3 gap-4 text-center">
            <div><p className="font-display text-2xl font-bold text-forum-900">${(Number(awardBudget) / 2).toLocaleString()}</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Committed</p></div>
            <div><p className="font-display text-2xl font-bold text-success-600">${(Number(awardBudget) * 0.35).toLocaleString()}</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Disbursed</p></div>
            <div><p className="font-display text-2xl font-bold text-brass-700">${(Number(awardBudget) * 0.3).toLocaleString()}</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Remaining</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupSettings() {
  const [dailyBackup, setDailyBackup] = useState(true);
  const [weeklyFull, setWeeklyFull] = useState(true);
  const [backupTime, setBackupTime] = useState('03:00 UTC');
  const [retentionOnline, setRetentionOnline] = useState('90');
  const [retentionCold, setRetentionCold] = useState('2555');
  const [encKeyRotation, setEncKeyRotation] = useState('365');
  const [offsiteRegion, setOffsiteRegion] = useState('Dual-region · EU West + Canada Central');
  const [drillSchedule, setDrillSchedule] = useState('Quarterly');
  const [exportAuditFormat, setExportAuditFormat] = useState('JSON + signed PDF bundle');

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Cloud className="h-5 w-5 text-slateteal-500" /> Backup Schedule &amp; Retention</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox id="bk1" name="bk1" label="Daily incremental snapshot" checked={dailyBackup} onChange={(e) => setDailyBackup((e.target as HTMLInputElement).checked)} />
            <Checkbox id="bk2" name="bk2" label="Weekly full snapshot (Sunday night)" checked={weeklyFull} onChange={(e) => setWeeklyFull((e.target as HTMLInputElement).checked)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Daily backup window start" value={backupTime} onChange={(e) => setBackupTime(e.target.value)} />
            <SelectInput label="DR / restore testing" value={drillSchedule} onChange={(e) => setDrillSchedule(e.target.value)}>
              {['Monthly','Quarterly','Semi-annually','Annually'].map((d) => <option key={d}>{d}</option>)}
            </SelectInput>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Online retention (days)" type="number" value={retentionOnline} onChange={(e) => setRetentionOnline(e.target.value)} />
            <TextInput label="Cold storage retention (days)" type="number" value={retentionCold} onChange={(e) => setRetentionCold(e.target.value)} />
            <TextInput label="Encryption key rotation (days)" type="number" value={encKeyRotation} onChange={(e) => setEncKeyRotation(e.target.value)} />
          </div>
          <SelectInput label="Offsite / DR replica region" value={offsiteRegion} onChange={(e) => setOffsiteRegion(e.target.value)}>
            {['Dual-region · EU West + Canada Central','Single region · EU West','Triple-region · EU + US East + APSE2'].map((v) => <option key={v}>{v}</option>)}
          </SelectInput>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2"><Database className="h-5 w-5 text-forum-600" /> Audit Log Export &amp; Integrity</h3></CardHeader>
        <CardContent className="pt-0 space-y-4">
          <SelectInput label="Default export format" value={exportAuditFormat} onChange={(e) => setExportAuditFormat(e.target.value)}>
            {['CSV only','JSON + signed PDF bundle','JSON + CSV + PDF (signed + hashed)'].map((v) => <option key={v}>{v}</option>)}
          </SelectInput>
          <div className="rounded-xl border border-forum-600/20 bg-gradient-to-br from-forum-50 to-brass-50/50 p-4 grid sm:grid-cols-3 gap-4 text-center">
            <div><p className="font-display text-2xl font-bold text-forum-900">1.4 M</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Audit entries</p></div>
            <div><p className="font-display text-2xl font-bold text-brass-700">98.6 GB</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Online store (encrypted)</p></div>
            <div><p className="font-display text-2xl font-bold text-success-600">100%</p><p className="text-[11px] uppercase tracking-wider text-ink-subtle">Hash chain valid</p></div>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button variant="outline" size="sm"><Database className="h-3.5 w-3.5" /> Run integrity check</Button>
            <Button variant="outline" size="sm"><FileText className="h-3.5 w-3.5" /> Export audit (all time)</Button>
            <Button variant="primary" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Trigger on-demand backup</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ================== SHARED UI ================== */

function ReadonlyTable({ rows }: { rows: ConfigRow[] }) {
  return (
    <div className="rounded-xl border border-paper-border divide-y divide-paper-border">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 p-3.5 hover:bg-forum-50/30">
          <div className="col-span-12 sm:col-span-5">
            <p className="text-sm font-medium text-forum-900">{r.name}</p>
            {r.description && <p className="text-xs text-ink-subtle mt-0.5">{r.description}</p>}
          </div>
          <div className="col-span-12 sm:col-span-7 flex sm:justify-end">
            {r.current ? (
              <code className="text-[11px] font-mono rounded bg-forum-50 text-forum-700 px-2 py-1 border border-forum-100">{r.current}</code>
            ) : (
              <Badge variant="default">Configured</Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
