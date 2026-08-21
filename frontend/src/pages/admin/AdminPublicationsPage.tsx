import { useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ChevronRight,
  Globe2,
  Ban,
  Filter,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextInput } from '../../components/common/Input';

type Status = 'All' | 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Published' | 'Rejected';
type Category = 'All' | 'Clinical Research' | 'Biological Psychiatry' | 'Public Health' | 'Psychotherapy' | 'Health Services' | 'Technology Validation';

interface Publication {
  id: string;
  title: string;
  author: string;
  memberId: string;
  category: Exclude<Category, 'All'>;
  researchType: string;
  status: Exclude<Status, 'All'>;
  submittedAt: string;
  queueDays: number;
  views: number;
  pdfSize: string;
  slug?: string;
  publishedAt?: string;
}

const publications: Publication[] = [
  { id: 'pub1', title: 'Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms: A Systematic Review and Meta-Analysis', author: 'Dr. S. Chen', memberId: 'IFSMHP-2024-000142', category: 'Clinical Research', researchType: 'Systematic Review', status: 'Published', submittedAt: 'Mar 15, 2026', queueDays: 0, views: 1247, pdfSize: '2.3 MB', slug: 'cbt-digital-mh-meta-2026', publishedAt: 'Jul 15, 2026' },
  { id: 'pub2', title: 'Blood Biomarker Panels for Major Depressive Disorder Subtyping and Treatment Response Prediction', author: 'Dr. S. Chen', memberId: 'IFSMHP-2024-000142', category: 'Biological Psychiatry', researchType: 'Original Research', status: 'Approved', submittedAt: 'Jul 08, 2026', queueDays: 0, views: 88, pdfSize: '4.1 MB' },
  { id: 'pub3', title: 'Evaluating Commercial Wearable EEG Devices: Scientific Validity and Clinical Correlates', author: 'Dr. T. Mbeki', memberId: 'IFSMHP-2024-000198', category: 'Technology Validation', researchType: 'Validation Study', status: 'Under Review', submittedAt: 'Aug 12, 2026', queueDays: 9, views: 42, pdfSize: '1.9 MB' },
  { id: 'pub4', title: 'Postpartum Depression Screening Protocol for Low-Resource Settings: A Pragmatic Implementation Study', author: 'Dr. M. Fernández', memberId: 'IFSMHP-2024-000201', category: 'Health Services', researchType: 'Implementation Science', status: 'Submitted', submittedAt: 'Aug 18, 2026', queueDays: 3, views: 11, pdfSize: '2.7 MB' },
  { id: 'pub5', title: 'Psilocybin-assisted therapy for existential distress in palliative care: protocol for a phase II trial', author: 'Prof. M. Whitfield', memberId: 'IFSMHP-2024-000045', category: 'Clinical Research', researchType: 'Clinical Trial Protocol', status: 'Submitted', submittedAt: 'Aug 17, 2026', queueDays: 4, views: 26, pdfSize: '1.4 MB' },
  { id: 'pub6', title: '8-Week Mindfulness App RCT for Generalized Anxiety: Protocol and Baseline Characteristics', author: 'Dr. S. Wijaya', memberId: 'IFSMHP-2024-000156', category: 'Clinical Research', researchType: 'RCT', status: 'Published', submittedAt: 'May 20, 2026', queueDays: 0, views: 412, pdfSize: '3.0 MB', slug: 'mindfulness-app-rct-gad-2026', publishedAt: 'Jul 11, 2026' },
  { id: 'pub7', title: 'Prevalence of Burnout in Hybrid Telehealth Mental Health Workforce: Multi-country Analysis', author: 'Dr. A. Kapoor', memberId: 'IFSMHP-2024-000176', category: 'Public Health', researchType: 'Cross-sectional Study', status: 'Under Review', submittedAt: 'Aug 10, 2026', queueDays: 11, views: 68, pdfSize: '1.2 MB' },
];

const statusConfig: Record<Exclude<Status, 'All'>, { variant: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'brass'; icon: typeof Clock }> = {
  Draft: { variant: 'default', icon: Clock },
  Submitted: { variant: 'info', icon: FileText },
  'Under Review': { variant: 'warning', icon: Eye },
  Approved: { variant: 'success', icon: CheckCircle2 },
  Published: { variant: 'brass', icon: Globe2 },
  Rejected: { variant: 'danger', icon: XCircle },
};

export default function AdminPublicationsPage() {
  const [tab, setTab] = useState<'review' | 'published' | 'all'>('review');
  const [status, setStatus] = useState<Status>('All');
  const [category, setCategory] = useState<Category>('All');
  const [search, setSearch] = useState('');

  const tabData = tab === 'review'
    ? publications.filter((p) => ['Submitted', 'Under Review', 'Approved'].includes(p.status))
    : tab === 'published'
    ? publications.filter((p) => p.status === 'Published')
    : publications;

  const filtered = tabData.filter((p) => {
    if (status !== 'All' && p.status !== status) return false;
    if (category !== 'All' && p.category !== category) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.title.toLowerCase().includes(s) && !p.author.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const reviewCount = publications.filter((p) => ['Submitted', 'Under Review'].includes(p.status)).length;
  const approvedReadyCount = publications.filter((p) => p.status === 'Approved').length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'In Review Queue', value: reviewCount.toString(), icon: FileText, color: 'forum', note: `${approvedReadyCount} approved, ready to publish` },
          { label: 'Published This Month', value: '9', icon: Globe2, color: 'brass', note: '+12% over last period' },
          { label: 'Total Public Views', value: '21,847', icon: Eye, color: 'slateteal', note: 'All published work' },
          { label: 'Avg. Review Time', value: '6.2 days', icon: Clock, color: 'forum', note: 'SLA target: ≤ 10 days' },
        ].map((k) => {
          const Icon = k.icon;
          const bg = { forum: 'bg-forum-50 text-forum-700', slateteal: 'bg-slateteal-100 text-slateteal-700', brass: 'bg-brass-100 text-brass-700' }[k.color as 'forum' | 'slateteal' | 'brass'];
          return (
            <Card key={k.label}>
              <CardContent className="p-5">
                <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}>
                  <Icon className="h-5.5 w-5.5" />
                </div>
                <p className="mt-4 font-display text-3xl font-semibold text-forum-900">{k.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{k.label}</p>
                <p className="mt-1 text-[11px] text-ink-subtle">{k.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex gap-1 rounded-lg bg-forum-50 p-1">
                {(['review', 'published', 'all'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-colors capitalize ${
                      tab === t ? 'bg-paper-raised text-forum-900 shadow-sm ring-1 ring-paper-border' : 'text-ink-muted hover:text-forum-900'
                    }`}
                  >
                    {t === 'review' ? `Review Queue (${reviewCount})` : t === 'published' ? `Published (${publications.filter((p) => p.status === 'Published').length})` : 'All Submissions'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <TextInput placeholder="Search title, author…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 [&>input]:pl-9" />
              </div>
              <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status)} className="w-full sm:w-40">
                {(['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Published', 'Rejected'] as Status[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Status' : v}</option>)}
              </SelectInput>
              <SelectInput value={category} onChange={(e) => setCategory(e.target.value as Category)} className="w-full sm:w-44 hidden md:block">
                {(['All', 'Clinical Research', 'Biological Psychiatry', 'Public Health', 'Psychotherapy', 'Health Services', 'Technology Validation'] as Category[]).map((v) => <option key={v} value={v}>{v === 'All' ? 'All Categories' : v}</option>)}
              </SelectInput>
              <button className="inline-flex items-center gap-1.5 rounded-md border border-paper-border px-3 py-2 text-sm text-ink-muted hover:bg-forum-50">
                <Filter className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-paper-border text-left">
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Publication</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden sm:table-cell">Author</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden md:table-cell">Category</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Status</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle hidden lg:table-cell">Queue</th>
                  <th className="py-3 px-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sc = statusConfig[p.status];
                  const SIcon = sc.icon;
                  const queueWarn = ['Submitted', 'Under Review'].includes(p.status) && p.queueDays >= 8;
                  return (
                    <tr key={p.id} className="border-b border-paper-border last:border-0 hover:bg-forum-50/40">
                      <td className="py-3.5 px-2 max-w-xl">
                        <div>
                          <p className="font-medium text-forum-900 leading-snug">{p.title}</p>
                          <p className="text-xs text-ink-subtle mt-0.5 flex items-center gap-2 flex-wrap">
                            <Badge variant="info" className="!py-0">{p.researchType}</Badge>
                            {p.status === 'Published' && <code className="font-mono text-[10px] text-ink-subtle bg-paper px-1.5 py-0.5 rounded">/research/{p.slug}</code>}
                            {p.status !== 'Published' && <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" />PDF: {p.pdfSize}</span>}
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                            {p.author.split(' ').slice(1, 2).concat(p.author.split(' ').slice(-1)).map((n) => n[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-ink truncate">{p.author}</p>
                            <p className="text-[10px] text-ink-subtle font-mono truncate">{p.memberId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 hidden md:table-cell text-sm text-ink-muted">{p.category}</td>
                      <td className="py-3.5 px-2">
                        <Badge variant={sc.variant}>
                          <SIcon className="h-3 w-3 mr-1" />
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-2 hidden lg:table-cell">
                        {['Submitted', 'Under Review'].includes(p.status) ? (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${queueWarn ? 'text-warning-600' : 'text-ink-muted'}`}>
                            <Clock className="h-3.5 w-3.5" />
                            {p.queueDays}d
                            {queueWarn && <Badge variant="warning" className="ml-1 !text-[10px]">Slow</Badge>}
                          </span>
                        ) : p.status === 'Published' ? (
                          <span className="text-xs text-ink-muted inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-brass-700" />
                            {p.publishedAt}
                          </span>
                        ) : p.status === 'Approved' ? (
                          <Badge variant="brass">Ready to publish</Badge>
                        ) : (
                          <span className="text-xs text-ink-subtle">{p.submittedAt}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            to={`/admin/publications/${p.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-50 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Review
                          </Link>
                          {p.status === 'Under Review' && (
                            <Button size="sm" variant="primary" className="!px-2.5 !py-1 !text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approve
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {p.status === 'Approved' && (
                            <Button size="sm" className="!px-2.5 !py-1 !text-xs bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
                              <Globe2 className="h-3.5 w-3.5" />
                              Publish
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {p.status === 'Published' && (
                            <Button size="sm" variant="outline" className="!px-2.5 !py-1 !text-xs border-warning-600/40 text-warning-700 hover:bg-warning-100">
                              <Ban className="h-3.5 w-3.5" />
                              Unpublish
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
