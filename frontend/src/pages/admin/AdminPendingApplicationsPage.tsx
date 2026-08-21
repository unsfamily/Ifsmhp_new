import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Download,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
  UserX,
  UserCheck,
  RefreshCw,
  Mail,
  AlertCircle,
  Sparkles,
  CalendarDays,
  Globe2,
  Loader2,
  X,
  SlidersHorizontal,
  GraduationCap,
  Briefcase,
  Send,
  FileText,
  ChevronDown,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput, TextArea, Checkbox } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type ProfessionalType =
  | 'Scientist'
  | 'Mental Health Professional'
  | 'Researcher'
  | 'Academician'
  | 'Clinician'
  | 'Policy Advisor'
  | 'Public Health Specialist';

type PendingStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';

interface PendingApplication {
  id: string;
  name: string;
  email: string;
  professionalTitle: string;
  professionalType: ProfessionalType;
  institution: string;
  country: string;
  submittedAt: string;
  SLA_days: number;
  status: PendingStatus;
  credentialsCount: number;
  priority: 'Standard' | 'High' | 'Urgent';
  flagReasons?: string[];
  applicationId: string;
  reviewsCount: number;
  hasRefereeLetter: boolean;
  highestDegree: string;
}

const professionalTypes: ProfessionalType[] = [
  'Scientist',
  'Mental Health Professional',
  'Researcher',
  'Academician',
  'Clinician',
  'Policy Advisor',
  'Public Health Specialist',
];

const pendingApplications: PendingApplication[] = [
  {
    id: 'mr1',
    name: 'Dr. Ryan Palmer',
    email: 'rpalmer@unimelb.edu.au',
    professionalTitle: 'Postdoc Researcher',
    professionalType: 'Researcher',
    institution: 'University of Melbourne',
    country: 'Australia',
    submittedAt: '2026-08-14T11:04:00+10:00',
    SLA_days: 2,
    status: 'Pending',
    credentialsCount: 3,
    priority: 'Standard',
    applicationId: 'IFSMHP-APP-2026-01812',
    reviewsCount: 0,
    hasRefereeLetter: false,
    highestDegree: 'PhD, Psychology',
  },
  {
    id: 'mr20',
    name: 'Dr. Anika Kapoor',
    email: 'anika.kapoor@aiims.edu',
    professionalTitle: 'Clinical Psychologist',
    professionalType: 'Mental Health Professional',
    institution: 'AIIMS Delhi',
    country: 'India',
    submittedAt: '2026-08-17T09:12:44+05:30',
    SLA_days: 4,
    status: 'Under Review',
    credentialsCount: 5,
    priority: 'High',
    flagReasons: ['High-priority institution (AIIMS)', 'Regionally relevant clinical practice'],
    applicationId: 'IFSMHP-APP-2026-01847',
    reviewsCount: 1,
    hasRefereeLetter: true,
    highestDegree: 'MD (Psychiatry), AIIMS',
  },
  {
    id: 'mr21',
    name: 'Prof. Henrik Lindberg',
    email: 'h.lindberg@ki.se',
    professionalTitle: 'Neuroscientist',
    professionalType: 'Scientist',
    institution: 'Karolinska Institutet',
    country: 'Sweden',
    submittedAt: '2026-08-18T14:30:00+02:00',
    SLA_days: 2,
    status: 'Pending',
    credentialsCount: 6,
    priority: 'High',
    flagReasons: ['Elite institution (Karolinska)', 'SAB overlap — recommend second reviewer'],
    applicationId: 'IFSMHP-APP-2026-01859',
    reviewsCount: 0,
    hasRefereeLetter: true,
    highestDegree: 'PhD, Neuroscience',
  },
  {
    id: 'mr3',
    name: 'Dr. Maya Fernández',
    email: 'maya.fernandez@hcuch.cl',
    professionalTitle: 'Child Psychiatrist',
    professionalType: 'Clinician',
    institution: 'Hospital Clínico UCH',
    country: 'Chile',
    submittedAt: '2026-08-19T15:08:12-04:00',
    SLA_days: 3,
    status: 'Under Review',
    credentialsCount: 5,
    priority: 'High',
    flagReasons: ['High regional impact — Latin America lead'],
    applicationId: 'IFSMHP-APP-2026-01882',
    reviewsCount: 1,
    hasRefereeLetter: true,
    highestDegree: 'Especialidad en Psiquiatría Infantil',
  },
  {
    id: 'mr23',
    name: 'Dr. Theo Mbeki',
    email: 't.mbeki@wits.ac.za',
    professionalTitle: 'Public Health Researcher',
    professionalType: 'Public Health Specialist',
    institution: 'Wits University',
    country: 'South Africa',
    submittedAt: '2026-08-20T08:44:17+02:00',
    SLA_days: 1,
    status: 'Pending',
    credentialsCount: 3,
    priority: 'Urgent',
    flagReasons: ['SLA at 1 day — flag for expedited review', 'African regional representation'],
    applicationId: 'IFSMHP-APP-2026-01891',
    reviewsCount: 0,
    hasRefereeLetter: false,
    highestDegree: 'MPH, Wits University',
  },
  {
    id: 'mr24',
    name: 'Dr. Siti Wijaya',
    email: 's.wijaya@ui.ac.id',
    professionalTitle: 'Mental Health Counselor',
    professionalType: 'Mental Health Professional',
    institution: 'Universitas Indonesia',
    country: 'Indonesia',
    submittedAt: '2026-08-15T10:20:00+07:00',
    SLA_days: 5,
    status: 'Pending',
    credentialsCount: 2,
    priority: 'Standard',
    applicationId: 'IFSMHP-APP-2026-01798',
    reviewsCount: 0,
    hasRefereeLetter: true,
    highestDegree: 'M.Psi, Clinical Psychology',
  },
];

const statusBadgeMap: Record<PendingStatus, 'success' | 'warning' | 'info' | 'brass' | 'danger'> = {
  Pending: 'info',
  'Under Review': 'warning',
  Approved: 'success',
  Rejected: 'danger',
};

const priorityBadgeMap: Record<PendingApplication['priority'], 'danger' | 'warning' | 'default'> = {
  Urgent: 'danger',
  High: 'warning',
  Standard: 'default',
};

const typeBadgeMap: Record<ProfessionalType, 'default' | 'info' | 'success' | 'brass' | 'warning'> = {
  Scientist: 'default',
  'Mental Health Professional': 'info',
  Researcher: 'success',
  Academician: 'brass',
  Clinician: 'warning',
  'Policy Advisor': 'info',
  'Public Health Specialist': 'success',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

type DecisionKind = null | 'approve' | 'reject';

export default function AdminPendingApplicationsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ProfessionalType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | PendingStatus>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | PendingApplication['priority']>('All');
  const [submittedFrom, setSubmittedFrom] = useState('');
  const [submittedTo, setSubmittedTo] = useState('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [dataState, setDataState] = useState<'idle' | 'loading' | 'success' | 'error'>('success');
  const [apps, setApps] = useState<PendingApplication[]>(pendingApplications);

  const filtered = useMemo(() => {
    return apps.filter((m) => {
      if (search) {
        const s = search.toLowerCase();
        if (!m.name.toLowerCase().includes(s) &&
            !m.professionalTitle.toLowerCase().includes(s) &&
            !m.institution.toLowerCase().includes(s) &&
            !m.applicationId.toLowerCase().includes(s)) return false;
      }
      if (typeFilter !== 'All' && m.professionalType !== typeFilter) return false;
      if (statusFilter !== 'All' && m.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && m.priority !== priorityFilter) return false;
      if (submittedFrom) {
        if (m.submittedAt.slice(0, 10) < submittedFrom) return false;
      }
      if (submittedTo) {
        if (m.submittedAt.slice(0, 10) > submittedTo) return false;
      }
      return true;
    });
  }, [search, typeFilter, statusFilter, priorityFilter, submittedFrom, submittedTo, apps]);

  useEffect(() => { setPage(1); }, [search, typeFilter, statusFilter, priorityFilter, submittedFrom, submittedTo, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const counts = useMemo(() => ({
    totalPending: apps.filter((a) => a.status === 'Pending' || a.status === 'Under Review').length,
    pending: apps.filter((a) => a.status === 'Pending').length,
    underReview: apps.filter((a) => a.status === 'Under Review').length,
    urgent: apps.filter((a) => a.priority === 'Urgent').length,
    breachingSLA: apps.filter((a) => a.SLA_days <= 2 && (a.status === 'Pending' || a.status === 'Under Review')).length,
    approvedThisSession: apps.filter((a) => a.status === 'Approved').length,
    rejectedThisSession: apps.filter((a) => a.status === 'Rejected').length,
  }), [apps]);

  const hasActiveFilters = search !== '' || typeFilter !== 'All' || statusFilter !== 'All' || priorityFilter !== 'All' || submittedFrom !== '' || submittedTo !== '';

  const clearFilters = () => {
    setSearch(''); setTypeFilter('All'); setStatusFilter('All'); setPriorityFilter('All');
    setSubmittedFrom(''); setSubmittedTo('');
  };

  const formatSubmitted = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass"><Sparkles className="h-2.5 w-2.5 mr-1" />{DEMO_LABEL}</Badge>
            <Link to="/admin/members" className="inline-flex items-center gap-1 text-forum-700 font-medium hover:underline">
              Full directory<ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            Pending Applications
          </h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Review and triage incoming member applications — approvals generate Member IDs, rejections require a written reason.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => { setDataState('loading'); setTimeout(() => setDataState('success'), 1200); }}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5" /> Export Queue
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'In Queue', value: counts.totalPending, icon: Users, color: 'forum' },
          { label: 'New (Pending)', value: counts.pending, icon: Clock, color: 'brass' },
          { label: 'Under Review', value: counts.underReview, icon: Eye, color: 'warning' },
          { label: 'Urgent Priority', value: counts.urgent, icon: AlertCircle, color: 'danger' },
          { label: 'SLA Breach <2d', value: counts.breachingSLA, icon: AlertTriangle, color: 'danger' },
          { label: 'Approved Today', value: counts.approvedThisSession, icon: CheckCircle2, color: 'success' },
        ].map((k) => {
          const Icon = k.icon;
          const bgMap: Record<string, string> = {
            forum: 'bg-forum-50 text-forum-700',
            slateteal: 'bg-slateteal-100 text-slateteal-700',
            brass: 'bg-brass-100 text-brass-700',
            success: 'bg-success-100 text-success-600',
            danger: 'bg-danger-100 text-danger-600',
            warning: 'bg-warning-100 text-warning-600',
          };
          return (
            <Card key={k.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-2xl font-semibold text-forum-900">{k.value}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{k.label}</p>
                  </div>
                  <div className={`h-9 w-9 flex items-center justify-center rounded-lg ${bgMap[k.color]}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput
              placeholder="Search applicant name, institution, application ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={filtersOpen ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filtersOpen ? 'Hide Filters' : 'Filters'}
              <Filter className="h-3.5 w-3.5" />
            </Button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900">
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>
        </CardHeader>
        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SelectInput label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
                <option value="All">All Statuses</option>
                <option>Pending</option>
                <option>Under Review</option>
                <option>Approved</option>
                <option>Rejected</option>
              </SelectInput>
              <SelectInput label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as any)}>
                <option value="All">All Priorities</option>
                <option>Urgent</option>
                <option>High</option>
                <option>Standard</option>
              </SelectInput>
              <SelectInput label="Professional Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
                <option value="All">All Types</option>
                {professionalTypes.map((t) => <option key={t}>{t}</option>)}
              </SelectInput>
              <div />
              <TextInput label="Submitted From" type="date" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} value={submittedFrom} onChange={(e) => setSubmittedFrom(e.target.value)} />
              <TextInput label="Submitted To" type="date" icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />} value={submittedTo} onChange={(e) => setSubmittedTo(e.target.value)} />
              <div className="sm:col-span-2 flex flex-wrap gap-2 items-end">
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('All')}>Reset statuses</Button>
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('Pending'); setPriorityFilter('Urgent'); }}>Show urgent pending</Button>
                <Button variant="outline" size="sm" onClick={() => { setStatusFilter('Pending'); }}>Triage new queue</Button>
              </div>
            </CardContent>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-forum-600" />
              Application Queue
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{pageItems.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{filtered.length}</span> applications
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows</label>
            <SelectInput value={pageSize.toString()} onChange={(e) => setPageSize(Number(e.target.value))} className="w-24">
              {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </SelectInput>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {dataState === 'loading' ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
              <p className="text-sm text-ink-muted">Refreshing application queue…</p>
            </div>
          ) : pageItems.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700">
                <Users className="h-8 w-8" />
              </div>
              <p className="text-base font-semibold text-forum-900">{hasActiveFilters ? 'No applications match' : 'Empty queue'}</p>
              <p className="text-sm text-ink-muted max-w-md text-center">
                {hasActiveFilters ? 'Try clearing or adjusting the current filters.' : 'Great job — triage is caught up! Applications will appear here as they are submitted.'}
              </p>
              {hasActiveFilters && (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Applicant</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Type · Degree</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Institution · Country</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Submitted</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">SLA</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Priority</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Docs</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((m) => {
                      const isMenuOpen = actionMenuOpenId === m.id;
                      const slaBreach = m.SLA_days <= 2 && (m.status === 'Pending' || m.status === 'Under Review');
                      return (
                        <tr
                          key={m.id}
                          className={`border-b border-paper-border last:border-0 hover:bg-forum-50/40 ${
                            m.priority === 'Urgent' ? 'bg-danger-50/10' : ''
                          }`}
                          onMouseLeave={() => isMenuOpen && setActionMenuOpenId(null)}
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white text-xs font-bold ${
                                m.priority === 'Urgent' ? 'bg-gradient-to-br from-danger-500 to-danger-700' :
                                m.priority === 'High' ? 'bg-gradient-to-br from-brass-500 to-brass-700' :
                                'bg-gradient-to-br from-forum-600 to-slateteal-500'
                              }`}>
                                {m.name.split(' ').slice(1, 2).concat(m.name.split(' ').slice(-1)).map((n) => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-forum-900">{m.name}</p>
                                <p className="text-xs text-ink-muted truncate max-w-[220px]"><Mail className="h-3 w-3 inline mr-1 align-text-bottom opacity-60" />{m.email}</p>
                                <p className="text-xs text-ink-subtle truncate max-w-[220px] lg:hidden">{m.institution}</p>
                                {m.flagReasons && m.flagReasons.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {m.flagReasons.map((f) => (
                                      <span key={f} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-brass-800 bg-brass-100 px-1.5 py-0.5 rounded border border-brass-200">
                                        <Sparkles className="h-2.5 w-2.5" /> {f.split(' — ')[0]}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell align-top">
                            <div>
                              <Badge variant={typeBadgeMap[m.professionalType]}>{m.professionalType}</Badge>
                              <p className="mt-1.5 text-xs text-ink-muted inline-flex items-center gap-1">
                                <GraduationCap className="h-3 w-3 text-ink-subtle" />
                                {m.highestDegree}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <div>
                              <p className="text-sm font-medium text-forum-900 truncate max-w-[220px]">{m.institution}</p>
                              <p className="text-xs text-ink-subtle inline-flex items-center gap-1 mt-0.5">
                                <Globe2 className="h-3 w-3" />{m.country}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden xl:table-cell align-top">
                            <div>
                              <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />{formatSubmitted(m.submittedAt)}
                              </span>
                              <p className="text-[10px] font-mono text-ink-subtle mt-1">App ID: {m.applicationId}</p>
                            </div>
                          </td>
                          <td className={`py-3.5 px-2 hidden sm:table-cell align-top ${slaBreach ? 'text-danger-600 font-semibold' : ''}`}>
                            <span className="inline-flex items-center gap-1 text-xs">
                              {slaBreach ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5 text-ink-subtle" />}
                              {m.SLA_days} day{m.SLA_days === 1 ? '' : 's'} left
                            </span>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={priorityBadgeMap[m.priority]}>
                              {m.priority === 'Urgent' && <AlertCircle className="h-3 w-3 mr-0.5" />}
                              {m.priority}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell align-top">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="inline-flex items-center gap-1">
                                <FileCheck className="h-3.5 w-3.5 text-ink-subtle" />
                                <span className="font-semibold">{m.credentialsCount}</span>
                              </span>
                              {m.hasRefereeLetter ? (
                                <Badge variant="success" className="!text-[10px] !py-0 !px-1.5">REFEREE</Badge>
                              ) : (
                                <Badge variant="warning" className="!text-[10px] !py-0 !px-1.5">NO REF</Badge>
                              )}
                              {m.reviewsCount > 0 && (
                                <Badge variant="info" className="!text-[10px] !py-0 !px-1.5">{m.reviewsCount} review{m.reviewsCount > 1 ? 's' : ''}</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 align-top">
                            <Badge variant={statusBadgeMap[m.status]}>
                              {m.status === 'Pending' ? <Clock className="h-3 w-3 mr-1" /> : m.status === 'Under Review' ? <Eye className="h-3 w-3 mr-1" /> : m.status === 'Approved' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {m.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 text-right align-top">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {(m.status === 'Pending' || m.status === 'Under Review') && (
                                <Link
                                  to={`/admin/members/${m.id}?decision=approve`}
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setApps((prev) => prev.map((x) => x.id === m.id ? { ...x, status: 'Approved' as PendingStatus } : x));
                                  }}
                                  title="Quick Approve"
                                >
                                  <CheckCircle2 className="h-3 w-3" /> Approve
                                </Link>
                              )}
                              <Link to={`/admin/members/${m.id}`} className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors">
                                <Eye className="h-3 w-3" /> Review
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setActionMenuOpenId(isMenuOpen ? null : m.id); }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900"
                                  aria-label="Actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div className="absolute right-0 mt-1 w-56 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm" onClick={(e) => e.stopPropagation()}>
                                    <Link to={`/admin/members/${m.id}`} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-forum-50 hover:text-forum-900">
                                      <Eye className="h-3.5 w-3.5" /> Open full review
                                    </Link>
                                    {m.status === 'Pending' && (
                                      <Link to={`/admin/members/${m.id}?action=review`} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-warning-600 hover:bg-warning-100">
                                        <Briefcase className="h-3.5 w-3.5" /> Start review & assign
                                      </Link>
                                    )}
                                    <div className="my-1 border-t border-paper-border" />
                                    {m.status !== 'Approved' && m.status !== 'Rejected' && (
                                      <>
                                        <Link to={`/admin/members/${m.id}?decision=approve`} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-success-600 hover:bg-success-100"
                                          onClick={() => setApps((prev) => prev.map((x) => x.id === m.id ? { ...x, status: 'Approved' as PendingStatus } : x))}>
                                          <UserCheck className="h-3.5 w-3.5" /> Approve &amp; issue ID
                                        </Link>
                                        <Link to={`/admin/members/${m.id}?decision=reject`} className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-danger-600 hover:bg-danger-100">
                                          <UserX className="h-3.5 w-3.5" /> Reject with reason…
                                        </Link>
                                        <div className="my-1 border-t border-paper-border" />
                                      </>
                                    )}
                                    <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-forum-50">
                                      <Mail className="h-3.5 w-3.5" /> Email applicant
                                    </button>
                                    <button className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink-muted hover:bg-forum-50">
                                      <FileText className="h-3.5 w-3.5" /> Export application packet
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-paper-border pt-4">
                <p className="text-xs text-ink-subtle">Showing <span className="font-semibold text-ink-muted">{startIdx + 1}</span>–<span className="font-semibold text-ink-muted">{Math.min(startIdx + pageSize, filtered.length)}</span> of <span className="font-semibold text-ink-muted">{filtered.length}</span></p>
                <div className="flex items-center gap-1.5">
                  <Button variant="ghost" size="sm" onClick={() => setPage(1)} disabled={safePage === 1}><ArrowLeft className="h-3.5 w-3.5" />First</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}><ChevronLeft className="h-3.5 w-3.5" />Prev</Button>
                  <span className="px-3 text-xs text-ink-muted">Page {safePage} / {totalPages}</span>
                  <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}>Next<ChevronRight className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)} disabled={safePage === totalPages}>Last<ArrowRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <QuickBulkActions count={filtered.filter((a) => a.status === 'Pending').length} />
    </div>
  );
}

function QuickBulkActions({ count }: { count: number }) {
  const [confirm, setConfirm] = useState<DecisionKind>(null);
  const [notes, setNotes] = useState('');
  const [typed, setTyped] = useState(false);
  return (
    <Card className="border-forum-600/20 bg-gradient-to-br from-forum-50/70 to-brass-50/50">
      <CardHeader className="flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-brass-700" />
            Bulk Actions
          </h3>
          <p className="text-xs text-ink-subtle mt-0.5">{count} applications in the pending queue ready for triage.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { setConfirm('approve'); setNotes(''); setTyped(false); }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Flag batch for committee vote
          </Button>
          <Button variant="primary" size="sm" onClick={() => { setConfirm('approve'); setNotes(''); setTyped(false); }}>
            <Send className="h-3.5 w-3.5" /> Email all applicants in queue
          </Button>
        </div>
      </CardHeader>
      {confirm && (
        <CardContent className="pt-0">
          <div className="rounded-xl border border-paper-border bg-paper p-4">
            <p className="text-sm font-medium text-forum-900">
              {confirm === 'approve' ? 'Prepare committee vote batch' : 'Prepare rejection batch'}
            </p>
            <TextArea rows={3} label="Notes for batch" className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Checkbox id="bulk-confirm" name="bulk-confirm" label="I understand this operation affects the entire filtered queue and is audited." checked={typed} onChange={(e) => setTyped((e.target as HTMLInputElement).checked)} className="mt-3" />
            <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setConfirm(null); setNotes(''); setTyped(false); }}>
                <ChevronDown className="h-3.5 w-3.5" /> Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={!typed}>Apply Bulk Action</Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
