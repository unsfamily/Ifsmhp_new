import { useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  Send,
  Video,
  Link2,
  Search,
  Filter,
  Folder,
  Inbox,
  ArrowUpCircle,
  Calendar,
  User,
  Clock,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput, TextArea, TextInput } from '../../components/common/Input';

interface Doc {
  id: string;
  name: string;
  type: 'PDF' | 'DOC' | 'PPT' | 'Video' | 'Link';
  size: string;
  sender: string;
  direction: 'incoming' | 'outgoing';
  date: string;
  project?: string;
  note?: string;
}

const documents: Doc[] = [
  { id: 'd1', name: 'IFSMHP-Endorsement-Chen-Biomarker-2026.pdf', type: 'PDF', size: '284 KB', sender: 'CRO Office', direction: 'incoming', date: 'Aug 15, 2026', project: 'Biomarker Panels for MDD', note: 'Official endorsement letter' },
  { id: 'd2', name: 'Reviewer-Comments-Summary.docx', type: 'DOC', size: '42 KB', sender: 'CRO Office', direction: 'incoming', date: 'Aug 15, 2026', project: 'Biomarker Panels for MDD' },
  { id: 'd3', name: 'CRO-Office-Hours-August-2026.mp4', type: 'Video', size: '284 MB', sender: 'Chief Research Officer', direction: 'incoming', date: 'Aug 03, 2026', note: 'Monthly Q&A recording' },
  { id: 'd4', name: 'Biomarker-Study-Full-Proposal-v3.pdf', type: 'PDF', size: '4.2 MB', sender: 'Dr. Sarah Chen (You)', direction: 'outgoing', date: 'Jul 08, 2026', project: 'Biomarker Panels for MDD' },
  { id: 'd5', name: 'Wearable-EEG-Validation-Presentation.pptx', type: 'PPT', size: '7.8 MB', sender: 'Dr. Sarah Chen (You)', direction: 'outgoing', date: 'Jun 30, 2026', project: 'EEG Device Validation' },
  { id: 'd6', name: 'Symposium-Preview-2026 (YouTube Link)', type: 'Link', size: '—', sender: 'CRO Events Office', direction: 'incoming', date: 'Aug 14, 2026', note: 'Keynote invitation preview' },
  { id: 'd7', name: 'Grant-Guidelines-2026-Round3.pdf', type: 'PDF', size: '1.1 MB', sender: 'Grants Office', direction: 'incoming', date: 'Aug 08, 2026', note: 'New matched-funding opportunity' },
];

const typeIcon = { PDF: FileText, DOC: FileText, PPT: FileText, Video: Video, Link: Link2 };
const typeColor = {
  PDF: 'bg-danger-100 text-danger-600',
  DOC: 'bg-forum-50 text-forum-700',
  PPT: 'bg-brass-100 text-brass-700',
  Video: 'bg-slateteal-100 text-slateteal-700',
  Link: 'bg-forum-50 text-forum-700',
};

export default function DocumentExchangePage() {
  const [tab, setTab] = useState<'inbox' | 'send'>('inbox');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = documents.filter((d) => {
    if (tab === 'inbox' && d.direction !== 'incoming') return false;
    if (tab === 'send' && d.direction !== 'outgoing') return false;
    if (filter !== 'All' && d.type !== filter) return false;
    if (search && !d.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex border-b border-paper-border">
            <button
              type="button"
              onClick={() => setTab('inbox')}
              className={`flex-1 px-4 sm:px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'inbox' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Inbox className="h-4 w-4 inline mr-1.5" />
              Inbox from CRO
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-white">
                {documents.filter((d) => d.direction === 'incoming').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('send')}
              className={`flex-1 px-4 sm:px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'send' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <ArrowUpCircle className="h-4 w-4 inline mr-1.5" />
              Send to CRO
            </button>
          </div>

          {tab === 'inbox' ? (
            <div className="p-5 sm:p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-subtle" />
                  <input
                    type="text"
                    placeholder="Search documents..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-md border border-paper-border bg-paper pl-9 pr-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
                  />
                </div>
                <SelectInput
                  label={<span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" />Type</span>}
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="sm:mb-0"
                >
                  <option value="All">All Types</option>
                  <option value="PDF">PDF</option>
                  <option value="DOC">DOC / DOCX</option>
                  <option value="PPT">PPT / PPTX</option>
                  <option value="Video">Video</option>
                  <option value="Link">Links</option>
                </SelectInput>
              </div>

              <div className="divide-y divide-paper-border rounded-xl border border-paper-border">
                {filtered.map((d) => {
                  const TIcon = typeIcon[d.type];
                  return (
                    <div key={d.id} className="p-4 sm:p-5 hover:bg-forum-50/30 transition-colors">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-lg ${typeColor[d.type]}`}>
                          <TIcon className="h-5.5 w-5.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={d.type === 'Video' ? 'info' : d.type === 'Link' ? 'default' : d.type === 'PDF' ? 'brass' : 'default'}>
                                  {d.type}
                                </Badge>
                                <span className="text-xs text-ink-subtle">{d.size}</span>
                              </div>
                              <p className="mt-1.5 font-medium text-forum-900 truncate">{d.name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors" title="Preview">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-forum-50 hover:text-forum-700 transition-colors" title="Download">
                                <Download className="h-4 w-4" />
                              </button>
                              <Button size="sm" variant="ghost">
                                <Download className="h-4 w-4" />
                                <span className="hidden sm:inline">Download</span>
                              </Button>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              From: {d.sender}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5" />
                              {d.date}
                            </span>
                            {d.project && (
                              <span className="inline-flex items-center gap-1.5">
                                <Folder className="h-3.5 w-3.5" />
                                {d.project}
                              </span>
                            )}
                          </div>
                          {d.note && (
                            <p className="mt-2 text-xs text-ink-muted bg-paper rounded-md border border-paper-border px-3 py-2">
                              <MessageSquare className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                              {d.note}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="p-10 text-center text-sm text-ink-subtle">
                    <Folder className="mx-auto h-10 w-10 mb-3" />
                    No documents match your filters.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-6 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <SelectInput label="Send to" defaultValue="cro">
                    <option value="cro">Chief Research Officer (CRO)</option>
                    <option value="grants">Grants Office</option>
                    <option value="events">Events & Symposia Office</option>
                    <option value="publications">Publications Committee</option>
                    <option value="support">Member Support Team</option>
                  </SelectInput>
                </div>
                <div className="sm:col-span-2">
                  <TextInput label="Subject / Reference" placeholder="e.g. Biomarker Study — Revised IRB Documentation" />
                </div>
                <div className="sm:col-span-2">
                  <TextArea label="Message (optional)" placeholder="Include any context, questions, or instructions for the recipient..." rows={4} />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-ink">Attachments</label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border-2 border-dashed border-forum-600/30 bg-forum-50/40 p-5 text-center">
                      <Upload className="h-7 w-7 text-forum-700 mx-auto" />
                      <p className="mt-2 text-xs font-medium text-forum-900">Documents</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">PDF, DOC, DOCX</p>
                    </div>
                    <div className="rounded-xl border-2 border-dashed border-paper-border bg-paper p-5 text-center hover:border-brass-500/30 transition-colors cursor-pointer">
                      <Folder className="h-7 w-7 text-ink-subtle mx-auto" />
                      <p className="mt-2 text-xs font-medium text-ink-muted">Presentations</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">PPT, PPTX</p>
                    </div>
                    <div className="rounded-xl border-2 border-dashed border-paper-border bg-paper p-5 text-center hover:border-slateteal-500/30 transition-colors cursor-pointer">
                      <Link2 className="h-7 w-7 text-ink-subtle mx-auto" />
                      <p className="mt-2 text-xs font-medium text-ink-muted">Video / Links</p>
                      <p className="mt-0.5 text-[11px] text-ink-subtle">YouTube, Vimeo, URLs</p>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-ink-subtle">
                    Or drag and drop files here. Max 50MB per file.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-paper-border bg-paper p-4">
                <h4 className="font-semibold text-sm text-forum-900 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-brass-700" />
                  Response Times
                </h4>
                <ul className="mt-2 grid gap-1.5 text-xs text-ink-muted sm:grid-cols-3">
                  <li>• Documents: within 2 business days</li>
                  <li>• Video links: within 3 business days</li>
                  <li>• Urgent: mark subject line [URGENT]</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" size="lg">
                  Save Draft
                </Button>
                <Button size="lg">
                  <Send className="h-4.5 w-4.5" />
                  Send to CRO
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
