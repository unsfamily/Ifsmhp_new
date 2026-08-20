import {
  FileText,
  Download,
  Upload,
  Share2,
  Eye,
  Search,
  Filter,
  BookOpenCheck,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useState } from 'react';
import { SelectInput } from '../../components/common/Input';

interface Pub {
  id: string;
  title: string;
  venue: string;
  publishedOn: string;
  category: string;
  status: 'Published' | 'Under Review' | 'Pending Approval';
  views: number;
  downloads: number;
  doi?: string;
}

const publications: Pub[] = [
  {
    id: 'pub1',
    title: 'Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms: A Meta-Analysis',
    venue: 'IFSMHP Journal of Clinical Mental Health',
    publishedOn: 'Jul 15, 2026',
    category: 'Mental Health',
    status: 'Published',
    views: 1247,
    downloads: 342,
    doi: '10.ifsmhp.2026.00142',
  },
  {
    id: 'pub2',
    title: 'Youth Telehealth Service Utilization: 5-Nation Comparative Analysis',
    venue: 'IFSMHP International Journal of Mental Health Systems',
    publishedOn: 'Nov 22, 2025',
    category: 'Service Analysis',
    status: 'Published',
    views: 982,
    downloads: 267,
    doi: '10.ifsmhp.2025.00087',
  },
  {
    id: 'pub3',
    title: 'Mindfulness App Intervention for Generalized Anxiety: 8-Week RCT',
    venue: 'IFSMHP Psychology of Well-Being',
    publishedOn: 'Apr 03, 2025',
    category: 'Scientific Research',
    status: 'Published',
    views: 1532,
    downloads: 418,
    doi: '10.ifsmhp.2025.00031',
  },
  {
    id: 'pub4',
    title: 'Clinician Burnout Predictors in Hybrid Telehealth Cohorts',
    venue: 'IFSMHP Frontiers in Occupational Mental Health',
    publishedOn: 'Oct 14, 2024',
    category: 'Scientific Research',
    status: 'Published',
    views: 694,
    downloads: 189,
    doi: '10.ifsmhp.2024.00221',
  },
];

const categoryColors: Record<string, 'default' | 'success' | 'warning' | 'info' | 'brass'> = {
  'Mental Health': 'info',
  'Scientific Research': 'default',
  'Product Reviews': 'warning',
  'Service Analysis': 'success',
};

export default function MemberPublicationsPage() {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');

  const totalViews = publications.reduce((acc, p) => acc + p.views, 0);
  const totalDownloads = publications.reduce((acc, p) => acc + p.downloads, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Published Works', value: publications.length.toString(), icon: FileText, color: 'forum' },
          { label: 'Total Views', value: totalViews.toLocaleString(), icon: Eye, color: 'slateteal' },
          { label: 'Total Downloads', value: totalDownloads.toLocaleString(), icon: Download, color: 'brass' },
          { label: 'Avg. Readership', value: '+28%', icon: TrendingUp, color: 'forum' },
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
                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 flex items-center justify-center rounded-lg ${bg}`}>
                    <Icon className="h-5.5 w-5.5" />
                  </div>
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-forum-900">{s.value}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{s.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="relative sm:max-w-md flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
            <input
              type="text"
              placeholder="Search by title, venue, DOI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-paper-border bg-paper pl-10 pr-4 py-2.5 text-sm shadow-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
            />
          </div>
          <div className="flex items-center gap-3">
            <SelectInput
              label={<span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Category</span>}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="sm:mb-0"
            >
              <option value="All">All Categories</option>
              <option value="Mental Health">Mental Health</option>
              <option value="Scientific Research">Scientific Research</option>
              <option value="Service Analysis">Service Analysis</option>
            </SelectInput>
            <Button>
              <Upload className="h-4 w-4" />
              Submit New Paper
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {publications.filter((p) => {
          if (category !== 'All' && p.category !== category) return false;
          if (search) {
            const s = search.toLowerCase();
            if (!p.title.toLowerCase().includes(s) && !p.venue.toLowerCase().includes(s) && !(p.doi || '').toLowerCase().includes(s)) return false;
          }
          return true;
        }).map((p) => (
          <Card key={p.id}>
            <CardContent className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={categoryColors[p.category] || 'default'}>{p.category}</Badge>
                    <Badge variant="success">
                      <BookOpenCheck className="h-2.5 w-2.5 mr-1" />
                      {p.status}
                    </Badge>
                    {p.doi && (
                      <span className="inline-flex items-center rounded-md border border-paper-border bg-paper px-2.5 py-1 font-mono text-[11px] text-ink-muted">
                        DOI: {p.doi}
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-semibold text-lg text-forum-900 leading-snug">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">{p.venue}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Published {p.publishedOn}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {p.views.toLocaleString()} views
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Download className="h-3.5 w-3.5" />
                      {p.downloads.toLocaleString()} downloads
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 pt-4 border-t border-paper-border">
                <Button size="sm" variant="ghost" as="link" to={`/research/${p.id}`}>
                  <Eye className="h-4 w-4" />
                  View Public Page
                </Button>
                <Button size="sm" variant="outline">
                  <Download className="h-4 w-4" />
                  Download PDF
                </Button>
                <Button size="sm" variant="outline">
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-brass-700 font-medium">
                    <TrendingUp className="h-3.5 w-3.5" />
                    Trending
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
