import { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Search,
  Filter,
  Download,
  Eye,
  Inbox,
  ArrowUpCircle,
  ArrowDownCircle,
  Clock,
  Loader2,
  RotateCcw,
  AlertCircle,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { SelectInput } from '../../components/common/Input';
import { memberApi, type MemberDocument } from '../../api/member';
import { downloadAttachment, openAttachmentInTab } from '../../api/messaging';
import { normalizeError } from '../../api/client';
import { useApiData } from '../../hooks/useApiData';
import { formatBytes } from '../../utils/formatBytes';

/** Buckets the raw MIME type into the categories the filter offers. */
function docKind(mimeType: string, name: string): 'PDF' | 'DOC' | 'SHEET' | 'SLIDES' | 'IMAGE' | 'FILE' {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (mimeType === 'application/pdf' || extension === 'pdf') return 'PDF';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (['doc', 'docx'].includes(extension)) return 'DOC';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'SHEET';
  if (['ppt', 'pptx'].includes(extension)) return 'SLIDES';
  return 'FILE';
}

const kindIcon = {
  PDF: FileText,
  DOC: FileText,
  SHEET: FileSpreadsheet,
  SLIDES: FileText,
  IMAGE: ImageIcon,
  FILE: FileText,
} as const;

const kindColor = {
  PDF: 'bg-brass-100 text-brass-700',
  DOC: 'bg-forum-50 text-forum-700',
  SHEET: 'bg-success-100 text-success-600',
  SLIDES: 'bg-slateteal-100 text-slateteal-700',
  IMAGE: 'bg-slateteal-100 text-slateteal-700',
  FILE: 'bg-forum-50 text-forum-700',
} as const;

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function DocumentExchangePage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [direction, setDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fed entirely by chat attachments — the server builds this from the messages
  // the member takes part in, excluding admin-only internal notes.
  const { data, loading, error } = useApiData(() => memberApi.documents({ limit: 100 }), [reloadKey]);
  const documents: MemberDocument[] = data?.items ?? [];

  const refresh = () => setReloadKey((k) => k + 1);

  const filtered = documents.filter((d) => {
    if (direction !== 'all' && d.direction !== direction) return false;
    if (filter !== 'All' && docKind(d.type, d.name) !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return d.name.toLowerCase().includes(s) || d.note.toLowerCase().includes(s) || d.sender.toLowerCase().includes(s);
    }
    return true;
  });

  const incoming = documents.filter((d) => d.direction === 'incoming').length;

  const run = async (doc: MemberDocument, action: 'view' | 'download') => {
    setBusyId(doc.id);
    setActionError(null);
    try {
      if (action === 'view') await openAttachmentInTab(doc.id);
      else await downloadAttachment(doc.id, doc.name);
    } catch (err) {
      setActionError(normalizeError(err).message || `Could not ${action} that file.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forum-900">Document Exchange</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every file exchanged with the Chief Research Office, gathered from your conversations.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4">
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex border-b border-paper-border">
            <button
              type="button"
              onClick={() => setDirection(direction === 'incoming' ? 'all' : 'incoming')}
              className={`flex-1 px-4 sm:px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                direction === 'incoming' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <Inbox className="h-4 w-4 inline mr-1.5" />
              From CRO
              {incoming > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-white">
                  {incoming}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDirection(direction === 'outgoing' ? 'all' : 'outgoing')}
              className={`flex-1 px-4 sm:px-6 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                direction === 'outgoing' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              <ArrowUpCircle className="h-4 w-4 inline mr-1.5" />
              Sent by you
            </button>
          </div>

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
                <option value="SHEET">Spreadsheets</option>
                <option value="SLIDES">Presentations</option>
                <option value="IMAGE">Images</option>
              </SelectInput>
            </div>

            {loading ? (
              <div className="py-16 flex flex-col items-center gap-3">
                <Loader2 className="h-7 w-7 animate-spin text-forum-600" />
                <p className="text-sm text-ink-muted">Loading documents…</p>
              </div>
            ) : error ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="h-12 w-12 flex items-center justify-center rounded-full bg-danger-100 text-danger-600"><AlertCircle className="h-6 w-6" /></div>
                <p className="text-sm font-semibold text-forum-900">Couldn't load your documents</p>
                <p className="text-xs text-ink-muted max-w-sm">{error}</p>
                <Button size="sm" variant="outline" onClick={refresh}><RotateCcw className="h-3.5 w-3.5" />Try again</Button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 flex flex-col items-center gap-3 text-center">
                <div className="h-14 w-14 flex items-center justify-center rounded-2xl bg-forum-50 text-forum-700"><FileText className="h-7 w-7" /></div>
                <p className="text-base font-semibold text-forum-900">
                  {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
                </p>
                <p className="text-sm text-ink-muted max-w-sm">
                  {documents.length === 0
                    ? 'Files appear here once you or the CRO attach them to a message.'
                    : 'Try clearing the search or type filter.'}
                </p>
                {documents.length === 0 && (
                  <Button as="link" to="/dashboard/messages" size="sm" variant="primary">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Go to Messages
                  </Button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-paper-border rounded-xl border border-paper-border">
                {filtered.map((d) => {
                  const kind = docKind(d.type, d.name);
                  const TIcon = kindIcon[kind];
                  const busy = busyId === d.id;
                  return (
                    <div key={`${d.id}-${d.date}`} className="p-4 sm:p-5 hover:bg-forum-50/30 transition-colors">
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`h-11 w-11 shrink-0 flex items-center justify-center rounded-lg ${kindColor[kind]}`}>
                          <TIcon className="h-5.5 w-5.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={kind === 'PDF' ? 'brass' : kind === 'IMAGE' ? 'info' : 'default'}>{kind}</Badge>
                                <span className="text-xs text-ink-subtle">{formatBytes(d.size)}</span>
                                <Badge variant={d.direction === 'incoming' ? 'info' : 'default'} className="!text-[10px]">
                                  {d.direction === 'incoming'
                                    ? <><ArrowDownCircle className="h-2.5 w-2.5 mr-1" />From CRO</>
                                    : <><ArrowUpCircle className="h-2.5 w-2.5 mr-1" />Sent</>}
                                </Badge>
                              </div>
                              <p className="mt-1.5 font-medium text-forum-900 truncate" title={d.name}>{d.name}</p>
                              <p className="mt-0.5 text-xs text-ink-muted line-clamp-2">{d.note}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-subtle">
                                <span>{d.sender}</span>
                                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{formatDate(d.date)}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                aria-label={`Preview ${d.name}`}
                                disabled={busy}
                                onClick={() => void run(d, 'view')}
                                className="rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-700 disabled:opacity-50"
                              >
                                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                              </button>
                              <button
                                type="button"
                                aria-label={`Download ${d.name}`}
                                disabled={busy}
                                onClick={() => void run(d, 'download')}
                                className="rounded-md p-2 text-ink-muted hover:bg-forum-50 hover:text-forum-700 disabled:opacity-50"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-5">
          <div>
            <p className="text-sm font-semibold text-forum-900">Need to send a file to the CRO?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Attach it to a message — every file exchanged in a conversation shows up on this page.
            </p>
          </div>
          <Button as="link" to="/dashboard/messages" variant="primary" size="sm">
            <MessageSquare className="h-4 w-4" />
            Go to Messages
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
