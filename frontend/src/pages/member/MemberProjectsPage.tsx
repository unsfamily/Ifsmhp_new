import { useState } from 'react';
import {
  FolderKanban,
  Upload,
  Search,
  Eye,
  Edit3,
  Trash2,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  HeartHandshake,
  ShieldCheck,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput } from '../../components/common/Input';

type Status = 'All' | 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Published';
type SupportType = 'All' | 'Moral' | 'Official' | 'Funding';

interface Project {
  id: string;
  title: string;
  category: string;
  status: Exclude<Status, 'All'>;
  support: Exclude<SupportType, 'All'>[];
  submitted: string;
  updated: string;
  views: number;
}

const projects: Project[] = [
  {
    id: 'p1',
    title: 'Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms: A Meta-Analysis',
    category: 'Clinical Research',
    status: 'Published',
    support: ['Official'],
    submitted: 'Mar 15, 2026',
    updated: 'Jul 15, 2026',
    views: 1247,
  },
  {
    id: 'p2',
    title: 'Blood Biomarker Panels for Major Depressive Disorder Subtyping and Treatment Response Prediction',
    category: 'Biological Psychiatry',
    status: 'Under Review',
    support: ['Funding', 'Official'],
    submitted: 'Jul 08, 2026',
    updated: 'Aug 01, 2026',
    views: 88,
  },
  {
    id: 'p3',
    title: 'Evaluating Commercial Wearable EEG Devices: Scientific Validity and Clinical Correlates',
    category: 'Technology Validation',
    status: 'Submitted',
    support: ['Moral'],
    submitted: 'Jun 30, 2026',
    updated: 'Jul 02, 2026',
    views: 34,
  },
  {
    id: 'p4',
    title: 'Post-Pandemic Youth Mental Health Service Utilization: Five-Nation Comparative Analysis',
    category: 'Health Services',
    status: 'Draft',
    support: ['Funding'],
    submitted: '—',
    updated: 'Jun 22, 2026',
    views: 12,
  },
  {
    id: 'p5',
    title: '8-Week Mindfulness App RCT for Generalized Anxiety: Protocol and Baseline Characteristics',
    category: 'Clinical Trials',
    status: 'Approved',
    support: ['Moral', 'Official'],
    submitted: 'May 20, 2026',
    updated: 'Jul 11, 2026',
    views: 412,
  },
  {
    id: 'p6',
    title: 'Clinician Burnout Predictors in Hybrid Telehealth Workforce: Longitudinal Cohort Study',
    category: 'Occupational Mental Health',
    status: 'Draft',
    support: [],
    submitted: '—',
    updated: 'Aug 10, 2026',
    views: 5,
  },
];

const statusConfig: Record<Exclude<Status, 'All'>, { variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: FileText },
  Submitted: { variant: 'info', icon: AlertCircle },
  'Under Review': { variant: 'warning', icon: Clock },
  Approved: { variant: 'info', icon: ShieldCheck },
  Published: { variant: 'success', icon: CheckCircle2 },
};

const supportIcon = {
  Moral: HeartHandshake,
  Official: ShieldCheck,
  Funding: DollarSign,
};

const supportColor = {
  Moral: 'text-slateteal-700',
  Official: 'text-forum-700',
  Funding: 'text-brass-700',
};

export default function MemberProjectsPage() {
  const [status, setStatus] = useState<Status>('All');
  const [support, setSupport] = useState<SupportType>('All');
  const [search, setSearch] = useState('');

  const filtered = projects.filter((p) => {
    if (status !== 'All' && p.status !== status) return false;
    if (support !== 'All' && !p.support.includes(support)) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row gap-4 lg:items-end">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by project title or category..."
                className="w-full rounded-md border border-paper-border bg-paper pl-10 pr-4 py-2.5 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:flex lg:gap-4 lg:items-center">
              <SelectInput
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as Status)}
              >
                {(['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Published'] as Status[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <SelectInput
                label="Support Type"
                value={support}
                onChange={(e) => setSupport(e.target.value as SupportType)}
              >
                {(['All', 'Moral', 'Official', 'Funding'] as SupportType[]).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </SelectInput>
              <Button as="link" to="/dashboard/projects/upload" className="lg:mb-0.5 whitespace-nowrap">
                <Upload className="h-4 w-4" />
                Upload Project
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">
            Showing <strong className="text-ink-muted">{filtered.length}</strong> of <strong className="text-ink-muted">{projects.length}</strong> projects
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {filtered.map((p) => {
          const sConfig = statusConfig[p.status];
          const SIcon = sConfig.icon;
          return (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant={sConfig.variant}>
                      <SIcon className="h-3 w-3 mr-1" />
                      {p.status}
                    </Badge>
                    <Badge variant="info">{p.category}</Badge>
                  </div>
                  {p.support.length > 0 ? (
                    <div className="flex items-center gap-1" title={`Support requested: ${p.support.join(', ')}`}>
                      {p.support.map((s) => {
                        const SpprtIcon = supportIcon[s];
                        return <SpprtIcon key={s} className={`h-4 w-4 ${supportColor[s]}`} />;
                      })}
                    </div>
                  ) : (
                    <Badge variant="default">No support requested</Badge>
                  )}
                </div>
                <h3 className="mt-4 font-semibold text-forum-900 leading-snug">
                  {p.title}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Submitted</p>
                    <p className="text-ink-muted mt-0.5">{p.submitted}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">Last Updated</p>
                    <p className="text-ink-muted mt-0.5">{p.updated}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2 pt-3 border-t border-paper-border">
                  <span className="text-xs text-ink-subtle flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {p.views.toLocaleString()} views
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-forum-50 hover:text-forum-700 transition-colors" aria-label="View">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-forum-50 hover:text-forum-700 transition-colors" aria-label="Edit">
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button type="button" className="inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-subtle hover:bg-danger-100 hover:text-danger-600 transition-colors" aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <Button size="sm" variant="ghost">
                      Manage
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderKanban className="mx-auto h-12 w-12 text-ink-subtle" />
            <h3 className="mt-4 font-semibold text-forum-900">No projects match your filters</h3>
            <p className="mt-1 text-ink-muted text-sm">Try adjusting search or filters, or upload a new project.</p>
            <Button as="link" to="/dashboard/projects/upload" className="mt-5">
              <Upload className="h-4 w-4" />
              Upload New Project
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
