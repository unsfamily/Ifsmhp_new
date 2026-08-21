import { useState } from 'react';
import {
  MessageSquare,
  Send,
  FileText,
  Video,
  Download,
  Paperclip,
  Calendar,
  Inbox,
  User,
  Search,
  Bell,
  ChevronRight,
  Clock,
  Building2,
  PlayCircle,
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { TextArea } from '../../components/common/Input';

interface Message {
  id: string;
  from: string;
  role: string;
  subject: string;
  preview: string;
  time: string;
  unread: boolean;
  type: 'message' | 'document' | 'video' | 'announcement';
  files?: { name: string; size: string }[];
  videoLink?: string;
}

const inbox: Message[] = [
  {
    id: 'm1',
    from: 'Chief Research Officer',
    role: 'CRO Office',
    subject: 'Re: Biomarker Panel Study — Funding Endorsement',
    preview: 'Dear Dr. Chen — great news. Your biomarker project has passed the initial review and the committee has approved an official endorsement letter for the NIH R01...',
    time: '2 hours ago',
    unread: true,
    type: 'document',
    files: [
      { name: 'IFSMHP-Endorsement-Chen-Biomarker-2026.pdf', size: '284 KB' },
      { name: 'Reviewer-Comments-Summary.docx', size: '42 KB' },
    ],
  },
  {
    id: 'm2',
    from: 'CRO Events Office',
    role: 'Symposia Committee',
    subject: 'Invitation: Keynote Speaker — Digital Mental Health Symposium',
    preview: 'On behalf of the program committee, it is our pleasure to formally invite you to deliver a keynote presentation at the upcoming IFSMHP Symposium on Digital Mental Health Tools...',
    time: 'Yesterday',
    unread: true,
    type: 'announcement',
    videoLink: 'https://youtu.be/symposium-preview-2026',
  },
  {
    id: 'm3',
    from: 'Chief Research Officer',
    role: 'CRO Office',
    subject: 'Congratulations — CBT Paper Published!',
    preview: 'I am delighted to share that your paper, "Cognitive Behavioral Therapy Outcomes in Digital Mental Health Platforms" has been officially published on the IFSMHP platform...',
    time: '3 days ago',
    unread: false,
    type: 'message',
  },
  {
    id: 'm4',
    from: 'Grants Office',
    role: 'Funding Support Team',
    subject: 'Matching Grant Opportunity — Mental Health Disparities',
    preview: 'A new matched-funding opportunity has been added to the portal. Projects focused on underserved populations are eligible for up to $50,000 in matching funds...',
    time: '1 week ago',
    unread: false,
    type: 'announcement',
    files: [{ name: 'Grant-Guidelines-2026-Round3.pdf', size: '1.1 MB' }],
  },
  {
    id: 'm5',
    from: 'Chief Research Officer',
    role: 'CRO Office',
    subject: 'CRO Monthly Office Hours — August Recording',
    preview: 'Hi all — sharing the recording and key takeaways from our monthly member Q&A. Topics this month: navigating IRB renewals, publication strategy for early-career...',
    time: '2 weeks ago',
    unread: false,
    type: 'video',
    videoLink: 'https://youtu.be/cro-office-hours-aug-2026',
  },
];

export default function MessagesPage() {
  const initialId = inbox.length > 0 ? inbox[0]!.id : null;
  const [selected, setSelected] = useState<string | null>(initialId);
  const current = inbox.find((m) => m.id === selected) ?? (inbox.length > 0 ? inbox[0]! : null);
  const [tab, setTab] = useState<'inbox' | 'send'>('inbox');

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex border-b border-paper-border">
              <button
                type="button"
                onClick={() => setTab('inbox')}
                className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'inbox' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Inbox className="h-4 w-4 inline mr-1.5" />
                Inbox
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brass-500 px-1.5 text-[11px] font-semibold text-white">
                  {inbox.filter((m) => m.unread).length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTab('send')}
                className={`flex-1 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'send' ? 'border-forum-600 text-forum-900 bg-forum-50/40' : 'border-transparent text-ink-muted hover:text-ink'
                }`}
              >
                <Send className="h-4 w-4 inline mr-1.5" />
                Send to CRO
              </button>
            </div>

            <div className="p-3 border-b border-paper-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                <input
                  type="text"
                  placeholder="Search messages..."
                  className="w-full rounded-md border border-paper-border bg-paper pl-9 pr-3 py-2 text-sm focus:border-forum-600 focus:outline-none focus:ring-2 focus:ring-forum-600 focus:ring-offset-1 focus:ring-offset-paper"
                />
              </div>
            </div>

            <div className="divide-y divide-paper-border max-h-[600px] overflow-y-auto">
              {inbox.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelected(m.id)}
                  className={`w-full text-left p-4 transition-colors ${
                    selected === m.id
                      ? 'bg-forum-50/60 border-l-4 border-l-forum-600 pl-3'
                      : 'hover:bg-forum-50/30 border-l-4 border-l-transparent'
                  } ${m.unread ? 'bg-brass-100/20' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${m.unread ? 'bg-brass-500 text-white' : 'bg-forum-100 text-forum-700'}`}>
                      {m.unread ? <Bell className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-sm truncate ${m.unread ? 'font-semibold text-forum-900' : 'font-medium text-ink'}`}>
                          {m.from}
                        </p>
                        <span className="text-[11px] text-ink-subtle whitespace-nowrap flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {m.time}
                        </span>
                      </div>
                      <p className={`text-sm mt-0.5 truncate ${m.unread ? 'text-forum-900 font-medium' : 'text-ink-muted'}`}>
                        {m.subject}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        {m.type === 'document' && <Badge variant="default"><FileText className="h-2.5 w-2.5 mr-1" />Document</Badge>}
                        {m.type === 'video' && <Badge variant="info"><Video className="h-2.5 w-2.5 mr-1" />Video</Badge>}
                        {m.type === 'announcement' && <Badge variant="brass"><Calendar className="h-2.5 w-2.5 mr-1" />Announcement</Badge>}
                        {m.unread && <span className="h-1.5 w-1.5 rounded-full bg-brass-500" />}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col">
          {current ? (
            <>
          <CardHeader className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forum-600 text-white font-semibold">
                CRO
              </div>
              <div>
                <h3 className="font-semibold text-forum-900">{current.subject}</h3>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle flex-wrap">
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {current.from} · {current.role}
                  </span>
                  <span>·</span>
                  <span>{current.time}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {current.files?.map((f) => (
                <Button key={f.name} size="sm" variant="outline" title={f.name}>
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
                </Button>
              ))}
              {current.videoLink && (
                <Button size="sm" variant="secondary">
                  <PlayCircle className="h-4 w-4" />
                  Watch
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex-1">
            <div className="prose prose-sm max-w-none">
              <p className="text-sm text-ink-muted leading-relaxed">
                {current.preview}
              </p>
              <p className="mt-4 text-sm text-ink-muted leading-relaxed">
                Please feel free to reach out with any questions. The support team remains at your disposal for clarifications, additional documentation, or to schedule a discussion at your convenience.
              </p>
              <p className="mt-4 text-sm font-medium text-forum-900">
                Best regards,<br />
                Office of the Chief Research Officer<br />
                IFSMHP
              </p>
            </div>

            {(current.files || current.videoLink) && (
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {current.files?.map((f) => (
                  <div key={f.name} className="flex items-center gap-3 rounded-lg border border-paper-border bg-paper p-3.5 hover:border-forum-200 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-forum-50 text-forum-700 shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-forum-900 truncate">{f.name}</p>
                      <p className="text-xs text-ink-subtle">{f.size}</p>
                    </div>
                    <button type="button" className="text-forum-700 hover:text-forum-900 shrink-0">
                      <Download className="h-4.5 w-4.5" />
                    </button>
                  </div>
                ))}
                {current.videoLink && (
                  <div className="rounded-lg border border-paper-border bg-gradient-to-br from-slateteal-100 to-forum-50 p-3.5 flex items-center gap-3 hover:border-slateteal-500/30 transition-colors sm:col-span-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slateteal-500 text-white shrink-0">
                      <Video className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-forum-900 truncate">{current.videoLink}</p>
                      <p className="text-xs text-ink-subtle">Shared video link</p>
                    </div>
                    <Button size="sm" variant="secondary">
                      <PlayCircle className="h-4 w-4" />
                      Open
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-paper-border">
              <p className="font-semibold text-forum-900 text-sm mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-forum-600" />
                Reply
              </p>
              <div className="space-y-3">
                <TextArea placeholder="Write your reply..." rows={4} />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-forum-700 transition-colors rounded-md px-2.5 py-1.5 hover:bg-forum-50">
                      <Paperclip className="h-4 w-4" />
                      Attach File
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-forum-700 transition-colors rounded-md px-2.5 py-1.5 hover:bg-forum-50">
                      <Video className="h-4 w-4" />
                      Share Video Link
                    </button>
                    <button type="button" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-forum-700 transition-colors rounded-md px-2.5 py-1.5 hover:bg-forum-50">
                      <Calendar className="h-4 w-4" />
                      Request Meeting
                    </button>
                  </div>
                  <Button>
                    <Send className="h-4 w-4" />
                    Send Reply
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
            </>
          ) : (
            <CardContent className="p-10 text-center text-ink-subtle text-sm">
              Select a message to view details.
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
