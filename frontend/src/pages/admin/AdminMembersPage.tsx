import { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  ChevronRight,
  IdCard,
  Download,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  MoreHorizontal,
  Edit3,
  Ban,
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

const DEMO_LABEL = '[DEMO DATA — API pending]';

type ProfessionalType =
  | 'Scientist'
  | 'Mental Health Professional'
  | 'Researcher'
  | 'Academician'
  | 'Clinician'
  | 'Policy Advisor'
  | 'Public Health Specialist';

type Status =
  | 'Pending'
  | 'Active'
  | 'Suspended'
  | 'Deactivated'
  | 'Rejected'
  | 'Under Review';

interface MemberRecord {
  id: string;
  name: string;
  email: string;
  memberId?: string;
  role: string;
  professionalType: ProfessionalType;
  institution: string;
  country: string;
  registrationDate: string;
  status: Status;
  credentials: number;
  priority?: 'Standard' | 'High';
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

const statuses: Status[] = [
  'Pending',
  'Active',
  'Suspended',
  'Deactivated',
  'Rejected',
];

const allMembers: MemberRecord[] = [
  { id: 'm1', name: 'Dr. Sarah Chen', email: 'sarah.chen@stanford.edu', memberId: 'IFSMHP-2024-000142', role: 'Research Scholar', professionalType: 'Scientist', institution: 'Stanford University', country: 'USA', registrationDate: '2024-03-12', status: 'Active', credentials: 5 },
  { id: 'm2', name: 'Prof. Rajiv Mehta', email: 'rajiv.mehta@nimhans.ac.in', memberId: 'IFSMHP-2024-000078', role: 'Psychiatrist', professionalType: 'Mental Health Professional', institution: 'NIMHANS', country: 'India', registrationDate: '2024-01-05', status: 'Active', credentials: 6 },
  { id: 'm3', name: 'Dr. Emma Thompson', email: 'emma.thompson@ox.ac.uk', memberId: 'IFSMHP-2024-000105', role: 'Clinical Psychologist', professionalType: 'Clinician', institution: 'University of Oxford', country: 'UK', registrationDate: '2024-02-20', status: 'Active', credentials: 4 },
  { id: 'm4', name: 'Dr. John Okafor', email: 'john.okafor@unilag.edu.ng', memberId: 'IFSMHP-2024-000198', role: 'Public Health', professionalType: 'Public Health Specialist', institution: 'University of Lagos', country: 'Nigeria', registrationDate: '2024-04-18', status: 'Deactivated', credentials: 3 },
  { id: 'm5', name: 'Prof. Yuki Tanaka', email: 'yuki.tanaka@u-tokyo.ac.jp', memberId: 'IFSMHP-2024-000211', role: 'Neuroscientist', professionalType: 'Scientist', institution: 'University of Tokyo', country: 'Japan', registrationDate: '2024-05-01', status: 'Active', credentials: 8 },
  { id: 'm6', name: 'Dr. Ana Pereira', email: 'ana.pereira@usp.br', memberId: 'IFSMHP-2024-000245', role: 'Therapist', professionalType: 'Mental Health Professional', institution: 'Universidade de São Paulo', country: 'Brazil', registrationDate: '2024-06-14', status: 'Active', credentials: 4 },
  { id: 'm7', name: 'Dr. Michael Brown', email: 'michael.brown@imperial.ac.uk', role: 'Scientist', professionalType: 'Researcher', institution: 'Imperial College London', country: 'UK', registrationDate: '2024-07-03', status: 'Rejected', credentials: 1 },
  { id: 'm8', name: 'Dr. Amina Kone', email: 'amina.kone@fann.sn', memberId: 'IFSMHP-2024-000301', role: 'Child Psychiatrist', professionalType: 'Clinician', institution: 'Hôpital de Fann', country: 'Senegal', registrationDate: '2024-08-10', status: 'Suspended', credentials: 5 },
  { id: 'm9', name: 'Prof. Eleanor Whitfield', email: 'e.whitfield@ucl.ac.uk', memberId: 'IFSMHP-2024-000312', role: 'Cognitive Neuroscience', professionalType: 'Academician', institution: 'UCL', country: 'UK', registrationDate: '2024-08-16', status: 'Active', credentials: 7 },
  { id: 'm10', name: 'Dr. Lucia Rossi', email: 'lucia.rossi@unimib.it', memberId: 'IFSMHP-2025-000012', role: 'Research Psychologist', professionalType: 'Researcher', institution: 'University of Milan-Bicocca', country: 'Italy', registrationDate: '2025-01-18', status: 'Active', credentials: 4 },
  { id: 'm11', name: 'Dr. Carlos Mendez', email: 'carlos.mendez@unal.edu.co', memberId: 'IFSMHP-2025-000034', role: 'Policy Advisor', professionalType: 'Policy Advisor', institution: 'Universidad Nacional de Colombia', country: 'Colombia', registrationDate: '2025-02-22', status: 'Active', credentials: 3 },
  { id: 'm12', name: 'Dr. Priya Sharma', email: 'priya.sharma@pgimer.edu', memberId: 'IFSMHP-2025-000047', role: 'Public Health Researcher', professionalType: 'Public Health Specialist', institution: 'PGIMER Chandigarh', country: 'India', registrationDate: '2025-03-05', status: 'Suspended', credentials: 6 },
  { id: 'm13', name: 'Prof. Lars Svensson', email: 'lars.svensson@ki.se', memberId: 'IFSMHP-2025-000059', role: 'Epidemiologist', professionalType: 'Scientist', institution: 'Karolinska Institutet', country: 'Sweden', registrationDate: '2025-03-14', status: 'Active', credentials: 7 },
  { id: 'm14', name: 'Dr. Nora Hargrove', email: 'nora.hargrove@mgh.harvard.edu', memberId: 'IFSMHP-2025-000063', role: 'Clinical Researcher', professionalType: 'Researcher', institution: 'Massachusetts General Hospital', country: 'USA', registrationDate: '2025-03-28', status: 'Active', credentials: 8 },
  { id: 'm15', name: 'Dr. Fatima Al-Sayed', email: 'fatima.alsayed@ksu.edu.sa', memberId: 'IFSMHP-2025-000071', role: 'Consultant Psychiatrist', professionalType: 'Mental Health Professional', institution: 'King Saud University', country: 'Saudi Arabia', registrationDate: '2025-04-02', status: 'Active', credentials: 5 },
  { id: 'm16', name: 'Dr. Kenji Watanabe', email: 'kenji.w@keio.jp', memberId: 'IFSMHP-2025-000082', role: 'Neuropsychologist', professionalType: 'Clinician', institution: 'Keio University', country: 'Japan', registrationDate: '2025-04-19', status: 'Deactivated', credentials: 5 },
  { id: 'm17', name: 'Prof. Nomsa Dlamini', email: 'nomsa.d@wits.ac.za', memberId: 'IFSMHP-2025-000094', role: 'Health Policy Professor', professionalType: 'Academician', institution: 'University of the Witwatersrand', country: 'South Africa', registrationDate: '2025-05-07', status: 'Active', credentials: 6 },
  { id: 'm18', name: 'Dr. Elena Vasquez', email: 'evasquez@uchile.cl', memberId: 'IFSMHP-2025-000107', role: 'Clinical Psychologist', professionalType: 'Mental Health Professional', institution: 'Hospital Clínico UCH', country: 'Chile', registrationDate: '2025-05-20', status: 'Active', credentials: 5 },
  { id: 'm19', name: 'Dr. Ryan Palmer', email: 'rpalmer@unimelb.edu.au', role: 'Postdoc Researcher', professionalType: 'Researcher', institution: 'University of Melbourne', country: 'Australia', registrationDate: '2026-08-14', status: 'Pending', credentials: 3, priority: 'Standard' },
  { id: 'm20', name: 'Dr. Anika Kapoor', email: 'anika.kapoor@aiims.edu', role: 'Clinical Psychologist', professionalType: 'Mental Health Professional', institution: 'AIIMS Delhi', country: 'India', registrationDate: '2026-08-17', status: 'Under Review', credentials: 4, priority: 'High' },
  { id: 'm21', name: 'Prof. Henrik Lindberg', email: 'h.lindberg@ki.se', role: 'Neuroscientist', professionalType: 'Scientist', institution: 'Karolinska Institutet', country: 'Sweden', registrationDate: '2026-08-18', status: 'Pending', credentials: 6, priority: 'Standard' },
  { id: 'm22', name: 'Dr. Maya Fernández', email: 'maya.fernandez@hcuch.cl', role: 'Child Psychiatrist', professionalType: 'Clinician', institution: 'Hospital Clínico UCH', country: 'Chile', registrationDate: '2026-08-19', status: 'Under Review', credentials: 5, priority: 'High' },
  { id: 'm23', name: 'Dr. Theo Mbeki', email: 't.mbeki@wits.ac.za', role: 'Public Health Researcher', professionalType: 'Public Health Specialist', institution: 'Wits University', country: 'South Africa', registrationDate: '2026-08-20', status: 'Pending', credentials: 3, priority: 'Standard' },
  { id: 'm24', name: 'Dr. Siti Wijaya', email: 's.wijaya@ui.ac.id', role: 'Mental Health Counselor', professionalType: 'Mental Health Professional', institution: 'Universitas Indonesia', country: 'Indonesia', registrationDate: '2026-08-15', status: 'Pending', credentials: 2, priority: 'Standard' },
  { id: 'm25', name: 'Dr. Gabriel Adeyemi', email: 'g.adeyemi@uniben.edu', role: 'Psychiatric Nurse Researcher', professionalType: 'Researcher', institution: 'University of Benin', country: 'Nigeria', registrationDate: '2026-08-12', status: 'Rejected', credentials: 1 },
];

const statusBadgeMap: Record<Status, 'success' | 'warning' | 'info' | 'brass' | 'danger' | 'default'> = {
  Active: 'success',
  Pending: 'info',
  'Under Review': 'warning',
  Suspended: 'brass',
  Rejected: 'danger',
  Deactivated: 'default',
};

const statusIconMap: Record<Status, typeof Clock> = {
  Active: CheckCircle2,
  Pending: Clock,
  'Under Review': Eye,
  Suspended: Ban,
  Rejected: XCircle,
  Deactivated: XCircle,
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

type DataState = 'idle' | 'loading' | 'success' | 'error';

export default function AdminMembersPage() {
  const [search, setSearch] = useState('');
  const [memberIdSearch, setMemberIdSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | ProfessionalType>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | Status>('All');
  const [regFrom, setRegFrom] = useState('');
  const [regTo, setRegTo] = useState('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0] ?? 10);
  const [dataState, setDataState] = useState<DataState>('success');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionMenuOpenId, setActionMenuOpenId] = useState<string | null>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateError, setSimulateError] = useState(false);

  useEffect(() => {
    if (simulateLoading) {
      setDataState('loading');
      const t = setTimeout(() => {
        setDataState('success');
        setSimulateLoading(false);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [simulateLoading]);

  useEffect(() => {
    if (simulateError) {
      setDataState('error');
      const t = setTimeout(() => {
        setDataState('success');
        setSimulateError(false);
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [simulateError]);

  const filtered = useMemo(() => {
    return allMembers.filter((m) => {
      if (search) {
        const s = search.toLowerCase();
        if (!m.name.toLowerCase().includes(s) &&
            !m.role.toLowerCase().includes(s)) return false;
      }
      if (memberIdSearch) {
        const s = memberIdSearch.toLowerCase();
        if (!m.memberId || !m.memberId.toLowerCase().includes(s)) return false;
      }
      if (emailSearch) {
        if (!m.email.toLowerCase().includes(emailSearch.toLowerCase())) return false;
      }
      if (institutionSearch) {
        if (!m.institution.toLowerCase().includes(institutionSearch.toLowerCase())) return false;
      }
      if (countrySearch) {
        if (!m.country.toLowerCase().includes(countrySearch.toLowerCase())) return false;
      }
      if (typeFilter !== 'All' && m.professionalType !== typeFilter) return false;
      if (statusFilter !== 'All' && m.status !== statusFilter) return false;
      if (regFrom) {
        if (m.registrationDate < regFrom) return false;
      }
      if (regTo) {
        if (m.registrationDate > regTo) return false;
      }
      return true;
    });
  }, [search, memberIdSearch, emailSearch, institutionSearch, countrySearch, typeFilter, statusFilter, regFrom, regTo]);

  useEffect(() => {
    setPage(1);
  }, [search, memberIdSearch, emailSearch, institutionSearch, countrySearch, typeFilter, statusFilter, regFrom, regTo, pageSize]);

  const safePageSize = typeof pageSize === 'number' && pageSize > 0 ? pageSize : 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * safePageSize;
  const pageItems = filtered.slice(startIdx, startIdx + safePageSize);

  const counts = useMemo(() => ({
    total: allMembers.length,
    pending: allMembers.filter((m) => m.status === 'Pending' || m.status === 'Under Review').length,
    active: allMembers.filter((m) => m.status === 'Active').length,
    suspended: allMembers.filter((m) => m.status === 'Suspended').length,
    deactivated: allMembers.filter((m) => m.status === 'Deactivated').length,
    rejected: allMembers.filter((m) => m.status === 'Rejected').length,
  }), []);

  const hasActiveFilters = search !== '' || memberIdSearch !== '' || emailSearch !== '' || institutionSearch !== '' || countrySearch !== '' || typeFilter !== 'All' || statusFilter !== 'All' || regFrom !== '' || regTo !== '';

  const clearFilters = () => {
    setSearch('');
    setMemberIdSearch('');
    setEmailSearch('');
    setInstitutionSearch('');
    setCountrySearch('');
    setTypeFilter('All');
    setStatusFilter('All');
    setRegFrom('');
    setRegTo('');
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
  };

  const availableActions = (status: Status) => ({
    view: true,
    edit: status !== 'Rejected' && status !== 'Deactivated',
    suspend: status === 'Active',
    deactivate: status === 'Active' || status === 'Suspended' || status === 'Pending' || status === 'Under Review',
    reactivate: status === 'Suspended' || status === 'Deactivated',
    approve: status === 'Pending' || status === 'Under Review',
    reject: status === 'Pending' || status === 'Under Review',
  });

  const handleExport = () => {
    setSimulateLoading(true);
    setTimeout(() => setSimulateLoading(false), 1200);
  };

  return (
    <div className="space-y-6">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div className="flex-1 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle mb-2">
            <Badge variant="brass">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {DEMO_LABEL}
            </Badge>
            {simulateLoading || dataState === 'loading' ? (
              <Badge variant="info">
                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                Syncing…
              </Badge>
            ) : null}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
            Members
          </h1>
          <p className="mt-1.5 text-ink-muted text-base leading-relaxed">
            Manage IFSMHP members, applications and membership status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setSimulateError(true)}>
            <AlertCircle className="h-3.5 w-3.5" />
            Test Error
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSimulateLoading(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={dataState === 'loading'}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ===== KPI STRIP ===== */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Total', value: counts.total, icon: Users, color: 'forum' },
          { label: 'Pending Review', value: counts.pending, icon: Clock, color: 'brass' },
          { label: 'Active', value: counts.active, icon: CheckCircle2, color: 'success' as const },
          { label: 'Suspended', value: counts.suspended, icon: Ban, color: 'brass' },
          { label: 'Deactivated', value: counts.deactivated, icon: UserX, color: 'forum' },
          { label: 'Rejected', value: counts.rejected, icon: XCircle, color: 'danger' as const },
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

      {/* ===== SEARCH & FILTERS ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative w-full sm:flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <TextInput
              placeholder="Search by name or role…"
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
              {filtersOpen ? 'Hide Filters' : 'More Filters'}
              <Filter className="h-3.5 w-3.5" />
            </Button>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 rounded-md border border-paper-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-forum-50 hover:text-forum-900"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>
        </CardHeader>

        {filtersOpen && (
          <div className="border-t border-paper-border">
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="Member ID"
                icon={<IdCard className="h-4 w-4 text-ink-subtle" />}
                placeholder="IFSMHP-YYYY-NNNNNN"
                value={memberIdSearch}
                onChange={(e) => setMemberIdSearch(e.target.value)}
              />
              <TextInput
                label="Email"
                icon={<Mail className="h-4 w-4 text-ink-subtle" />}
                placeholder="name@institution.edu"
                value={emailSearch}
                onChange={(e) => setEmailSearch(e.target.value)}
              />
              <TextInput
                label="Institution"
                icon={<Building2 className="h-4 w-4 text-ink-subtle" />}
                placeholder="University / Hospital…"
                value={institutionSearch}
                onChange={(e) => setInstitutionSearch(e.target.value)}
              />
              <TextInput
                label="Country"
                icon={<Globe2 className="h-4 w-4 text-ink-subtle" />}
                placeholder="Country name…"
                value={countrySearch}
                onChange={(e) => setCountrySearch(e.target.value)}
              />
              <SelectInput
                label="Professional Type"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ProfessionalType | 'All')}
              >
                <option value="All">All Professional Types</option>
                {professionalTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </SelectInput>
              <SelectInput
                label="Membership Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | 'All')}
              >
                <option value="All">All Statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <TextInput
                label="Registration From"
                icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />}
                type="date"
                value={regFrom}
                onChange={(e) => setRegFrom(e.target.value)}
              />
              <TextInput
                label="Registration To"
                icon={<CalendarDays className="h-4 w-4 text-ink-subtle" />}
                type="date"
                value={regTo}
                onChange={(e) => setRegTo(e.target.value)}
              />
            </CardContent>
          </div>
        )}
      </Card>

      {/* ===== MEMBERS TABLE ===== */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <Users className="h-5 w-5 text-forum-600" />
              Member Directory
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">
              Showing <span className="font-semibold text-ink-muted">{pageItems.length}</span> of{' '}
              <span className="font-semibold text-ink-muted">{filtered.length}</span> members
              {hasActiveFilters && (
                <> · <span className="text-brass-700 font-medium">filters applied</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-ink-muted">Rows per page</label>
            <SelectInput
              value={safePageSize.toString()}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="w-24"
            >
              {PAGE_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SelectInput>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {dataState === 'loading' ? (
            <LoadingState />
          ) : dataState === 'error' ? (
            <ErrorState onRetry={() => { setSimulateError(false); setDataState('success'); }} />
          ) : pageItems.length === 0 ? (
            <EmptyState hasFilters={hasActiveFilters} onClear={clearFilters} />
          ) : (
            <>
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-paper-border text-left">
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Member</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Member ID</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Professional Type</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Institution</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Country</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden xl:table-cell">Registration</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                      <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((m) => {
                      const StatusIcon = statusIconMap[m.status];
                      const actions = availableActions(m.status);
                      const isMenuOpen = actionMenuOpenId === m.id;
                      return (
                        <tr
                          key={m.id}
                          className="border-b border-paper-border last:border-0 hover:bg-forum-50/40 relative"
                          onMouseLeave={() => isMenuOpen && setActionMenuOpenId(null)}
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold">
                                {m.name.split(' ').slice(1, 2).concat(m.name.split(' ').slice(-1)).map((n) => n[0]).join('')}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-forum-900">{m.name}</p>
                                <p className="text-xs text-ink-muted truncate max-w-[220px]">
                                  <Mail className="h-3 w-3 inline mr-1 align-text-bottom opacity-60" />
                                  {m.email}
                                </p>
                                <p className="text-xs text-ink-subtle truncate max-w-[220px] md:hidden">
                                  {m.institution}
                                </p>
                              </div>
                              {m.priority === 'High' && <Badge variant="danger" className="hidden sm:inline-flex">High</Badge>}
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden md:table-cell">
                            {m.memberId ? (
                              <code className="text-[11px] font-mono rounded bg-forum-50 text-forum-700 px-2 py-1 font-semibold whitespace-nowrap">
                                {m.memberId}
                              </code>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-ink-subtle">
                                <Clock className="h-3 w-3" />
                                Pending ID
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell">
                            <Badge variant={typeBadgeMap[m.professionalType]}>{m.professionalType}</Badge>
                          </td>
                          <td className="py-3.5 px-2 hidden sm:table-cell">
                            <div className="text-sm">
                              <p className="text-ink truncate max-w-[200px]">{m.institution}</p>
                              <p className="text-xs text-ink-subtle inline-flex items-center gap-1 mt-0.5 lg:hidden">
                                <Globe2 className="h-3 w-3" />
                                {m.country}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 hidden lg:table-cell">
                            <span className="inline-flex items-center gap-1 text-xs text-ink">
                              <Globe2 className="h-3 w-3 text-ink-subtle" />
                              {m.country}
                            </span>
                          </td>
                          <td className="py-3.5 px-2 hidden xl:table-cell">
                            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(m.registrationDate)}
                            </span>
                          </td>
                          <td className="py-3.5 px-2">
                            <Badge variant={statusBadgeMap[m.status]}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {m.status}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-2 text-right align-top">
                            <div className="inline-flex items-center gap-1.5 justify-end relative">
                              {actions.approve && (
                                <button
                                  className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-semibold text-success-600 hover:bg-success-600 hover:text-white transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Approve
                                </button>
                              )}
                              <Link
                                to={`/admin/members/${m.id}`}
                                className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors"
                                title="View"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Link>
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpenId(isMenuOpen ? null : m.id);
                                  }}
                                  className="inline-flex items-center justify-center rounded-md border border-paper-border px-1.5 py-1 text-xs text-ink-muted hover:bg-forum-50 hover:text-forum-900 transition-colors"
                                  aria-label="More actions"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                                {isMenuOpen && (
                                  <div
                                    className="absolute right-0 mt-1 w-52 z-10 rounded-lg border border-paper-border bg-paper-raised shadow-lg py-1.5 text-sm"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MenuAction to={`/admin/members/${m.id}`} icon={Eye} label="View details" />
                                    {actions.edit && <MenuAction to={`/admin/members/${m.id}`} icon={Edit3} label="Edit member" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    {actions.approve && <MenuAction to={`/admin/members/${m.id}`} icon={CheckCircle2} label="Approve & issue ID" tone="success" />}
                                    {actions.reject && <MenuAction to={`/admin/members/${m.id}`} icon={XCircle} label="Reject application" tone="danger" />}
                                    <div className="my-1 border-t border-paper-border" />
                                    {actions.suspend && <MenuAction to={`/admin/members/${m.id}`} icon={Ban} label="Suspend account" tone="warning" />}
                                    {actions.reactivate && <MenuAction to={`/admin/members/${m.id}`} icon={UserCheck} label="Reactivate account" tone="success" />}
                                    {actions.deactivate && <MenuAction to={`/admin/members/${m.id}`} icon={UserX} label="Deactivate permanently" tone="danger" />}
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

              {/* ===== PAGINATION ===== */}
              <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-paper-border pt-4">
                <p className="text-xs text-ink-subtle">
                  Showing <span className="font-semibold text-ink-muted">{startIdx + 1}</span>–
                  <span className="font-semibold text-ink-muted">{Math.min(startIdx + safePageSize, filtered.length)}</span> of{' '}
                  <span className="font-semibold text-ink-muted">{filtered.length}</span> members
                </p>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(1)}
                    disabled={safePage === 1}
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    First
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPage(totalPages)}
                    disabled={safePage === totalPages}
                  >
                    Last
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}
          <div className="mt-4 flex justify-end pt-2 border-t border-paper-border">
            <Badge variant="default">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              {DEMO_LABEL}
            </Badge>
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
    const windowSize = 1;
    const start = Math.max(2, page - windowSize);
    const end = Math.min(totalPages - 1, page + windowSize);

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
      {range.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-2 text-xs text-ink-subtle">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`h-8 min-w-8 rounded-md px-2 text-xs font-medium transition-colors ${
              p === page
                ? 'bg-forum-600 text-white shadow-sm'
                : 'border border-paper-border text-ink-muted hover:bg-forum-50 hover:text-forum-900'
            }`}
          >
            {p}
          </button>
        )
      )}
    </div>
  );
}

function MenuAction({ to, icon: Icon, label, tone = 'default' }: { to: string; icon: typeof Eye; label: string; tone?: 'default' | 'success' | 'warning' | 'danger' }) {
  const toneClasses = {
    default: 'text-ink hover:bg-forum-50 hover:text-forum-900',
    success: 'text-success-600 hover:bg-success-100',
    warning: 'text-warning-600 hover:bg-warning-100',
    danger: 'text-danger-600 hover:bg-danger-100',
  };
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${toneClasses[tone]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 text-forum-600 animate-spin" />
      <div className="text-center">
        <p className="text-sm font-medium text-forum-900">Loading members…</p>
        <p className="text-xs text-ink-subtle mt-1">Retrieving directory from the registry</p>
      </div>
      <div className="mt-4 w-full max-w-xl space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-paper-border bg-paper animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-14 w-14 flex items-center justify-center rounded-full bg-danger-100 text-danger-600">
        <AlertCircle className="h-7 w-7" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">Couldn't load members</p>
        <p className="text-sm text-ink-muted mt-1">
          We hit a problem fetching the member directory. Check your connection or try again.
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
        <Button as="link" to="/admin/support" size="sm" variant="ghost">
          <Mail className="h-3.5 w-3.5" />
          Contact support
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-3">
      <div className="h-16 w-16 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700">
        <Users className="h-8 w-8" />
      </div>
      <div className="text-center max-w-md">
        <p className="text-base font-semibold text-forum-900">
          {hasFilters ? 'No members match your filters' : 'No members yet'}
        </p>
        <p className="text-sm text-ink-muted mt-1">
          {hasFilters
            ? 'Try clearing or adjusting the current search and filters.'
            : 'Membership applications will appear here as they are submitted.'}
        </p>
      </div>
      <div className="flex gap-2 mt-2">
        {hasFilters ? (
          <Button size="sm" variant="outline" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : (
          <Button as="link" to="/register" size="sm" variant="primary">
            <UserCheck className="h-3.5 w-3.5" />
            Invite a member
          </Button>
        )}
      </div>
    </div>
  );
}
