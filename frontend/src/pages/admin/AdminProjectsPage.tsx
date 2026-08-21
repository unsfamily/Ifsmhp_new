import { useEffect, useMemo, useState } from 'react';
import {
  FolderKanban,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertCircle,
  Sparkles,
  CalendarDays,
  Flag,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  AlertTriangle,
  MoreHorizontal,
  RotateCcw,
  ShieldCheck,
  Mail,
  Download,
  History,
  X,
  Loader2,
  RefreshCw,
  ArchiveRestore,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type ProjectStatus =
  | 'Draft'
  | 'Submitted'
  | 'Under Review'
  | 'Approved'
  | 'Rejected'
  | 'Published'
  | 'Archived';

type Priority = 'Urgent' | 'High' | 'Standard' | 'Low';

type ProjectCategory =
  | 'Clinical Research'
  | 'Clinical Trials'
  | 'Health Services'
  | 'Psychometrics'
  | 'Biological Psychiatry'
  | 'Epidemiology'
  | 'Public Mental Health'
  | 'Qualitative Research'
  | 'Digital Mental Health';

interface ProjectRecord {
  id: string;
  title: string;
  excerpt: string;
  member: string;
  memberId: string;
  category: ProjectCategory;
  status: ProjectStatus;
  priority: Priority;
  submittedAt: string;
  queueDays: number;
  views: number;
  supportRequested: string[];
}

const STATUSES: ProjectStatus[] = [
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Published',
  'Archived',
];

const CATEGORIES: ProjectCategory[] = [
  'Clinical Research',
  'Clinical Trials',
  'Health Services',
  'Psychometrics',
  'Biological Psychiatry',
  'Epidemiology',
  'Public Mental Health',
  'Qualitative Research',
  'Digital Mental Health',
];

const PRIORITIES: Priority[] = ['Urgent', 'High', 'Standard', 'Low'];

const MEMBERS_FOR_FILTER = [
  { value: 'All', label: 'All Members' },
  { value: 'Dr. Anika Kapoor', label: 'Dr. Anika Kapoor' },
  { value: 'Dr. Nora Hargrove', label: 'Dr. Nora Hargrove' },
  { value: 'Dr. Maya Fernández', label: 'Dr. Maya Fernández' },
  { value: 'Prof. Henrik Lindberg', label: 'Prof. Henrik Lindberg' },
  { value: 'Dr. Siti Wijaya', label: 'Dr. Siti Wijaya' },
  { value: 'Prof. Eleanor Whitfield', label: 'Prof. Eleanor Whitfield' },
  { value: 'Dr. Sarah Chen', label: 'Dr. Sarah Chen' },
  { value: 'Dr. Theo Mbeki', label: 'Dr. Theo Mbeki' },
];

const PROJECTS: ProjectRecord[] = [
  { id: 'pa1', title: 'AI-driven suicide risk assessment in emergency departments', excerpt: 'A prospective validation study of transformer-based NLP models triaging high-risk patients from nursing intake notes across 12 sites. Target n = 4,200.', member: 'Dr. Nora Hargrove', memberId: 'IFSMHP-2024-000188', category: 'Digital Mental Health', status: 'Submitted', priority: 'High', submittedAt: '2026-08-15', queueDays: 6, views: 34, supportRequested: ['Funding'] },
  { id: 'pa2', title: 'Postpartum depression screening protocol for low-resource settings', excerpt: 'Adaptation and reliability testing of a 4-item verbal screen delivered by community health workers in 6 LMIC maternity clinics.', member: 'Dr. Maya Fernández', memberId: 'IFSMHP-2024-000201', category: 'Health Services', status: 'Under Review', priority: 'Standard', submittedAt: '2026-08-16', queueDays: 5, views: 88, supportRequested: ['Official'] },
  { id: 'pa3', title: 'Sleep intervention RCT in refugee populations', excerpt: 'Parallel-arm assessor-blinded RCT of culturally adapted BSI delivered by community health workers in 3 refugee reception centers. Primary: PSQI at 8 weeks.', member: 'Prof. Henrik Lindberg', memberId: 'IFSMHP-2024-000092', category: 'Clinical Trials', status: 'Submitted', priority: 'Urgent', submittedAt: '2026-08-18', queueDays: 3, views: 27, supportRequested: ['Moral', 'Funding'] },
  { id: 'pa4', title: 'Validation of Bahasa depression screening tool (IN-PHQ-9)', excerpt: 'Confirmatory factor analysis and ROC validation of Bahasa Indonesia PHQ-9 against clinician ratings (MINI) across primary care (n = 880).', member: 'Dr. Siti Wijaya', memberId: 'IFSMHP-2024-000156', category: 'Psychometrics', status: 'Under Review', priority: 'Standard', submittedAt: '2026-08-14', queueDays: 7, views: 41, supportRequested: ['Official'] },
  { id: 'pa5', title: 'Psilocybin therapy protocol for palliative care anxiety', excerpt: 'Single-arm open-label safety study of 25mg psilocybin-assisted therapy with existential distress in advanced cancer patients (n = 24).', member: 'Prof. Eleanor Whitfield', memberId: 'IFSMHP-2024-000045', category: 'Clinical Trials', status: 'Submitted', priority: 'High', submittedAt: '2026-08-12', queueDays: 9, views: 112, supportRequested: ['Official', 'Funding'] },
  { id: 'pa6', title: 'CBT outcomes in digital mental health platforms', excerpt: 'Propensity-score matched cohort study comparing guided iCBT (n = 3,200) against waitlist in a national public-access platform.', member: 'Dr. Sarah Chen', memberId: 'IFSMHP-2024-000142', category: 'Clinical Research', status: 'Published', priority: 'Standard', submittedAt: '2026-03-15', queueDays: 0, views: 1247, supportRequested: ['Official'] },
  { id: 'pa7', title: 'Biomarker panels for MDD subtyping', excerpt: 'Multi-omic clustering (cytokine panel + metabolomics + fMRI) to derive reproducible MDD subtypes in two clinical cohorts (n = 520).', member: 'Dr. Sarah Chen', memberId: 'IFSMHP-2024-000142', category: 'Biological Psychiatry', status: 'Approved', priority: 'High', submittedAt: '2026-07-08', queueDays: 0, views: 412, supportRequested: ['Funding', 'Official'] },
  { id: 'pa8', title: 'Adolescent PTSD — school-based screening cascade', excerpt: 'Implementation science evaluation of teacher-led PCL-5 screening with warm handoff to mental health clinics across 28 rural schools.', member: 'Dr. Anika Kapoor', memberId: 'IFSMHP-2025-000312', category: 'Public Mental Health', status: 'Submitted', priority: 'Standard', submittedAt: '2026-08-10', queueDays: 11, views: 73, supportRequested: ['Funding'] },
  { id: 'pa9', title: 'Lived-experience co-production in peer-support design', excerpt: 'Community-based participatory research (CBPR) with 16 peer specialists co-designing a standardized onboarding curriculum.', member: 'Dr. Theo Mbeki', memberId: 'IFSMHP-2025-000220', category: 'Qualitative Research', status: 'Under Review', priority: 'Low', submittedAt: '2026-08-08', queueDays: 13, views: 55, supportRequested: ['Moral'] },
  { id: 'pa10', title: 'Metacognitive training for schizophrenia — rural outreach', excerpt: 'Hybrid in-person/mHealth MCT+ program delivered by trained CHWs, feasibility pilot with 6-month follow-up (n = 60).', member: 'Dr. Ana Pereira', memberId: 'IFSMHP-2024-000245', category: 'Health Services', status: 'Draft', priority: 'Standard', submittedAt: '2026-08-20', queueDays: 0, views: 6, supportRequested: [] },
  { id: 'pa11', title: 'National prevalence of adolescent social-media linked harm', excerpt: 'Secondary analysis of 3 nationally representative household surveys (2018–2024) investigating internet-use and self-harm correlations (n ≈ 24k).', member: 'Dr. Carlos Mendez', memberId: 'IFSMHP-2025-000034', category: 'Epidemiology', status: 'Rejected', priority: 'Standard', submittedAt: '2026-07-22', queueDays: 0, views: 220, supportRequested: ['Official'] },
  { id: 'pa12', title: 'Group IPT for post-partum depression — cluster RCT', excerpt: 'Clustered RCT of 8-session group IPT vs. enhanced usual care in 48 primary care units. Primary: EPDS at 3 months post-natal.', member: 'Dr. Fatima Al-Sayed', memberId: 'IFSMHP-2025-000071', category: 'Clinical Trials', status: 'Approved', priority: 'High', submittedAt: '2026-06-30', queueDays: 0, views: 589, supportRequested: ['Funding'] },
  { id: 'pa13', title: 'Mobile mindfulness for urban healthcare workers', excerpt: 'Pragmatic RCT of 8-week app-based MBSR-light program in emergency department staff, primary outcome: PFI burnout score.', member: 'Dr. Michael Brown', memberId: 'IFSMHP-2025-000063', category: 'Digital Mental Health', status: 'Submitted', priority: 'High', submittedAt: '2026-08-05', queueDays: 16, views: 142, supportRequested: ['Moral'] },
  { id: 'pa14', title: 'Cultural adaptation of DBT for Indigenous communities', excerpt: 'Formative qualitative + adaptation phases (EMM) of DBT with community elders in 2 Indigenous nations. Mixed-methods (n = 48).', member: 'Prof. Nomsa Dlamini', memberId: 'IFSMHP-2025-000094', category: 'Qualitative Research', status: 'Under Review', priority: 'Urgent', submittedAt: '2026-08-11', queueDays: 10, views: 96, supportRequested: ['Official', 'Funding'] },
  { id: 'pa15', title: 'Climate-anxiety intervention in young adults', excerpt: 'Acceptance & commitment therapy (ACT) group intervention for eco-anxiety — feasibility/acceptability pilot (n = 36).', member: 'Dr. Elena Vasquez', memberId: 'IFSMHP-2025-000107', category: 'Public Mental Health', status: 'Draft', priority: 'Low', submittedAt: '2026-08-19', queueDays: 0, views: 9, supportRequested: [] },
  { id: 'pa16', title: 'Genome-wide polygenic risk for antidepressant response', excerpt: 'PGS-SCREEN-D responder prediction meta-analysis across 3 RCT datasets (n = 3,112) with external validation.', member: 'Prof. Lars Svensson', memberId: 'IFSMHP-2025-000059', category: 'Biological Psychiatry', status: 'Published', priority: 'High', submittedAt: '2026-02-04', queueDays: 0, views: 3810, supportRequested: ['Funding'] },
  { id: 'pa17', title: 'Bereavement support — peer navigator model', excerpt: 'Pre/post evaluation of peer-navigator led grief support groups in conflict-affected regions (n = 180, 4 sites).', member: 'Dr. John Okafor', memberId: 'IFSMHP-2024-000198', category: 'Public Mental Health', status: 'Archived', priority: 'Standard', submittedAt: '2025-11-14', queueDays: 0, views: 318, supportRequested: ['Moral'] },
  { id: 'pa18', title: 'Ketamine-assisted psychotherapy protocol review', excerpt: 'Safety/efficacy rapid review + meta-synthesis of 17 ketamine/psychedelic trials for TRD.', member: 'Dr. Lucia Rossi', memberId: 'IFSMHP-2025-000012', category: 'Clinical Research', status: 'Under Review', priority: 'Urgent', submittedAt: '2026-08-17', queueDays: 4, views: 208, supportRequested: ['Funding', 'Official'] },
  { id: 'pa19', title: 'Burnout rates in low-income mental health staff', excerpt: 'MASLACH MBI cross-sectional survey + qualitative focus groups across 36 public clinics.', member: 'Dr. Priya Sharma', memberId: 'IFSMHP-2025-000047', category: 'Epidemiology', status: 'Submitted', priority: 'Standard', submittedAt: '2026-08-07', queueDays: 14, views: 61, supportRequested: ['Official'] },
  { id: 'pa20', title: 'Eating disorders screening in refugee adolescents', excerpt: 'SCOFF cross-cultural validation plus prevalence survey in unaccompanied minors (n = 240).', member: 'Dr. Gabriel Adeyemi', memberId: 'IFSMHP-2025-000082', category: 'Psychometrics', status: 'Submitted', priority: 'High', submittedAt: '2026-08-13', queueDays: 8, views: 48, supportRequested: ['Funding'] },
];

const statusConfig: Record<ProjectStatus, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: Clock },
  Submitted: { variant: 'info', icon: FileText },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Published: { variant: 'brass', icon: CheckCircle2 },
  Rejected: { variant: 'danger', icon: XCircle },
  Archived: { variant: 'default', icon: History },
};

const priorityConfig: Record<Priority, { variant: 'danger' | 'warning' | 'info' | 'default'; icon: typeof Flag }> = {
  Urgent: { variant: 'danger', icon: AlertTriangle },
  High: { variant: 'warning', icon: Flag },
  Standard: { variant: 'info', icon: Flag },
  Low: { variant: 'default', icon: Flag },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];
type DataState = 'idle' | 'loading' | 'success' | 'error';

function formatDate(iso: string) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch {
    return iso;
  }
}

export default function AdminProjectsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ProjectCategory>('All');
  const [memberFilter, setMemberFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | Priority>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [dataState, setDataState] = useState<DataState>('success');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState(false);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  useEffect(() => {
    if (simLoading) {
      setDataState('loading');
      const t = setTimeout(() => { setDataState('success'); setSimLoading(false); }, 1200);
      return () => clearTimeout(t);
    }
  }, [simLoading]);

  useEffect(() => {
    if (simError) {
      setDataState('error');
      const t = setTimeout(() => { setDataState('success'); setSimError(false); }, 5000);
      return () => clearTimeout(t);
    }
  }, [simError]);

  const filtered = useMemo(() => PROJECTS.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      const hit = p.title.toLowerCase().includes(s) || p.excerpt.toLowerCase().includes(s) || p.member.toLowerCase().includes(s) || p.category.toLowerCase().includes(s);
      if (!hit) return false;
    }
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && p.category !== categoryFilter) return false;
    if (memberFilter !== 'All' && p.member !== memberFilter) return false;
    if (priorityFilter !== 'All' && p.priority !== priorityFilter) return false;
    if (dateFrom && p.submittedAt < dateFrom) return false;
    if (dateTo && p.submittedAt > dateTo) return false;
    return true;
  }), [search, statusFilter, categoryFilter, memberFilter, priorityFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, memberFilter, priorityFilter, dateFrom, dateTo, pageSize]);

  const safePageSize = pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * safePageSize;
  const pageItems = filtered.slice(startIdx, startIdx + safePageSize);

  const hasActiveFilters = search !== '' || statusFilter !== 'All' || categoryFilter !== 'All' || memberFilter !== 'All' || priorityFilter !== 'All' || dateFrom !== '' || dateTo !== '';

  const counts = useMemo(() => ({
    queue: PROJECTS.filter((p) => ['Submitted', 'Under Review'].includes(p.status)).length,
    sla: PROJECTS.filter((p) => ['Submitted', 'Under Review'].includes(p.status) && p.queueDays >= 7).length,
    approved: PROJECTS.filter((p) => p.status === 'Approved').length,
    published: PROJECTS.filter((p) => p.status === 'Published').length,
    urgent: PROJECTS.filter((p) => ['Submitted', 'Under Review'].includes(p.status) && p.priority === 'Urgent').length,
    total: PROJECTS.length,
  }), []);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setCategoryFilter('All');
    setMemberFilter('All');
    setPriorityFilter('All');
    setDateFrom('');
    setDateTo('');
  };

  const availableRowActions = (s: ProjectStatus) => ({
    view: true,
    startReview: s === 'Submitted',
    approve: s === 'Submitted' || s === 'Under Review',
    reject: s === 'Submitted' || s === 'Under Review',
    publish: s === 'Approved',
    archive: s === 'Published' || s === 'Rejected' || s === 'Approved',
    restore: s === 'Archived' || s === 'Draft',
  });

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />{DEMO_LABEL}</Badge>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">Research Projects</h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">Project management and review queue — triage submissions, set priority, and decide which projects advance to publication.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setSimError(true)}><AlertCircle className="h-3.5 w-3.5" />Test Error</Button>
          <Button variant="outline" size="sm" onClick={() => setSimLoading(true)}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={() => setSimLoading(true)}><Download className="h-3.5 w-3.5" />Export</Button>
        </div>
      </div>

      {/* ===== KPI STRIP ===== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Total Projects', value: counts.total.toString(), icon: FolderKanban, color: 'forum' },
          { label: 'In Review Queue', value: counts.queue.toString(), icon: Eye, color: 'slateteal' },
          { label: 'SLA Breach (≥7d)', value: counts.sla.toString(), icon: AlertTriangle, color: 'danger' as const, warn: true },
          { label: 'Urgent Priority', value: counts.urgent.toString(), icon: Flag, color: 'brass' },
          { label: 'Approved', value: counts.approved.toString(), icon: CheckCircle2, color: 'success' as const },
          { label: 'Published', value: counts.published.toString(), icon: FileText, color: 'forum' },
        ].map((k) => {
          const Icon = k.icon;
          const bgMap: Record<string, string> = {
            forum: 'bg-forum-50 text-forum-700',
            slateteal: 'bg-slateteal-100 text-slateteal-700',
            brass: 'bg-brass-100 text-brass-700',
            success: 'bg-success-100 text-success-600',
            danger: 'bg-danger-100 text-danger-600',
          };
          return (
            <Card key={k.label} className={k.warn ? 'border-warning-600/30 ring-2 ring-warning-100' : ''}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bgMap[k.color as keyof typeof bgMap]}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                  {k.warn && <Badge variant="warning">Action</Badge>}
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ===== FILTERS CARD ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput placeholder="Search project title, member, description…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={filtersOpen ? 'primary' : 'outline'} size="sm" onClick={() => setFiltersOpen((v) => !v)}>
              <Filter className="h-3.5 w-3.5" />
              {filtersOpen ? 'Hide Filters' : 'More Filters'}
            </Button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900">
                <X className="h-3 w-3" />Clear all
              </button>
            )}
          </div>
        </CardHeader>
        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <SelectInput label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ProjectStatus | 'All')}>
                <option value="All">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </SelectInput>
              <SelectInput label="Category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ProjectCategory | 'All')}>
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </SelectInput>
              <SelectInput label="Member" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)}>
                {MEMBERS_FOR_FILTER.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </SelectInput>
              <SelectInput label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | 'All')}>
                <option value="All">All Priorities</option>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </SelectInput>
              <TextInput label="Submitted From" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <TextInput label="Submitted To" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </CardContent>
          </div>
        )}
      </Card>

      {/* ===== PROJECTS TABLE ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-forum-600" />
              Project Review Queue
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{pageItems.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{filtered.length}</span> projects
              {hasActiveFilters && <> · <span className="text-brass-700 font-medium">filters applied</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows</label>
            <SelectInput value={safePageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {dataState === 'loading' ? (
            <LoadingState />
          ) : dataState === 'error' ? (
            <ErrorState onRetry={() => { setSimError(false); setDataState('success'); }} />
          ) : pageItems.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle min-w-[280px]">Project</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell min-w-[180px]">Member</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Category</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Submitted</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Priority</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((p) => {
                      const sConf = statusConfig[p.status];
                      const SIcon = sConf.icon;
                      const pConf = priorityConfig[p.priority];
                      const PIcon = pConf.icon;
                      const act = availableRowActions(p.status);
                      const isMenuOpen = menuOpenFor === p.id;
                      const slaWarn = ['Submitted', 'Under Review'].includes(p.status) && p.queueDays >= 5;
                      const slaDanger = ['Submitted', 'Under Review'].includes(p.status) && p.queueDays >= 7;
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 relative"
                          onMouseLeave={() => isMenuOpen && setMenuOpenFor(null)}
                        >
                          <td className="py-3.5 px-2 align-top">
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 h-10 w-10 shrink-0 flex items-center justify-center rounded-lg ${p.priority === 'Urgent' ? 'bg-danger-100 text-danger-600' : p.priority === 'High' ? 'bg-warning-100 text-warning-600' : 'bg-forum-50 text-forum-700'}`}>
                                <FolderKanban className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-forum-900 leading-snug">
                                  <Link to={`/admin/projects/${p.id}`} className="hover:text-forum-600 hover:underline">{p.title}</Link>
                                </p>
                                <p className="text-xs text-ink-muted mt-1 line-clamp-2 max-w-xl leading-snug">{p.excerpt}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-subtle">
                                  <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" />{p.views} views</span>
                                  {['Submitted', 'Under Review'].includes(p.status) && (
                                    <span className={`inline-flex items-center gap-1 font-semibold ${slaDanger ? 'text-danger-600' : slaWarn ? 'text-warning-600' : 'text-ink-muted'}`}>
                                      <Clock className="h-3 w-3" />{p.queueDays}d in queue
                                      {slaDanger && <Badge variant="danger" className="!text-[10px]">SLA</Badge>}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden sm:table-cell align-top">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-ink inline-flex items-center gap-1.5">
                                <span className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold">
                                  {p.member.split(' ').slice(1, 2).concat(p.member.split(' ').slice(-1)).map((n) => n[0]).join('')}
                                </span>
                                {p.member}
                              </p>
                              <code className="text-[11px] font-mono text-ink-subtle truncate">{p.memberId}</code>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <Badge variant="info">{p.category}</Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell align-top">
                            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(p.submittedAt)}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={sConf.variant}>
                              <SIcon className="h-3 w-3 mr-1" />
                              {p.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <Badge variant={pConf.variant}>
                              <PIcon className="h-3 w-3 mr-1" />
                              {p.priority}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 align-top text-right">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {act.startReview && (
                                <Link
                                  to={`/admin/projects/${p.id}`}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-warning-100 px-2 py-1 text-xs font-semibold text-warning-700 hover:bg-warning-600 hover:text-white transition-colors"
                                >
                                  <Eye className="h-3 w-3" />
                                  Start Review
                                </Link>
                              )}
                              <Link
                                to={`/admin/projects/${p.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setMenuOpenFor(isMenuOpen ? null : p.id); }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 mt-1 w-56 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm text-left"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MenuAction to={`/admin/projects/${p.id}`} icon={Eye} label="Open project details" />
                                    {act.startReview && <MenuAction to={`/admin/projects/${p.id}`} icon={Clock} label="Mark Under Review" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    {act.approve && <MenuAction to={`/admin/projects/${p.id}`} icon={CheckCircle2} label="Approve project" tone="success" />}
                                    {act.reject && <MenuAction to={`/admin/projects/${p.id}`} icon={XCircle} label="Request revision / reject" tone="danger" />}
                                    {act.publish && <MenuAction to={`/admin/projects/${p.id}`} icon={FileText} label="Send to publication" tone="success" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    <MenuAction to={`/admin/projects/${p.id}`} icon={Mail} label="Message member" />
                                    <MenuAction to={`/admin/projects/${p.id}`} icon={Download} label="Export project file" />
                                    {act.archive && <MenuAction to={`/admin/projects/${p.id}`} icon={History} label="Archive" tone="warning" />}
                                    {act.restore && <MenuAction to={`/admin/projects/${p.id}`} icon={ArchiveRestore} label="Restore from archive" tone="info" />}
                                  </div>
                                )}
                              </div>
                              {['Submitted', 'Under Review'].includes(p.status) && (
                                <Link
                                  to={`/admin/projects/${p.id}`}
                                  className="hidden lg:inline-flex items-center gap-1 rounded-md bg-brass-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brass-700 transition-colors"
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                  Decide
                                  <ChevronRight className="h-3 w-3" />
                                </Link>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ===== PAGINATION ===== */}
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-paper-border pt-4">
                <p className="text-xs text-ink-subtle">
                  Showing <span className="font-semibold text-ink-muted">{startIdx + 1}</span>–
                  <span className="font-semibold text-ink-muted">{Math.min(startIdx + safePageSize, filtered.length)}</span> of{' '}
                  <span className="font-semibold text-ink-muted">{filtered.length}</span> projects
                </p>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={safePage === 1}>
                    <ArrowLeft className="h-3.5 w-3.5" />First
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}>
                    <ChevronLeft className="h-3.5 w-3.5" />Prev
                  </Button>
                  <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>
                    Next<ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>
                    Last<ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
          <div className="mt-4 flex justify-end pt-2 border-t border-paper-border">
            <Badge variant="default"><Sparkles className="h-2.5 w-2.5 mr-1" />{DEMO_LABEL}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (n: number) => void }) {
  const range = useMemo(() => {
    const pages: (number | '…')[] = [];
    const add = (n: number | '…') => pages.push(n);
    const ws = 1;
    const start = Math.max(2, page - ws);
    const end = Math.min(totalPages - 1, page + ws);
    add(1);
    if (start > 2) add('…');
    for (let i = start; i <= end; i++) add(i);
    if (end < totalPages - 1) add('…');
    if (totalPages > 1) add(totalPages);
    return pages;
  }, [page, totalPages]);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-1">
      {range.map((p, i) => p === '…'
        ? <span key={`e${i}`} className="px-2 text-xs text-ink-subtle">…</span>
        : <button key={p} onClick={() => onChange(p)} className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors ${p === page ? 'bg-forum-600 text-white shadow-sm' : 'border border-paper-border text-ink-muted hover:bg-forum-50 hover:text-forum-900'}`}>{p}</button>)
      }
    </div>
  );
}

function MenuAction({ to, icon: Icon, label, tone = 'default' }: { to: string; icon: typeof Eye; label: string; tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' }) {
  const toneClasses = {
    default: 'text-ink hover:bg-forum-50 hover:text-forum-900',
    success: 'text-success-600 hover:bg-success-100',
    warning: 'text-warning-600 hover:bg-warning-100',
    danger: 'text-danger-600 hover:bg-danger-100',
    info: 'text-slateteal-700 hover:bg-slateteal-100',
  };
  return (
    <Link to={to} className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${toneClasses[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
      <div className="text-center"><p className="text-sm font-medium text-forum-900">Loading projects…</p><p className="text-xs text-ink-subtle mt-1">Fetching research project queue</p></div>
      <div className="mt-4 w-full max-w-3xl space-y-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg border border-paper-border bg-paper animate-pulse" />)}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-7 w-7" /></div>
      <div className="text-center max-w-md"><p className="text-base font-semibold text-forum-900">Couldn't load the project queue</p><p className="text-sm text-ink-muted mt-1">Check your network connection and try again. If the error persists, contact technical support.</p></div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={onRetry}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
        <Button as="link" to="/admin/support" size="sm" variant="ghost"><Mail className="h-3.5 w-3.5" />Contact support</Button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700"><FolderKanban className="h-8 w-8" /></div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">{hasFilters ? 'No projects match your filters' : 'No projects yet'}</p>
        <p className="text-sm text-ink-muted mt-1">{hasFilters ? 'Try clearing filters or broadening the search range.' : 'Project submissions will appear here as members submit them.'}</p>
      </div>
      <div className="flex gap-2 mt-2">
        {hasFilters ? (
          <Button size="sm" variant="outline" onClick={onClear}><X className="h-3.5 w-3.5" />Clear filters</Button>
        ) : (
          <Button as="link" to="/projects/upload" size="sm" variant="primary"><FolderKanban className="h-3.5 w-3.5" />Upload sample project</Button>
        )}
      </div>
    </div>
  );
}

function Filter({ className = '' }: { className?: string }) {
  return <FilterIcon className={className} />;
}

function FilterIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
