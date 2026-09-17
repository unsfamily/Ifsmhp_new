import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, MessageSquare, History, RefreshCw, Eye } from 'lucide-react';
import { useState } from 'react';
import { openAttachmentInTab } from '../../api/messaging';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import SupportConversation from '../../components/support/SupportConversation';
import { supportApi, supportDate } from '../../api/support';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { useAuth } from '../../context/AuthContext';

export default function SupportRequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  return user && id ? <MemberSupportDetail key={`${user.id}:${id}`} id={id} /> : null;
}

function MemberSupportDetail({ id }: { id: string }) {
  const location = useLocation();
  const [fileError, setFileError] = useState<string | null>(null);
  const { data, initialLoading, error, refresh } = usePolledApiData(() => supportApi.detail(false, id), [id], 10000);
  return <div className="space-y-6" style={{ overflowWrap: 'anywhere' }}>
    <Link to={`/dashboard/support${location.search}`} className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-forum-700"><ArrowLeft className="h-4 w-4" />Back to Support Requests</Link>
    {initialLoading && <p role="status" className="text-sm text-ink-muted">Loading support request...</p>}
    {error && <p role="alert" className="text-sm text-danger-600">{error} <Button variant="ghost" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4" />Retry</Button></p>}
    {data && <>
      <Card><CardHeader>
        <div className="flex flex-wrap items-center gap-2"><Badge variant="info">{data.status}</Badge><Badge variant={data.priority === 'Urgent' ? 'danger' : 'default'}>{data.priority} Priority</Badge>
          {data.type.map((kind) => <Badge key={kind}>{kind} Support</Badge>)}
        </div>
        <h1 className="mt-3 font-display text-2xl font-semibold text-forum-900">{data.subject}</h1>
      </CardHeader><CardContent className="pt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          {[['Ticket ID', data.id], ['Project', data.project], ['Submitted', supportDate(data.submitted)], ['Required By', supportDate(data.requiredBy)], ['Last Update', supportDate(data.lastUpdate)]].map(([label, value]) => <div key={label}><p className="text-xs text-ink-subtle">{label}</p><p className="mt-1 text-forum-900">{value}</p></div>)}
        </div>
        <h2 className="mt-6 mb-3 flex items-center gap-2 font-semibold text-forum-900"><FileText className="h-4 w-4" />Request Details</h2>
        <p className="whitespace-pre-wrap text-sm text-ink">{data.description}</p>
        {data.adminResponse && <div className="mt-5 border-t border-paper-border pt-4"><h2 className="mb-2 font-semibold text-forum-900">Admin Response</h2><p className="whitespace-pre-wrap text-sm text-ink-muted">{data.adminResponse}</p></div>}
        {data.attachments.some((file) => file.type === 'application/pdf' || file.type.startsWith('image/')) && <div className="mt-4 flex flex-wrap gap-2">
          {data.attachments.filter((file) => file.type === 'application/pdf' || file.type.startsWith('image/')).map((file) => <Button key={file.id} size="sm" variant="ghost" title={`Preview ${file.name}`} aria-label={`Preview ${file.name}`} onClick={() => { setFileError(null); void openAttachmentInTab(file.id, file.attachmentId).catch(() => setFileError('This document is unavailable. Please try again.')); }}><Eye className="h-4 w-4 shrink-0" /><span className="break-all">{file.name}</span></Button>)}
        </div>}
        {fileError && <p role="alert" className="mt-3 text-sm text-danger-600">{fileError}</p>}
      </CardContent></Card>
      <Card><CardHeader><h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><MessageSquare className="h-5 w-5" />Conversation ({data.messages.length})</h2></CardHeader>
        <CardContent className="pt-0"><SupportConversation detail={data} admin={false} onSent={refresh} /></CardContent>
      </Card>
      <Card><CardHeader><h2 className="flex items-center gap-2 font-display text-lg font-semibold text-forum-900"><History className="h-5 w-5" />Status History</h2></CardHeader><CardContent className="pt-0 space-y-4">
        {data.history.map((entry) => <div key={entry.id} className="border-b border-paper-border pb-3 last:border-0"><Badge>{entry.to}</Badge><span className="ml-3 text-xs text-ink-subtle">{new Date(entry.at).toLocaleString()}</span>{entry.note && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{entry.note}</p>}</div>)}
      </CardContent></Card>
    </>}
  </div>;
}
