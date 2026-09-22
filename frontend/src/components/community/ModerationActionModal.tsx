import { useEffect, useRef, useState } from 'react';
import Button from '../common/Button';
import { SelectInput, TextArea } from '../common/Input';
import { ExchangeModal } from '../exchange/ExchangeDialog';
import CommunityPageSkeleton from './CommunityPageSkeleton';
import EmptyCommunityState from './EmptyCommunityState';
import type { ModerationAction } from '../../types/community';

export default function ModerationActionModal({ actions, loading, error, fields, busy, close, retry, submit }: {
  actions: ModerationAction[] | null; loading: boolean; error?: string | null; fields: Record<string, string>;
  busy: boolean; close: () => void; retry: () => void; submit: (action: ModerationAction, notes: string) => void;
}) {
  const [selected, setSelected] = useState<ModerationAction | null>(null);
  const initialized = useRef(false);
  useEffect(() => { if (!initialized.current && actions?.length) { initialized.current = true; setSelected(actions[0]!); } }, [actions]);
  const [notes, setNotes] = useState(''); const [validation, setValidation] = useState('');
  const action = selected && actions?.includes(selected) ? selected : undefined;
  return <ExchangeModal title="Moderation action" close={close} busy={busy}>
    {!actions ? loading ? <CommunityPageSkeleton /> : <EmptyCommunityState title="Report unavailable" error={error} retry={retry} /> :
      <form onSubmit={event => { event.preventDefault(); if (busy || !action) return; if (!notes.trim()) { setValidation('Notes or a reason are required.'); return; } submit(action, notes.trim()); }} className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-warning-50 p-3 text-sm text-warning-700">{error}</p>}
        <SelectInput label="Action" disabled={busy} value={action ?? ''} error={fields.action} onChange={event => setSelected(event.target.value as ModerationAction)}>{!action && <option value="" disabled>Select an available action</option>}{actions.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</SelectInput>
        <TextArea required maxLength={5000} disabled={busy} label="Notes / reason" value={notes} error={validation || fields.notes || fields.resolutionNotes} onChange={event => { setNotes(event.target.value); setValidation(''); }} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy || !action}>{busy ? 'Applying…' : 'Apply action'}</Button></div>
      </form>}
  </ExchangeModal>;
}
