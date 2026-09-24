import { useId, type ReactNode } from 'react';
import Button from '../common/Button';
import { ExchangeModal } from '../exchange/ExchangeDialog';

export default function ConfirmationDialog({ title, description, confirmLabel = 'Confirm', busy = false, reason, requireReason = false, error, confirmDisabled = false, reasonError, reasonMaxLength, children, onReason, onConfirm, onClose }: { title: string; description: string; confirmLabel?: string; busy?: boolean; reason?: string; requireReason?: boolean; error?: string; confirmDisabled?: boolean; reasonError?: string; reasonMaxLength?: number; children?: ReactNode; onReason?: (value: string) => void; onConfirm: () => void; onClose: () => void }) {
  const errorId = useId();
  return <ExchangeModal title={title} close={onClose} busy={busy}>
    <p className="text-sm text-ink-muted">{description}</p>
    {onReason && <label className="mt-4 block text-sm font-medium text-forum-900">Reason {requireReason && <span className="text-danger-600">*</span>}<textarea rows={3} maxLength={reasonMaxLength} aria-invalid={!!reasonError} aria-describedby={reasonError ? errorId : undefined} disabled={busy} value={reason ?? ''} onChange={(event) => onReason(event.target.value)} className="mt-1 w-full rounded-md border border-paper-border p-2 text-sm" /></label>}
    {reasonError && <p id={errorId} role="alert" className="mt-2 text-sm text-danger-600">{reasonError}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger-600">{error}</p>}
    {children}
    <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={onConfirm} disabled={busy || confirmDisabled || (requireReason && !reason?.trim())}>{busy ? 'Saving…' : confirmLabel}</Button></div>
  </ExchangeModal>;
}
