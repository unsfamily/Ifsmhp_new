import { useState } from 'react';
import { FileText, Inbox, MessageSquare, Upload, Video, Bell, Calendar, Send, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { exchangeApi, type ExchangeView, type ExchangeSend } from '../../api/documentExchange';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import ExchangeDialog from '../../components/exchange/ExchangeDialog';
import ExchangeInbox from '../../components/exchange/ExchangeInbox';

export default function DocumentExchangePage() {
  const [activeView, setActiveView] = useState<ExchangeView | null>(null);
  const [dialog, setDialog] = useState<ExchangeSend['type'] | null>(null);
  const [success, setSuccess] = useState('');
  const [revision, setRevision] = useState(0);
  const summary = usePolledApiData(exchangeApi.summary, [], 30000);
  const refresh = () => { summary.refresh(); setRevision(n => n + 1); };
  const open = (type: ExchangeSend['type']) => { setSuccess(''); setDialog(type); };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-forum-900">Document Exchange with CRO</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Manage document exchange, communications, and important updates with the Chief Research Office.
        </p>
      </div>

      {summary.error && <p role="alert" className="rounded-lg border border-danger-600/20 bg-danger-100 p-4 text-sm text-danger-600">{summary.error}<Button size="sm" variant="ghost" onClick={summary.refresh}><RefreshCw className="h-4 w-4" />Retry</Button></p>}
      {success && <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success-600">{success}</p>}

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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Messages from CRO {summary.data && <span className="ml-1 text-xs font-normal text-ink-muted">({summary.data.counts.messages})</span>}</h3>
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Shared Documents {summary.data && <span className="ml-1 text-xs font-normal text-ink-muted">({summary.data.counts.documents})</span>}</h3>
                  <p className="mt-1 text-xs text-ink-muted">Files shared by CRO and you</p>
                  <Badge variant="default" className="mt-3 text-[11px]">
                    {summary.data ? `${summary.data.unreadDocuments} new from CRO` : 'Loading...'}
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Video Links {summary.data && <span className="ml-1 text-xs font-normal text-ink-muted">({summary.data.counts.videos})</span>}</h3>
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Announcements {summary.data && <span className="ml-1 text-xs font-normal text-ink-muted">({summary.data.counts.announcements})</span>}</h3>
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

      {activeView && <ExchangeInbox key={activeView} view={activeView} revision={revision} close={() => setActiveView(null)} changed={refresh} />}

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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Upload Documents</h3>
                  <p className="mt-1 text-xs text-ink-muted">Share files with the CRO</p>
                  <Button onClick={() => open('document')} size="sm" variant="primary" className="mt-3" disabled={!summary.data}>
                    <Upload className="h-3.5 w-3.5" />
                    Upload File
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Share Video Links</h3>
                  <p className="mt-1 text-xs text-ink-muted">Send video URLs or recordings</p>
                  <Button onClick={() => open('video')} disabled={!summary.data} size="sm" variant="outline" className="mt-3">
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Send Message</h3>
                  <p className="mt-1 text-xs text-ink-muted">Start a new conversation or reply</p>
                  <Button onClick={() => open('message')} disabled={!summary.data} size="sm" variant="primary" className="mt-3">
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
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-forum-900">Request Meeting</h3>
                  <p className="mt-1 text-xs text-ink-muted">Propose a call or meeting</p>
                  <Button onClick={() => open('meeting')} disabled={!summary.data} size="sm" variant="outline" className="mt-3">
                    Request Meeting
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      

      {dialog && summary.data && <ExchangeDialog key={dialog} type={dialog} constraints={summary.data.upload} close={() => setDialog(null)} sent={() => {
        const target = dialog === 'document' ? 'documents' : dialog === 'video' ? 'videos' : 'messages';
        setDialog(null); setActiveView(target); setSuccess(dialog === 'meeting' ? 'Meeting request sent to CRO.' : 'Sent to CRO.'); refresh();
      }} />}
    </div>
  );
}
