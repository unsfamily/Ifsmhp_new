import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { supportApi, type SupportDetail } from '../../api/support';
import { adminApi } from '../../api/admin';
import { memberApi } from '../../api/member';
import { normalizeError } from '../../api/client';
import { downloadAttachment } from '../../api/messaging';
import { MessageBubble } from '../messaging/MessageThread';
import { TextArea } from '../common/Input';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function SupportConversation({ detail, admin, onSent }: { detail: SupportDetail; admin: boolean; onSent: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const lastMessage = detail.messages.at(-1)?.id;
  useEffect(() => {
    if (window.location.hash === '#reply') composer.current?.focus();
  }, []);
  useEffect(() => {
    if (detail.conversationId) void (admin ? adminApi.markConversationRead(detail.conversationId) : memberApi.markConversationRead(detail.conversationId)).catch(() => undefined);
  }, [admin, detail.conversationId, lastMessage]);
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (sending || !reply.trim()) return;
    setSending(true); setError(null); setSuccess(false);
    try {
      await supportApi.reply(admin, detail.id, reply.trim());
      setReply(''); setSuccess(true); onSent();
    } catch (failure) { setError(normalizeError(failure).message); }
    finally { setSending(false); }
  };
  return <div className="space-y-4" style={{ overflowWrap: 'anywhere' }}>
    {detail.messages.length ? detail.messages.map((message) => <MessageBubble key={message.id} message={message}
      onOpenAttachment={(file) => void downloadAttachment(file.id, file.name).catch(() => setError('This attachment could not be downloaded. It may no longer be available.'))} />)
      : <p className="text-sm text-ink-muted">No conversation messages yet.</p>}
    <form className="border-t border-paper-border pt-4 mt-6" onSubmit={(event) => void send(event)}>
      <TextArea ref={composer} id="support-reply" rows={3} label={admin ? 'Send a message to the member' : 'Message CRO'}
        placeholder="Type your message here." value={reply} onChange={(event) => setReply(event.target.value)}
        className="mb-3" maxLength={10000} required disabled={sending} />
      {error && <p role="alert" className="mb-3 text-sm text-danger-600">{error}</p>}
      {success && <p role="status" className="mb-3 text-sm text-success-600">Message sent.</p>}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        {admin ? <Badge variant="info" className="w-fit">Sent as CRO Office · logged in audit</Badge> : <span />}
        <Button type="submit" disabled={sending || !reply.trim()}><Send className="h-4 w-4" />{sending ? 'Sending...' : 'Send Message'}</Button>
      </div>
    </form>
  </div>;
}
