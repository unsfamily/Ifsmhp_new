import Button from '../common/Button';
import { ExchangeModal } from '../exchange/ExchangeDialog';

export default function ConfirmationDialog({ title, description, confirmLabel = 'Confirm', busy = false, reason, requireReason = false, onReason, onConfirm, onClose }: { title: string; description: string; confirmLabel?: string; busy?: boolean; reason?: string; requireReason?: boolean; onReason?: (value: string) => void; onConfirm: () => void; onClose: () => void }) {
  return <ExchangeModal title={title} close={onClose} busy={busy}>
    <p className="text-sm text-ink-muted">{description}</p>
    {onReason && <label className="mt-4 block text-sm font-medium text-forum-900">Reason {requireReason && <span className="text-danger-600">*</span>}<textarea rows={3} value={reason ?? ''} onChange={(event) => onReason(event.target.value)} className="mt-1 w-full rounded-md border border-paper-border p-2 text-sm" /></label>}
    <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={onConfirm} disabled={busy || (requireReason && !reason?.trim())}>{busy ? 'Saving…' : confirmLabel}</Button></div>
  </ExchangeModal>;
}
