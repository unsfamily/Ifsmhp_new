import { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  Clock,
  User,
  Globe2,
  FileText,
  Send,
  Eye,
  History,
  MessageSquare,
  ChevronDown,
  BookOpenCheck,
  Ban,
  Calendar,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';

interface PublicationFile {
  id: string;
  name: string;
  kind: string;
  size: string;
  pages?: number;
}

interface PublicationReview {
  by: string;
  at: string;
  decision: string;
  comment: string;
}

interface PublicationHistory {
  at: string;
  by: string;
  from: string | null;
  to: string;
  note: string;
}

interface MockPublication {
  title: string;
  abstract: string;
  fullText: string;
  author: string;
  memberId: string;
  institution: string;
  category: string;
  researchType: string;
  status: string;
  submittedAt: string;
  views: number;
  slug: string;
  publishedAt: string | null;
  files: PublicationFile[];
  reviews: PublicationReview[];
  history: PublicationHistory[];
}

const mock: Record<string, MockPublication> = {
  pub3: {
    title: 'Evaluating Commercial Wearable EEG Devices: Scientific Validity and Clinical Correlates',
    abstract: 'Objective: To assess the concurrent validity of three leading consumer EEG wearables against research-grade systems in a sample of 48 healthy adults during resting state and three cognitive tasks (N-back, emotional Stroop, meditation). Primary outcome: intraclass correlation coefficients (ICCs) for frontal alpha asymmetry, P300 amplitude, and frontal theta power. Secondary: signal quality metrics, artifact rates, user burden.',
    fullText: '…full text excerpt: 3,200 words rendered here…',
    author: 'Dr. Theo Mbeki',
    memberId: 'IFSMHP-2024-000198',
    institution: 'University of the Witwatersrand, South Africa',
    category: 'Technology Validation',
    researchType: 'Validation Study',
    status: 'Under Review',
    submittedAt: 'Aug 12, 2026 10:44',
    views: 68,
    slug: 'wearable-eeg-validation-2026',
    publishedAt: null,
    files: [
      { id: 'f1', name: 'Manuscript.pdf', kind: 'MANUSCRIPT_PDF', size: '1.9 MB', pages: 24 },
      { id: 'f2', name: 'Supplemental_Materials.zip', kind: 'SUPPORTING', size: '3.4 MB' },
      { id: 'f3', name: 'Raw_Data_Dictionary.pdf', kind: 'SUPPORTING', size: '280 KB' },
    ],
    reviews: [
      { by: 'Initial QA (automated)', at: 'Aug 12, 10:45', decision: 'Pass', comment: 'Format OK · Plagiarism check: 3% overlap · Ethical statement: present · Conflict disclosure: present' },
    ],
    history: [
      { at: 'Aug 12, 2026 10:44', by: 'Dr. T. Mbeki', from: null, to: 'Submitted', note: 'Manuscript v1 submitted with 3 attachments' },
      { at: 'Aug 12, 2026 10:45', by: 'System', from: 'Submitted', to: 'Under Review', note: 'Assigned to CRO review queue' },
    ],
  },
};

export default function AdminPublicationDetailPage() {
  const { id } = useParams();
  const pub = mock[id!] ?? mock['pub3']!;
  const [action, setAction] = useState<null | 'approve' | 'publish' | 'reject' | 'unpublish'>(null);
  const [comments, setComments] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link to="/admin/publications" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700">
          <ArrowLeft className="h-4 w-4" />
          Back to Publications Queue
        </Link>
        <div className="flex flex-wrap gap-2">
          <Badge variant={pub.status === 'Under Review' ? 'warning' : pub.status === 'Approved' ? 'success' : pub.status === 'Published' ? 'brass' : 'info'} className="!py-1">
            <Clock className="h-2.5 w-2.5 mr-1" />
            {pub.status}
          </Badge>
          {pub.status === 'Published' && (
            <Badge variant="success" className="!py-1">
              <Globe2 className="h-2.5 w-2.5 mr-1" />
              Public
            </Badge>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="bg-gradient-to-br from-forum-50 via-paper to-brass-100/50 rounded-t-xl border-b border-paper-border sm:p-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge variant="brass">{pub.category}</Badge>
                <Badge variant="info">{pub.researchType}</Badge>
                <span className="text-xs text-ink-subtle inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Submitted {pub.submittedAt}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold text-forum-900 leading-tight">
                {pub.title}
              </h1>
              <div className="mt-4 flex items-center gap-3 text-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold shrink-0">
                  {pub.author.split(' ').slice(1, 2).concat(pub.author.split(' ').slice(-1)).map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium text-forum-900">{pub.author} · <code className="font-mono text-[11px] bg-forum-50 text-forum-700 px-1.5 py-0.5 rounded">{pub.memberId}</code></p>
                  <p className="text-ink-subtle text-xs">{pub.institution}</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {pub.status === 'Under Review' && (
                <Button variant="primary" size="sm" onClick={() => setAction('approve')}>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Submission
                </Button>
              )}
              {pub.status === 'Approved' && (
                <Button size="sm" className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500" onClick={() => setAction('publish')}>
                  <Globe2 className="h-4 w-4" />
                  Publish Now
                </Button>
              )}
              {pub.status === 'Published' && (
                <Button variant="outline" size="sm" className="border-warning-600/40 text-warning-700 hover:bg-warning-100" onClick={() => setAction('unpublish')}>
                  <Ban className="h-4 w-4" />
                  Unpublish
                </Button>
              )}
              {(pub.status === 'Under Review' || pub.status === 'Submitted') && (
                <Button variant="outline" size="sm" className="border-danger-600/30 text-danger-600 hover:bg-danger-100" onClick={() => setAction('reject')}>
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-forum-600" />
                Abstract
              </h3>
              <Button variant="ghost" size="sm" as="link" to={pub.status === 'Published' ? `/research/${pub.slug}` : '#'}>
                <BookOpenCheck className="h-3.5 w-3.5" />
                View Public Page
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink leading-relaxed">{pub.abstract}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <Download className="h-5 w-5 text-brass-700" />
                Submitted Files ({pub.files.length})
              </h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {pub.files.map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border border-paper-border hover:bg-forum-50/40">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-brass-100 text-brass-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-forum-900 truncate">{f.name}</p>
                      <p className="text-xs text-ink-subtle">{f.kind} · {f.size}{f.pages ? ` · ${f.pages} pages` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button className="inline-flex items-center gap-1 rounded-md bg-forum-50 px-2.5 py-1 text-xs font-semibold text-forum-700 hover:bg-forum-600 hover:text-white transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                      Read
                    </button>
                    <button className="inline-flex items-center gap-1 rounded-md border border-paper-border px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-paper transition-colors">
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {action && (
            <Card className={
              action === 'approve' ? 'border-success-600/30 ring-2 ring-success-100'
              : action === 'publish' ? 'border-brass-500/30 ring-2 ring-brass-100'
              : action === 'reject' ? 'border-danger-600/30 ring-2 ring-danger-100'
              : 'border-warning-600/30 ring-2 ring-warning-100'
            }>
              <CardHeader className={
                action === 'approve' ? 'bg-success-100/60 rounded-t-lg'
                : action === 'publish' ? 'bg-brass-100/60 rounded-t-lg'
                : action === 'reject' ? 'bg-danger-100/60 rounded-t-lg'
                : 'bg-warning-100/60 rounded-t-lg'
              }>
                <h3 className="font-display text-lg font-semibold flex items-center gap-2" style={{ color: action === 'approve' ? '#1F6B41' : action === 'publish' ? '#3F7825' : action === 'reject' ? '#A32B2B' : '#8A6212' }}>
                  {action === 'approve' ? <CheckCircle2 className="h-5 w-5" /> : action === 'publish' ? <Globe2 className="h-5 w-5" /> : action === 'reject' ? <XCircle className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                  {action === 'approve' ? 'Confirm Approval (Internal)' : action === 'publish' ? 'Confirm Publication (Public)' : action === 'reject' ? 'Confirm Rejection' : 'Confirm Unpublishing'}
                </h3>
              </CardHeader>
              <CardContent className="pt-0">
                {action === 'publish' && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-4 text-xs mb-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">URL slug (auto-generated)</label>
                      <code className="mt-1 block text-sm font-mono bg-forum-50 text-forum-700 px-2.5 py-2 rounded-lg">/research/{pub.slug ?? 'auto-generated-at-submit'}</code>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">Publication Date</label>
                      <p className="mt-1 text-sm font-medium text-ink">Today · Immediately visible on public site</p>
                    </div>
                  </div>
                )}
                {action === 'unpublish' && (
                  <div className="my-4 p-4 rounded-lg border border-warning-600/30 bg-warning-100/40">
                    <p className="text-sm text-warning-700 font-medium flex items-start gap-2">
                      <Ban className="h-5 w-5 shrink-0 mt-0.5" />
                      Unpublishing removes the publication from all public queries, the research listing, and the PDF endpoint immediately. The manuscript is retained and can be re-published. An audit entry is created.
                    </p>
                  </div>
                )}
                <TextArea
                  rows={5}
                  placeholder={action === 'reject' ? 'Required: specific reason for rejection. Visible to the submitting member.' : action === 'approve' ? 'Reviewer comments (optional). These comments will be visible to the member as part of the "approved" notification.' : action === 'publish' ? 'Public-facing editor note (optional).' : 'Reason for unpublishing (for audit log and author notification).'}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="mt-4"
                />
                <div className="mt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                  {action === 'approve' && (
                    <Button variant="primary" className="bg-success-600 hover:bg-success-600/90">
                      <CheckCircle2 className="h-4 w-4" />
                      Approve (stays in internal queue)
                    </Button>
                  )}
                  {action === 'publish' && (
                    <Button className="bg-brass-500 hover:bg-brass-700 focus-visible:ring-brass-500">
                      <Globe2 className="h-4 w-4" />
                      Publish to Public Site
                    </Button>
                  )}
                  {action === 'reject' && (
                    <Button variant="primary" className="bg-danger-600 hover:bg-danger-600/90">
                      <Send className="h-4 w-4" />
                      Reject &amp; Notify Author
                    </Button>
                  )}
                  {action === 'unpublish' && (
                    <Button variant="primary" className="bg-warning-600 hover:bg-warning-600/90">
                      <Ban className="h-4 w-4" />
                      Unpublish Immediately
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-display text-lg font-semibold text-forum-900 flex items-center gap-2">
                <History className="h-5 w-5 text-slateteal-500" />
                Review History &amp; Status Timeline
              </h3>
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                <MessageSquare className="h-3.5 w-3.5" />
                Message Author
              </Button>
            </CardHeader>
            <CardContent className="pt-0 space-y-5">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-ink-subtle mb-3">Review Comments</h4>
                <div className="space-y-2">
                  {pub.reviews.map((r, i) => (
                    <div key={i} className="border border-paper-border rounded-lg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-medium text-ink">
                          {r.by} · <span className="text-ink-subtle">{r.at}</span>
                        </p>
                        <Badge variant={r.decision === 'Pass' ? 'success' : 'warning'}>{r.decision}</Badge>
                      </div>
                      <p className="text-sm text-ink-muted">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
              <ol className="relative border-l border-paper-border ml-2.5 pl-5 space-y-4">
                {pub.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[26px] top-0.5 h-4 w-4 rounded-full ring-4 ring-paper-raised ${
                      h.to === 'Submitted' ? 'bg-forum-600' : h.to === 'Published' ? 'bg-brass-500' : h.to === 'Approved' ? 'bg-success-600' : h.to === 'Rejected' ? 'bg-danger-600' : 'bg-slateteal-500'
                    }`} />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <p className="text-sm font-medium text-forum-900">
                        {h.from && <span className="text-ink-subtle font-normal">{h.from} → </span>}
                        <strong>{h.to}</strong>
                      </p>
                      <span className="text-[11px] text-ink-subtle">{h.at} · by {h.by}</span>
                    </div>
                    <p className="text-sm text-ink-muted mt-0.5">{h.note}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Publication Stats</h3>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-ink-subtle">Admin Views</span><span className="font-semibold text-ink">{pub.views}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Files Attached</span><span className="font-semibold text-ink">{pub.files.length}</span></div>
              <div className="flex justify-between"><span className="text-ink-subtle">Total File Size</span><span className="font-semibold text-ink">5.6 MB</span></div>
              {pub.publishedAt && (
                <div className="flex justify-between pt-2 mt-2 border-t border-paper-border"><span className="text-ink-subtle">Published</span><span className="font-semibold text-forum-700">{pub.publishedAt}</span></div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900">Shortcut Actions</h3>
            </CardHeader>
            <CardContent className="pt-0 grid grid-cols-2 gap-2">
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-forum-50 text-forum-700 hover:bg-forum-600 hover:text-white transition-colors">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Approve</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-brass-100 text-brass-700 hover:bg-brass-500 hover:text-white transition-colors">
                <Globe2 className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Publish</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border bg-slateteal-100 text-slateteal-700 hover:bg-slateteal-500 hover:text-white transition-colors">
                <MessageSquare className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Contact Author</span>
              </button>
              <button className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-paper-border text-ink-muted hover:bg-paper transition-colors">
                <Download className="h-5 w-5" />
                <span className="text-xs font-semibold text-center leading-tight">Download All</span>
              </button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-display text-base font-semibold text-forum-900 flex items-center gap-2">
                <User className="h-4.5 w-4.5 text-forum-600" />
                Author Profile
              </h3>
            </CardHeader>
            <CardContent className="pt-0">
              <Link to={`/admin/members/lookup?mid=${pub.memberId}`} className="flex items-center gap-3 p-3 rounded-lg border border-paper-border hover:bg-forum-50/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 text-white text-xs font-bold shrink-0">
                  {pub.author.split(' ').slice(1, 2).concat(pub.author.split(' ').slice(-1)).map((n: string) => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-forum-900 truncate">{pub.author}</p>
                  <p className="text-[11px] text-ink-subtle font-mono truncate">{pub.memberId}</p>
                </div>
                <Eye className="h-4 w-4 text-ink-subtle shrink-0" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
