import {
  Users,
  Search,
  MessageCircle,
  BookOpen,
  Calendar,
  Award,
  HeartHandshake,
  FileText,
  UserPlus,
  Building2,
  TrendingUp,
  Globe2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

interface Member {
  id: string;
  name: string;
  title: string;
  institution: string;
  country: string;
  type: string;
  interests: string[];
  projects: number;
  pubs: number;
}

const members: Member[] = [
  { id: 'm1', name: 'Prof. Marcus Whitfield', title: 'Professor of Psychiatry', institution: 'Oxford University', country: 'UK', type: 'Scientist', interests: ['Depression', 'Pharmacology'], projects: 11, pubs: 48 },
  { id: 'm2', name: 'Dr. Amara Patel', title: 'Neuroimaging Researcher', institution: 'NIMHANS', country: 'India', type: 'Scientist', interests: ['EEG', 'Neurotech'], projects: 5, pubs: 19 },
  { id: 'm3', name: 'Dr. James Okafor', title: 'Clinical Psychologist', institution: 'Lagos State University', country: 'Nigeria', type: 'Professional', interests: ['Global MH', 'Service Delivery'], projects: 7, pubs: 14 },
  { id: 'm4', name: 'Dr. Elena Rodriguez', title: 'Mindfulness Research Lead', institution: 'Universidad de Barcelona', country: 'Spain', type: 'Scientist', interests: ['Mindfulness', 'RCTs'], projects: 6, pubs: 22 },
  { id: 'm5', name: 'Prof. Naomi Hargrove', title: 'AI Safety Researcher', institution: 'MIT', country: 'USA', type: 'Scientist', interests: ['AI Safety', 'Chatbots'], projects: 9, pubs: 31 },
  { id: 'm6', name: 'Dr. Liam Sutherland', title: 'Youth Mental Health', institution: 'University of Melbourne', country: 'Australia', type: 'Professional', interests: ['Youth', 'Health Policy'], projects: 8, pubs: 27 },
];

const interestGroups = [
  { name: 'Digital Mental Health Tech', members: 62, active: '12 online', tag: 'Trending' },
  { name: 'Treatment-Resistant Depression', members: 48, active: '8 online', tag: 'Active' },
  { name: 'Global Health Disparities', members: 35, active: '5 online', tag: 'New' },
  { name: 'Psychedelic Research', members: 29, active: '6 online', tag: 'Trending' },
  { name: 'Telehealth Policy & Ethics', members: 41, active: '4 online', tag: 'Active' },
  { name: 'Youth & Adolescent MH', members: 53, active: '9 online', tag: 'Active' },
];

const discussionThreads = [
  { title: 'Best practices for IRB applications across multiple countries?', replies: 14, lastPost: '1h ago', category: 'Methodology', author: 'Dr. Rodriguez' },
  { title: 'Open-access publication funding sources for low-income researchers', replies: 22, lastPost: '4h ago', category: 'Funding', author: 'Dr. Okafor' },
  { title: 'Wearable device validity: which EEG products do you trust?', replies: 37, lastPost: 'Yesterday', category: 'Technology', author: 'Dr. Patel' },
  { title: 'Symposium 2026 submission deadline extension request', replies: 5, lastPost: '2d ago', category: 'Events', author: 'Prof. Whitfield' },
];

export default function CommunityPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Members', value: '277', icon: Users, color: 'forum' },
          { label: 'Countries', value: '34', icon: Globe2, color: 'slateteal' },
          { label: 'Interest Groups', value: '18', icon: Sparkles, color: 'brass' },
          { label: 'Online Now', value: '42', icon: TrendingUp, color: 'forum' },
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Users className="h-5 w-5 text-forum-600" />
                Member Directory
              </h3>
              <p className="text-xs text-ink-subtle mt-0.5">Connect with peers across the global community</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                placeholder="Search name, institution, interest..."
                className="w-full rounded-md border border-paper-border bg-paper pl-9 pr-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
              />
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-4 p-4 rounded-xl border border-paper-border hover:border-forum-200 hover:bg-forum-50/30 transition-colors">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white font-semibold">
                  {m.name.split(' ').slice(1, 2).concat(m.name.split(' ').slice(-1)).map((n) => n[0]).join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-forum-900">{m.name}</p>
                    <Badge variant={m.type === 'Scientist' ? 'default' : 'info'}>
                      {m.type === 'Scientist' ? <BookOpen className="h-2.5 w-2.5 mr-1" /> : <HeartHandshake className="h-2.5 w-2.5 mr-1" />}
                      {m.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink-muted">{m.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                    <span className="inline-flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {m.institution}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Globe2 className="h-3.5 w-3.5" />
                      {m.country}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {m.pubs} pubs
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Award className="h-3.5 w-3.5" />
                      {m.projects} projects
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.interests.map((i) => (
                      <span key={i} className="rounded-full bg-paper border border-paper-border px-2 py-0.5 text-[11px] text-ink-muted">
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Connect</span>
                  </Button>
                  <Button size="sm" variant="ghost">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Message</span>
                  </Button>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button variant="ghost" className="w-full justify-center">
                Load More Members
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brass-700" />
              Interest Groups
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Join focused discussions</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5">
            {interestGroups.map((g) => (
              <button
                key={g.name}
                className="w-full flex items-center gap-3 rounded-xl border border-paper-border p-3.5 hover:border-forum-300 hover:bg-forum-50/40 text-left transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-700">
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-forum-900 text-sm truncate">{g.name}</p>
                    <Badge variant={g.tag === 'Trending' ? 'brass' : g.tag === 'New' ? 'warning' : 'info'}>
                      {g.tag}
                    </Badge>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-ink-subtle">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{g.members}</span>
                    <span className="inline-flex items-center gap-1 text-success-600"><span className="h-1.5 w-1.5 rounded-full bg-success-600" />{g.active}</span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-ink-subtle shrink-0" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-slateteal-500" />
              Community Discussions
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Active threads from members worldwide</p>
          </div>
          <Button>
            <MessageCircle className="h-4 w-4" />
            Start Discussion
          </Button>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-paper-border">
          {discussionThreads.map((t, i) => (
            <div key={i} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4 hover:bg-forum-50/30 -mx-4 px-4 rounded-lg">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700 font-semibold">
                {t.author.split(' ').slice(1).map((n) => n[0]).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={t.category === 'Funding' ? 'brass' : t.category === 'Events' ? 'warning' : t.category === 'Technology' ? 'info' : 'default'}>
                    {t.category}
                  </Badge>
                  <span className="text-[11px] text-ink-subtle">Started by <span className="font-medium text-ink-muted">{t.author}</span></span>
                </div>
                <h4 className="mt-1.5 font-medium text-forum-900 hover:text-forum-700 cursor-pointer">
                  {t.title}
                </h4>
                <div className="mt-1.5 flex items-center gap-4 text-xs text-ink-subtle">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t.replies} replies
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {t.lastPost}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="sm">
                View Thread
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
