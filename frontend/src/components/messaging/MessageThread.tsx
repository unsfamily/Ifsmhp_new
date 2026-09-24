import { useEffect, useRef } from 'react';
import { Eye, LinkIcon, MessageSquare, ShieldCheck } from 'lucide-react';
import Badge from '../common/Badge';
import type { ConversationMessage } from '../../api/messaging';
import ChatAttachment from './ChatAttachment';

/** Initials for the gradient avatar, skipping titles like "Dr." or "Prof.". */
export function initialsOf(name: string) {
  const parts = name
    .replace(/\s*\([^)]*\)\s*/g, '') // drop a trailing "(IFSMHP-…)" member id
    .split(' ')
    .filter((part) => part && !part.endsWith('.'));
  const picked = parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : parts;
  return picked.map((p) => p[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'h-11 w-11 text-sm' : size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-9 w-9 text-xs';
  return (
    <span
      className={`${dimensions} inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-forum-600 to-slateteal-500 font-bold text-white`}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

function formatStamp(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function MessageBubble({
  message,
}: {
  message: ConversationMessage;
}) {
  const isAdmin = message.who === 'admin';
  const isSystem = message.who === 'system';

  const tone = message.internal
    ? 'bg-warning-100 border border-warning-600/30 text-warning-700 rounded-2xl'
    : isSystem
      ? 'bg-slateteal-100 text-slateteal-700 rounded-lg'
      : isAdmin
        ? 'bg-forum-600 text-white rounded-2xl rounded-br-md'
        : 'bg-paper-raised border border-paper-border text-ink rounded-2xl rounded-bl-md';

  // Attachment chips have to read against a dark admin bubble too.
  const chipTone = isAdmin && !message.internal
    ? 'bg-forum-700/60 text-white hover:bg-forum-700'
    : 'bg-paper border border-paper-border text-ink-muted hover:bg-forum-50 hover:text-forum-700';

  return (
    <div className={`flex ${isAdmin && !isSystem ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] px-4 py-3 ${tone}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] opacity-90">
          {message.internal && <Eye className="h-3 w-3" />}
          {isAdmin && !message.internal && <ShieldCheck className="h-3 w-3" />}
          <span className="font-semibold">{message.name}</span>
          {message.internal && <Badge variant="warning" className="!text-[9px]">Internal only</Badge>}
          <span>· {formatStamp(message.at)}</span>
        </div>

        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
        {message.meetingRequestedAt && <p className="mt-2 text-xs">Proposed meeting: {new Date(message.meetingRequestedAt).toLocaleString(undefined, { timeZone: message.meetingTimezone || 'UTC' })} ({message.meetingTimezone || 'UTC'})</p>}

        {message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((a) => (
              <ChatAttachment key={a.attachmentId ?? a.id} file={a} tone={chipTone} />
            ))}
          </div>
        )}

        {message.links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.links.filter(l => /^https?:\/\//i.test(l.url)).map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${chipTone}`}
              >
                <LinkIcon className="h-3 w-3" />
                {l.label ?? l.url}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The scrolling message list. Scrolls to the newest message when the thread
 * changes or a message arrives — keyed on the message count so a poll that
 * brings nothing new does not yank the reader back down.
 */
export function MessageThread({
  messages,
  conversationId,
  emptyLabel = 'No messages in this conversation yet.',
  className = 'max-h-[420px]',
}: {
  messages: ConversationMessage[];
  conversationId?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const id = window.setTimeout(() => node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' }), 80);
    return () => window.clearTimeout(id);
  }, [conversationId, messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-forum-50 text-forum-700">
          <MessageSquare className="h-6 w-6" />
        </div>
        <p className="text-sm text-ink-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={`space-y-3 overflow-y-auto p-4 ${className}`}>
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
    </div>
  );
}
