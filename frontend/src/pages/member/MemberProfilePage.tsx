import {
  Mail,
  IdCard,
  Briefcase,
  GraduationCap,
  Lightbulb,
  FileText,
  Phone,
  MapPin,
  Link as LinkIcon,
  Edit3,
  Upload,
  Award,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';

const publications = [
  { id: '1', title: 'CBT Outcomes in Digital Platforms: Meta-Analysis', venue: 'J Clin Psychiatry', year: 2026 },
  { id: '2', title: 'Youth Telehealth Service Utilization', venue: 'Intl J Mental Health Systems', year: 2025 },
  { id: '3', title: 'Mindfulness RCT in Adolescent Populations', venue: 'Psychol Med', year: 2025 },
  { id: '4', title: 'Burnout Markers in Clinician Workforce', venue: 'Front Psych', year: 2024 },
];

export default function MemberProfilePage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-forum-100 ring-4 ring-brass-500/20 text-forum-700">
                <span className="font-display text-3xl font-bold">DS</span>
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-forum-600 text-white shadow-md hover:bg-forum-700 transition-colors"
                aria-label="Upload photo"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0 w-full">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-2xl font-semibold text-forum-900">
                      Dr. Sarah A. Chen, PhD
                    </h2>
                    <Badge variant="brass">
                      <Award className="h-2.5 w-2.5 mr-1" />
                      Verified Member
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-4 w-4 text-forum-600" />
                      Associate Professor, Clinical Psychology
                    </span>
                    <span className="flex items-center gap-1.5">
                      <IdCard className="h-4 w-4 text-brass-700 font-bold" />
                      <span className="font-mono font-semibold text-brass-700">IFSMHP-00142</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="h-4 w-4 text-slateteal-500" />
                      Stanford University
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-ink-muted">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-4 w-4" />
                      sarah.chen@stanford.edu
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4" />
                      +1 (650) 555-0142
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      San Francisco, CA · USA
                    </span>
                  </div>
                </div>
                <Button variant="primary">
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-4">
                {[
                  { label: 'Member Since', value: 'Mar 2024' },
                  { label: 'Projects', value: '7' },
                  { label: 'Publications', value: '4' },
                  { label: 'Support Requests', value: '2' },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-paper-border bg-paper p-4">
                    <p className="text-xs text-ink-subtle uppercase tracking-wide">{s.label}</p>
                    <p className="mt-1 font-display text-xl font-semibold text-forum-900">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-forum-600" />
              Education & Qualifications
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-5">
            {[
              { degree: 'PhD in Clinical Psychology', school: 'Stanford University', year: '2020', detail: 'Dissertation: Cognitive biases in treatment-seeking populations' },
              { degree: 'M.A. in Clinical Psychology', school: 'Columbia University', year: '2016', detail: 'Thesis: Digital mental health intervention efficacy' },
              { degree: 'B.Sc. Psychology (Hons)', school: 'UC Berkeley', year: '2014', detail: 'Summa Cum Laude' },
              { degree: 'Licensed Clinical Psychologist', school: 'California Board of Psychology', year: '2022', detail: 'License #PSY-12345' },
            ].map((ed, i) => (
              <div key={i} className="flex gap-4">
                <div className="relative">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forum-50 text-forum-700 ring-4 ring-paper-raised z-10">
                    <Award className="h-4 w-4" />
                  </div>
                  {i < 3 && <div className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-paper-border" />}
                </div>
                <div className="flex-1 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-forum-900">{ed.degree}</p>
                      <p className="text-sm text-ink-muted">{ed.school}</p>
                    </div>
                    <Badge variant="brass">{ed.year}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-subtle">{ed.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-slateteal-500" />
              Research Interests
            </h3>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {[
                'Digital Mental Health',
                'Cognitive Behavioral Therapy',
                'Treatment-Resistant Depression',
                'Meta-Analysis Methods',
                'Adolescent Mental Health',
                'Mindfulness Interventions',
                'Healthcare Disparities',
                'Digital Phenotyping',
                'Clinical Trial Design',
                'Predictive Modeling',
                'Burnout Prevention',
                'Telehealth Policy',
              ].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-slateteal-100 px-3 py-1 text-xs font-medium text-slateteal-700"
                >
                  {t}
                </span>
              ))}
            </div>

            <h4 className="mt-6 mb-3 font-semibold text-forum-900 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-forum-600" />
              Professional Links
            </h4>
            <div className="space-y-2">
              {[
                { label: 'Google Scholar', url: 'scholar.google.com/...' },
                { label: 'ORCID', url: '0000-0002-1825-0097' },
                { label: 'ResearchGate', url: 'researchgate.net/Sarah_Chen' },
                { label: 'Institutional Profile', url: 'stanford.edu/people/sarah-chen' },
              ].map((l) => (
                <div
                  key={l.label}
                  className="flex items-center justify-between rounded-lg border border-paper-border bg-paper px-4 py-2.5 hover:border-forum-200 transition-colors"
                >
                  <span className="text-sm font-medium text-forum-900">{l.label}</span>
                  <a href="#" className="text-xs text-forum-700 hover:text-forum-900 truncate max-w-[180px]">
                    {l.url}
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-forum-600" />
              Publications List
            </h3>
            <p className="text-xs text-ink-subtle mt-0.5">Your IFSMHP-hosted and external publications</p>
          </div>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4" />
            Add Publication
          </Button>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-paper-border">
          {publications.map((p) => (
            <div key={p.id} className="py-4 first:pt-0 last:pb-0 flex items-start gap-4">
              <Badge variant="brass">{p.year}</Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-forum-900 leading-snug">{p.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{p.venue}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">View</span>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
