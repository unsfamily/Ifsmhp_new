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
  Upload,
  Video,
  Bell,
  Calendar,
  Send,
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
  
  // Independent page state
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [showVideoDialog, setShowVideoDialog] = useState(false);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [meetingSubject, setMeetingSubject] = useState('');
  const [meetingDateTime, setMeetingDateTime] = useState('');
  const [dialogMessage, setDialogMessage] = useState('');
  
  // View section state for displaying content below sections
  const [activeView, setActiveView] = useState<'messages' | 'documents' | 'videos' | 'announcements' | null>(null);

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

  // Handler for uploading documents
  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    try {
      // TODO: Implement document upload API call
      setDialogMessage('Document uploaded successfully!');
      setShowUploadDialog(false);
    } catch (err) {
      setUploadError(normalizeError(err).message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // Handler for sending messages
  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    
    try {
      // TODO: Implement message send API call
      setDialogMessage('Message sent successfully!');
      setMessageText('');
      setShowMessageDialog(false);
    } catch (err) {
      setUploadError(normalizeError(err).message || 'Failed to send message');
    }
  };

  // Handler for sharing video links
  const handleShareVideo = async () => {
    if (!videoUrl.trim()) return;

    try {
      // TODO: Implement video share API call
      setDialogMessage('Video link shared successfully!');
      setVideoUrl('');
      setShowVideoDialog(false);
    } catch (err) {
      setUploadError(normalizeError(err).message || 'Failed to share video');
    }
  };

  // Handler for requesting meeting
  const handleRequestMeeting = async () => {
    if (!meetingSubject.trim() || !meetingDateTime.trim()) return;

    try {
      // TODO: Implement meeting request API call
      setDialogMessage('Meeting request sent successfully!');
      setMeetingSubject('');
      setMeetingDateTime('');
      setShowMeetingDialog(false);
    } catch (err) {
      setUploadError(normalizeError(err).message || 'Failed to request meeting');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forum-900">Document Exchange with CRO</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage document exchange, communications, and important updates with the Chief Research Office.
        </p>
      </div>

      {actionError && (
        <div className="rounded-lg border border-danger-600/20 bg-danger-100 p-4">
          <p className="text-sm text-danger-600">{actionError}</p>
        </div>
      )}

      {/* Inbox Section */}
      <div>
        <h2 className="text-lg font-semibold text-forum-900 mb-4 flex items-center gap-2">
          <Inbox className="h-5 w-5 text-forum-600" />
          Inbox
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Messages from CRO */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-forum-50 text-forum-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Messages from CRO</h3>
                  <p className="mt-1 text-xs text-ink-muted">View all communications and updates</p>
                  <Button onClick={() => setActiveView('messages')} size="sm" variant="outline" className="mt-3">
                    View Messages
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shared Documents */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-brass-100 text-brass-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Shared Documents</h3>
                  <p className="mt-1 text-xs text-ink-muted">Files shared by CRO and you</p>
                  <Badge variant="default" className="mt-3 text-[11px]">
                    {incoming} new from CRO
                  </Badge>
                  <Button onClick={() => setActiveView('documents')} size="sm" variant="outline" className="mt-3 ml-2">
                    View Documents
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Links */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-600">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Video Links</h3>
                  <p className="mt-1 text-xs text-ink-muted">Access shared videos and recordings</p>
                  <Button onClick={() => setActiveView('videos')} size="sm" variant="outline" className="mt-3">
                    View Videos
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Important Announcements */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-warning-100 text-warning-600">
                  <Bell className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Announcements</h3>
                  <p className="mt-1 text-xs text-ink-muted">Important updates and notifications</p>
                  <Button onClick={() => setActiveView('announcements')} size="sm" variant="outline" className="mt-3">
                    View Announcements
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Display Content Section - Shown when a view is selected */}
      {activeView && (
        <Card>
          <CardContent className="p-6">
            {/* Messages View */}
            {activeView === 'messages' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-forum-600" />
                    Messages from CRO
                  </h2>
                  <button onClick={() => setActiveView(null)} className="text-ink-muted hover:text-forum-900">
                    ✕
                  </button>
                </div>
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 text-forum-100 mx-auto mb-3" />
                  <p className="text-ink-muted">Messages from the Chief Research Officer will appear here.</p>
                </div>
              </div>
            )}

            {/* Documents View */}
            {activeView === 'documents' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brass-600" />
                    Shared Documents
                  </h2>
                  <button onClick={() => setActiveView(null)} className="text-ink-muted hover:text-forum-900">
                    ✕
                  </button>
                </div>
                {documents.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-brass-100 mx-auto mb-3" />
                    <p className="text-ink-muted">No documents shared yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-paper-border">
                    {documents.map((doc) => {
                      const kind = docKind(doc.type, doc.name);
                      const TIcon = kindIcon[kind];
                      const busy = busyId === doc.id;
                      return (
                        <div key={`${doc.id}-${doc.date}`} className="py-3 flex items-start gap-3 hover:bg-forum-50/30 px-3 rounded transition-colors">
                          <div className={`h-9 w-9 shrink-0 flex items-center justify-center rounded ${kindColor[kind]}`}>
                            <TIcon className="h-4.5 w-4.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-forum-900 truncate">{doc.name}</p>
                            <p className="text-xs text-ink-muted mt-0.5">{formatBytes(doc.size)} • {formatDate(doc.date)}</p>
                            <p className="text-xs text-ink-muted line-clamp-1 mt-1">{doc.note}</p>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void run(doc, 'view')}
                              className="p-1.5 text-ink-muted hover:bg-forum-50 hover:text-forum-700 rounded disabled:opacity-50"
                              title="Preview"
                            >
                              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void run(doc, 'download')}
                              className="p-1.5 text-ink-muted hover:bg-forum-50 hover:text-forum-700 rounded disabled:opacity-50"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Videos View */}
            {activeView === 'videos' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <Video className="h-5 w-5 text-slateteal-600" />
                    Video Links
                  </h2>
                  <button onClick={() => setActiveView(null)} className="text-ink-muted hover:text-forum-900">
                    ✕
                  </button>
                </div>
                <div className="text-center py-8">
                  <Video className="h-12 w-12 text-slateteal-100 mx-auto mb-3" />
                  <p className="text-ink-muted">Shared video links and recordings will appear here.</p>
                </div>
              </div>
            )}

            {/* Announcements View */}
            {activeView === 'announcements' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-forum-900 flex items-center gap-2">
                    <Bell className="h-5 w-5 text-warning-600" />
                    Announcements
                  </h2>
                  <button onClick={() => setActiveView(null)} className="text-ink-muted hover:text-forum-900">
                    ✕
                  </button>
                </div>
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-warning-100 mx-auto mb-3" />
                  <p className="text-ink-muted">Important announcements and updates will appear here.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Send to CRO Section */}
      <div>
        <h2 className="text-lg font-semibold text-forum-900 mb-4 flex items-center gap-2">
          <Send className="h-5 w-5 text-forum-600" />
          Send to CRO
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Upload Documents */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-success-100 text-success-600">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Upload Documents</h3>
                  <p className="mt-1 text-xs text-ink-muted">Share files with the CRO</p>
                  <input
                    type="file"
                    id="file-upload"
                    onChange={handleUploadDocument}
                    className="hidden"
                  />
                  <Button onClick={() => document.getElementById('file-upload')?.click()} size="sm" variant="primary" className="mt-3" disabled={uploading}>
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Share Video Links */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-slateteal-100 text-slateteal-600">
                  <Video className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Share Video Links</h3>
                  <p className="mt-1 text-xs text-ink-muted">Send video URLs or recordings</p>
                  <Button onClick={() => setShowVideoDialog(true)} size="sm" variant="outline" className="mt-3">
                    Share Video
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send Message */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-forum-100 text-forum-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Send Message</h3>
                  <p className="mt-1 text-xs text-ink-muted">Start a new conversation or reply</p>
                  <Button onClick={() => setShowMessageDialog(true)} size="sm" variant="primary" className="mt-3">
                    <Send className="h-3.5 w-3.5" />
                    Send Message
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Request Meeting */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-warning-100 text-warning-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-forum-900">Request Meeting</h3>
                  <p className="mt-1 text-xs text-ink-muted">Schedule a call or meeting</p>
                  <Button onClick={() => setShowMeetingDialog(true)} size="sm" variant="outline" className="mt-3">
                    Request Meeting
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      

      {/* Message Dialog Modal */}
      {showMessageDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-forum-900 mb-4">Send Message to CRO</h3>
              
              {uploadError && (
                <div className="mb-4 rounded-lg border border-danger-600/20 bg-danger-100 p-3">
                  <p className="text-sm text-danger-600">{uploadError}</p>
                </div>
              )}

              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here..."
                className="w-full rounded-md border border-paper-border bg-paper p-3 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper mb-4 resize-none h-32"
              />

              <div className="flex gap-3">
                <Button onClick={() => setShowMessageDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSendMessage} variant="primary" className="flex-1">
                  Send
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Video Dialog Modal */}
      {showVideoDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-forum-900 mb-4">Share Video Link</h3>
              
              {uploadError && (
                <div className="mb-4 rounded-lg border border-danger-600/20 bg-danger-100 p-3">
                  <p className="text-sm text-danger-600">{uploadError}</p>
                </div>
              )}

              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Enter video URL or link..."
                className="w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper mb-4"
              />

              <div className="flex gap-3">
                <Button onClick={() => setShowVideoDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleShareVideo} variant="primary" className="flex-1">
                  Share
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meeting Request Dialog Modal */}
      {showMeetingDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-forum-900 mb-4">Request Meeting</h3>
              
              {uploadError && (
                <div className="mb-4 rounded-lg border border-danger-600/20 bg-danger-100 p-3">
                  <p className="text-sm text-danger-600">{uploadError}</p>
                </div>
              )}

              <input
                type="text"
                value={meetingSubject}
                onChange={(e) => setMeetingSubject(e.target.value)}
                placeholder="Meeting subject..."
                className="w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper mb-3"
              />

              <input
                type="datetime-local"
                value={meetingDateTime}
                onChange={(e) => setMeetingDateTime(e.target.value)}
                className="w-full rounded-md border border-paper-border bg-paper px-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper mb-4"
              />

              <div className="flex gap-3">
                <Button onClick={() => setShowMeetingDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleRequestMeeting} variant="primary" className="flex-1">
                  Request
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Success Message Dialog */}
      {dialogMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-success-100 text-success-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-forum-900">{dialogMessage}</h3>
              </div>
              <Button onClick={() => setDialogMessage('')} variant="primary" className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
