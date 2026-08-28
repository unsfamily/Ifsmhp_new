import {
  ShieldCheck,
  HeartHandshake,
  DollarSign,
  Plus,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  Filter,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  Send,
  Building2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useState, type FormEvent } from 'react';
import { SelectInput, TextArea, TextInput, Checkbox } from '../../components/common/Input';
import { memberApi } from '../../api/member';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';

type Status = 'All' | 'Open' | 'In Review' | 'Approved' | 'Closed';

interface Request {
  id: string;
  project: string;
  type: ('Moral' | 'Official' | 'Funding')[];
  subject?: string;
  submitted: string | Date;
  lastUpdate: string | Date;
  status: Exclude<Status, 'All'>;
  priority: 'Standard' | 'High' | 'Urgent';
  messages: number;
}

const statusConfig = {
  Open: { variant: 'info' as const, icon: Clock },
  'In Review': { variant: 'warning' as const, icon: AlertCircle },
  Approved: { variant: 'success' as const, icon: CheckCircle2 },
  Closed: { variant: 'default' as const, icon: ShieldCheck },
};

const priorityConfig = {
  Standard: 'default' as const,
  High: 'warning' as const,
  Urgent: 'danger' as const,
};

const typeIcon = { Moral: HeartHandshake, Official: Building2, Funding: DollarSign };

export default function SupportRequestsPage() {
  const [showForm, setShowForm] = useState(false);
  const [status, setStatus] = useState<Status>('All');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { data, loading, error } = useApiData<{ items: Request[] }>(
    () => memberApi.support({ status, q: search }) as Promise<{ items: Request[] }>,
    [status, search],
  );
  const requests = data?.items ?? [];

  const filtered = requests.filter((r) => {
    if (search && !r.project.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalOpen = requests.filter((r) => ['Open', 'In Review'].includes(r.status)).length;
  const submitSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const types = form.getAll('types').map(String);
    setErrorMsg(null);
    try {
      await memberApi.createSupport({
        projectId: String(form.get('projectId') ?? '') || undefined,
        subject: String(form.get('subject') ?? ''),
        description: String(form.get('description') ?? ''),
        priority: String(form.get('priority') ?? 'Standard'),
        requiredBy: String(form.get('requiredBy') ?? '') || undefined,
        types,
      });
      setShowForm(false);
    } catch (err) {
      setErrorMsg(normalizeError(err).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Active Requests', value: totalOpen.toString(), icon: ShieldCheck, color: 'forum' },
          { label: 'Approved', value: requests.filter((r) => r.status === 'Approved').length.toString(), icon: CheckCircle2, color: 'slateteal' },
          { label: 'Funding Requests', value: requests.filter((r) => r.type.includes('Funding')).length.toString(), icon: DollarSign, color: 'brass' },
          { label: 'Avg. Response', value: '2.4 days', icon: Clock, color: 'forum' },
        ].map((s) => {
          const Icon = s.icon;
          const bg = {
            forum: 'bg-forum-50 text-forum-700',
            slateteal: 'bg-slateteal-100 text-slateteal-700',
            brass: 'bg-brass-100 text-brass-700',
          }[s.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={s.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}>
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-forum-900">{s.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showForm ? (
        <Card className="border-forum-300 ring-1 ring-forum-100">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-forum-600" />
                  New Support Request
                </h3>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Select the support types you need for your project
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-ink-subtle hover:text-ink-muted transition-colors"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <form className="space-y-5" onSubmit={submitSupport}>
              {errorMsg && <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">{errorMsg}</div>}
              <SelectInput label="Select Project" name="projectId" defaultValue="">
                <option value="" disabled>Choose a project...</option>
                <option value="biomarker">Biomarker Panels for MDD Subtyping</option>
                <option value="eeg">Wearable EEG Validation Study</option>
                <option value="youth">Youth Telehealth Utilization 5-Nation Study</option>
                <option value="burnout">Clinician Burnout Predictors Cohort</option>
                <option value="new">Not linked to a specific project</option>
              </SelectInput>

              <div>
                <label className="mb-2 block text-sm font-medium text-ink">
                  Type of Support Requested <span className="text-danger-600">*</span>
                  <span className="ml-1 text-[11px] font-normal text-ink-subtle">(select all that apply)</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { key: 'moral', icon: HeartHandshake, title: 'Moral Support', desc: 'Peer mentorship, encouragement, community feedback' },
                    { key: 'official', icon: Building2, title: 'Official Support', desc: 'Endorsement letters, institutional backing, certification' },
                    { key: 'funding', icon: DollarSign, title: 'Funding Support', desc: 'Grant access, budget review, funder connections' },
                  ].map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <label key={opt.key} className="relative rounded-xl border border-paper-border p-4 cursor-pointer hover:border-forum-300 transition-all peer">
                        <input type="checkbox" className="sr-only peer" name="types" value={opt.title} />
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700 peer-checked:bg-forum-600 peer-checked:text-white transition-colors">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-forum-900">{opt.title}</p>
                            <p className="mt-0.5 text-[11px] text-ink-muted leading-snug">{opt.desc}</p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <TextInput name="subject" label="Request Title / Subject" placeholder="e.g. Request for endorsement letter for NIH R01 submission" required />
              <TextArea name="description" label="Detailed Request Description" rows={5} placeholder="Explain the context, timeline, deliverables needed, and how this support will impact your work..." required hint="The more detail you provide, the faster we can assign the right team." />

              <div className="grid gap-5 sm:grid-cols-2">
                <SelectInput label="Priority" name="priority" defaultValue="Standard">
                  <option value="Standard">Standard (3-5 business days)</option>
                  <option value="High">High (1-2 business days)</option>
                  <option value="Urgent">Urgent (24-hour response — requires justification)</option>
                </SelectInput>
                <TextInput name="requiredBy" label="Required By Date (optional)" type="date" />
              </div>

              <Checkbox label="I confirm this request is accurate and I have provided all necessary context." required />

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="lg" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg">
                  <Send className="h-4.5 w-4.5" />
                  Submit Request
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="relative flex-1 sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Search by project or request ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-paper-border bg-paper pl-9 pr-3 py-2.5 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <SelectInput
                label={<span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Status</span>}
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
                className="sm:mb-0"
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Review">In Review</option>
                <option value="Approved">Approved</option>
                <option value="Closed">Closed</option>
              </SelectInput>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {loading ? <p className="text-sm text-ink-muted">Loading support requests...</p> : null}
        {error ? <p className="text-sm text-danger-600">{error}</p> : null}
        {filtered.map((r) => {
          const sc = statusConfig[r.status];
          const SIcon = sc.icon;
          return (
            <Card key={r.id}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={sc.variant}>
                        <SIcon className="h-2.5 w-2.5 mr-1" />
                        {r.status}
                      </Badge>
                      <Badge variant={priorityConfig[r.priority]}>{r.priority} Priority</Badge>
                      {r.type.map((t) => {
                        const TIcon = typeIcon[t];
                        return (
                          <span key={t} className="inline-flex items-center gap-1 rounded-full border border-paper-border bg-paper px-2.5 py-0.5 text-[11px] font-medium text-ink-muted">
                            <TIcon className="h-3 w-3" />
                            {t}
                          </span>
                        );
                      })}
                    </div>
                    <h3 className="mt-3 font-semibold text-forum-900 leading-snug">
                      {r.project}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Submitted</p>
                    <p className="mt-0.5 text-ink-muted font-medium">{new Date(r.submitted).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Last Update</p>
                    <p className="mt-0.5 text-ink-muted font-medium">{new Date(r.lastUpdate).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Ticket ID</p>
                        <p className="mt-0.5 text-ink-muted font-mono font-medium">{r.id.toUpperCase()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-ink-subtle">Messages</p>
                        <p className="mt-0.5 text-ink-muted font-medium inline-flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" />
                          {r.messages}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
                    <Button size="sm" className="w-full sm:w-auto">
                      <FileText className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">
                      <MessageSquare className="h-4 w-4" />
                      Message CRO
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-ink-subtle" />
              <h3 className="mt-4 font-semibold text-forum-900">No matching requests</h3>
              <p className="mt-1 text-ink-muted text-sm">
                {requests.length === 0 ? 'Create your first support request above.' : 'Try adjusting filters or start a new request.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
