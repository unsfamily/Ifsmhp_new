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
import { useNavigate } from 'react-router-dom';
import { SelectInput, TextArea, TextInput, Checkbox } from '../../components/common/Input';
import { memberApi } from '../../api/member';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { supportApi, supportDays, type NewSupport } from '../../api/support';
import { useSupportList } from '../../hooks/useSupportList';
import { useAuth } from '../../context/AuthContext';
import SupportPagination from '../../components/support/SupportPagination';

type Status = 'All' | 'Open' | 'In Review' | 'Approved' | 'Closed' | 'Rejected';


const statusConfig = {
  Open: { variant: 'info' as const, icon: Clock },
  'In Review': { variant: 'warning' as const, icon: AlertCircle },
  Approved: { variant: 'success' as const, icon: CheckCircle2 },
  Closed: { variant: 'default' as const, icon: ShieldCheck },
  Rejected: { variant: 'danger' as const, icon: AlertCircle },
  Pending: { variant: 'info' as const, icon: Clock },
  'Under Review': { variant: 'warning' as const, icon: AlertCircle },
  Completed: { variant: 'default' as const, icon: ShieldCheck },
};

const priorityConfig = {
  Standard: 'default' as const,
  High: 'warning' as const,
  Urgent: 'danger' as const,
  Low: 'info' as const,
};

const typeIcon = { Moral: HeartHandshake, Official: Building2, Funding: DollarSign };

export default function SupportRequestsPage() {
  const { user } = useAuth();
  return user ? <MemberSupportList key={user.id} /> : null;
}

function MemberSupportList() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const { data, loading, error, refresh, params, filter } = useSupportList(false);
  const status = (params.get('status') ?? 'All') as Status;
  const search = params.get('q') ?? '';
  const setStatus = (value: Status) => filter('status', value);
  const setSearch = (value: string) => filter('q', value);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const projects = useApiData(async () => {
    const items: Array<{ id: string; title: string }> = [];
    let page = 1;
    let pages = 1;
    do {
      const next = await memberApi.projects({ page, limit: 100 });
      items.push(...next.items);
      pages = next.pagination.pages;
      page += 1;
    } while (page <= pages);
    return items;
  }, [showForm]);
  const requests = data?.items ?? [];
  const filtered = requests;
  const submitSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const types = form.getAll('types').map(String);
    setErrorMsg(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await supportApi.create({
        projectId: String(form.get('projectId') ?? '') || null,
        subject: String(form.get('subject') ?? ''),
        description: String(form.get('description') ?? ''),
        priority: String(form.get('priority') ?? 'Standard') as NewSupport['priority'],
        requiredBy: String(form.get('requiredBy') ?? '') || null,
        types,
      });
      setShowForm(false);
      setSuccess('Support request submitted successfully.');
      filter('page', '1');
      refresh();
    } catch (err) {
      const failure = normalizeError(err);
      setErrorMsg(failure.message);
      setFieldErrors(failure.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" style={{ overflowWrap: 'anywhere' }}>
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Active Requests', value: data?.stats.open.toString() ?? '...', icon: ShieldCheck, color: 'forum' },
          { label: 'Approved', value: data?.stats.approved.toString() ?? '...', icon: CheckCircle2, color: 'slateteal' },
          { label: 'Funding Requests', value: data?.stats.funding.toString() ?? '...', icon: DollarSign, color: 'brass' },
          { label: 'Avg. Response', value: data ? supportDays(data.stats.avgResponseDays) : '...', icon: Clock, color: 'forum' },
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
                onClick={() => setShowForm(false)} disabled={submitting}
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
              <SelectInput label="Select Project" name="projectId" defaultValue="" disabled={projects.loading || submitting} error={fieldErrors.projectId || projects.error || undefined}>
                <option value="">Not linked to a specific project</option>
                {(projects.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
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
                    // `has-[:checked]`, not `peer-checked`: the input is a descendant, not a sibling.
                    return (
                      <label key={opt.key} className="group relative rounded-xl border border-paper-border p-4 cursor-pointer hover:border-forum-300 transition-all has-[:checked]:border-forum-600 has-[:checked]:ring-2 has-[:checked]:ring-forum-600/20 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-forum-600">
                        <input type="checkbox" disabled={submitting} className="sr-only" name="types" value={opt.title} />
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700 group-has-[:checked]:bg-forum-600 group-has-[:checked]:text-white transition-colors">
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

              {fieldErrors.types && <p role="alert" className="text-sm text-danger-600">{fieldErrors.types}</p>}
              <TextInput name="subject" label="Request Title / Subject" placeholder="e.g. Request for endorsement letter for NIH R01 submission" required minLength={4} maxLength={220} error={fieldErrors.subject} disabled={submitting} />
              <TextArea name="description" label="Detailed Request Description" rows={5} placeholder="Explain the context, timeline, deliverables needed, and how this support will impact your work..." required minLength={10} maxLength={10000} error={fieldErrors.description} disabled={submitting} hint="The more detail you provide, the faster we can assign the right team." />

              <div className="grid gap-5 sm:grid-cols-2">
                <SelectInput label="Priority" name="priority" defaultValue="Standard" disabled={submitting} error={fieldErrors.priority}>
                  <option value="Standard">Standard (3-5 business days)</option>
                  <option value="High">High (1-2 business days)</option>
                  <option value="Urgent">Urgent (24-hour response — requires justification)</option>
                </SelectInput>
                <TextInput disabled={submitting} name="requiredBy" label="Required By Date (optional)" type="date" error={fieldErrors.requiredBy} />
              </div>

              <Checkbox label="I confirm this request is accurate and I have provided all necessary context." required />

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <Button type="button" variant="outline" size="lg" disabled={submitting} onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="lg" disabled={submitting || projects.loading}>
                  <Send className="h-4.5 w-4.5" />
                  {submitting ? 'Submitting...' : 'Submit Request'}
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
                aria-label="Search support requests" placeholder="Search by project, subject or request ID..."
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
                <option value="Rejected">Rejected</option>
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
        {success && <p role="status" className="text-sm text-success-600">{success}</p>}
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
                      {r.subject}
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
                    <Button size="sm" className="w-full sm:w-auto" as="link" to={`/dashboard/support/${r.id}?${params}`}>
                      <FileText className="h-4 w-4" />
                      View Details
                    </Button>
                    <Button size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => navigate(`/dashboard/support/${r.id}?${params}#reply`)}>
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

        {!loading && !error && filtered.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-ink-subtle" />
              <h3 className="mt-4 font-semibold text-forum-900">{data?.stats.total === 0 ? 'No support requests yet' : 'No matching requests'}</h3>
              <p className="mt-1 text-ink-muted text-sm">
                {data?.stats.total === 0 ? 'Create your first support request above.' : 'Try adjusting filters or start a new request.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
      <SupportPagination page={data?.pagination.page ?? 1} pages={data?.pagination.pages ?? 1} total={data?.pagination.total} onPage={(page) => filter('page', String(page))} error={error} onRetry={refresh} />
    </div>
  );
}
