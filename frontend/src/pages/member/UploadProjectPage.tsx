import { useState } from 'react';
import {
  Upload,
  Send,
  HeartHandshake,
  ShieldCheck,
  DollarSign,
  FileText,
  Presentation,
  Link2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import { TextInput, TextArea, SelectInput, FileInput } from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import { useForm } from 'react-hook-form';

interface FormData {
  title: string;
  description: string;
  category: string;
  timeline: string;
  budget: string;
  supportMoral: boolean;
  supportOfficial: boolean;
  supportFunding: boolean;
}

export default function UploadProjectPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<FormData>();

  const onSubmit = (_data: FormData) =>
    new Promise((resolve) => {
      setTimeout(() => {
        setSubmitted(true);
        resolve(true);
      }, 1500);
    });

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 sm:p-12 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-100">
              <CheckCircle2 className="h-9 w-9 text-success-600" />
            </div>
            <h2 className="mt-6 font-display text-2xl font-semibold text-forum-900">
              Project Submitted Successfully
            </h2>
            <p className="mt-3 text-ink-muted">
              Your project has been received by the CRO office. You will receive a
              confirmation message in your dashboard inbox within 24 hours.
            </p>
            <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
              {[
                ['Draft Saved', 'YES'],
                ['CRO Review', 'Pending'],
                ['Support Team', 'Assigned'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-paper-border bg-paper p-4">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-subtle">{k}</p>
                  <p className="mt-1 font-semibold text-forum-900">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 flex justify-center flex-wrap gap-3">
              <Button as="link" to="/dashboard/projects" variant="outline">
                View All Projects
              </Button>
              <Button as="link" to="/dashboard/projects/upload" onClick={() => setSubmitted(false)}>
                <Upload className="h-4 w-4" />
                Upload Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categories = [
    'Clinical Research',
    'Biological Psychiatry',
    'Technology Validation',
    'Health Services',
    'Clinical Trials',
    'Occupational Mental Health',
    'Public Health Policy',
    'Neuroscience',
    'Psychotherapy Research',
    'Other',
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Project Details
              </h2>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <TextInput
                label="Project Title"
                placeholder="Descriptive, specific title for your research"
                required
                error={errors.title?.message}
                {...register('title', { required: 'Please enter a project title' })}
              />
              <SelectInput
                label="Research Category"
                required
                error={errors.category?.message}
                {...register('category', { required: 'Please select a category' })}
              >
                <option value="">Select a category...</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectInput>
              <TextArea
                label="Project Description"
                placeholder="Objectives, methodology, expected outputs, collaborators... (min 50 characters)"
                rows={6}
                required
                hint="Include research questions, study design, and expected impact"
                error={errors.description?.message}
                {...register('description', { required: 'Please provide a project description' })}
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextInput
                  label="Project Timeline"
                  placeholder="e.g. Jan 2026 – Dec 2026 (12 months)"
                  required
                  error={errors.timeline?.message}
                  {...register('timeline', { required: 'Please specify the timeline' })}
                />
                <TextInput
                  label="Budget (if applicable)"
                  placeholder="Total budget in USD or N/A"
                  error={errors.budget?.message}
                  {...register('budget')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-slateteal-500" />
                Support Type Needed
              </h2>
              <p className="text-xs text-ink-subtle mt-0.5">
                Select all that apply. You can request multiple types of support.
              </p>
            </CardHeader>
            <CardContent className="pt-0 grid gap-3 sm:grid-cols-3">
              {[
                { key: 'supportMoral', icon: HeartHandshake, title: 'Moral Support', desc: 'Peer mentorship, community, encouragement' },
                { key: 'supportOfficial', icon: ShieldCheck, title: 'Official Support', desc: 'Institutional endorsement, credibility' },
                { key: 'supportFunding', icon: DollarSign, title: 'Funding Support', desc: 'Grants, connections, budget guidance' },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <label
                    key={s.key}
                    className={`relative rounded-xl border p-5 cursor-pointer transition-all ${
                      'peer-checked:border-forum-600 bg-paper hover:border-forum-200 border-paper-border'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      {...register(s.key as 'supportMoral' | 'supportOfficial' | 'supportFunding')}
                    />
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-forum-50 text-forum-700 peer-checked:bg-forum-600 peer-checked:text-white transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-forum-900 text-sm">{s.title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted leading-snug">{s.desc}</p>
                      </div>
                    </div>
                  </label>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-brass-700" />
                File Uploads
              </h2>
              <p className="text-xs text-ink-subtle mt-0.5">
                All standard document and presentation formats supported.
              </p>
            </CardHeader>
            <CardContent className="pt-0 grid gap-5 sm:grid-cols-2">
              <FileInput
                label="Project Documents"
                accept=".pdf,.doc,.docx"
                hint="PDF, DOC, DOCX — Protocol, IRB, manuscript drafts"
              />
              <FileInput
                label="Presentation (optional)"
                accept=".ppt,.pptx,.pdf"
                hint="PPT, PPTX, PDF — Deck, poster, symposium materials"
              />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-ink">
                  Additional Resources / Links
                </label>
                <div className="rounded-md border border-dashed border-paper-border bg-paper p-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
                        <input
                          type="url"
                          placeholder="https://... (OSF preregistration, datasets, GitHub)"
                          className="w-full rounded-md border border-paper-border bg-paper-raised pl-9 pr-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
                        />
                      </div>
                      <Button type="button" variant="outline" size="sm">Add</Button>
                    </div>
                    <p className="text-xs text-ink-subtle pl-1">
                      Paste any relevant URLs above (preregistrations, repositories, supplementary materials).
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row justify-end gap-3">
            <Button type="button" variant="outline" size="lg">
              Save Draft
            </Button>
            <Button type="submit" size="lg" disabled={isSubmitting}>
              <Send className="h-4.5 w-4.5" />
              {isSubmitting ? 'Submitting...' : 'Submit Project'}
            </Button>
          </div>
        </form>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-forum-900 flex items-center gap-2">
              <Presentation className="h-4.5 w-4.5 text-brass-700" />
              Submission Checklist
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5 text-sm">
            {[
              'Title clearly describes research scope',
              'Category matches subject matter',
              'Detailed methodology provided',
              'Timeline and milestones defined',
              'Relevant documents attached',
              'Support types selected appropriately',
            ].map((item, i) => (
              <label key={i} className="flex gap-2 items-start cursor-pointer group">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-paper-border text-forum-600 focus:ring-forum-600" />
                <span className="text-ink-muted group-hover:text-ink transition-colors">{item}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-forum-900 flex items-center gap-2">
              <Badge variant="brass">Tip</Badge>
              Review Timeline
            </h3>
          </CardHeader>
          <CardContent className="pt-0 space-y-3 text-sm text-ink-muted">
            {[
              ['0-24h', 'Acknowledgement & CRO assignment'],
              ['3-5 days', 'Initial feasibility screening'],
              ['5-10 days', 'Full committee review'],
              ['Day 10+', 'Decision + support allocation'],
            ].map(([t, d]) => (
              <div key={t} className="flex gap-3">
                <span className="font-mono text-[11px] font-bold text-brass-700 whitespace-nowrap pt-0.5">{t}</span>
                <span>{d}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
