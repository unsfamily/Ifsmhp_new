import { useState } from 'react';
import Button from '../common/Button';
import { SelectInput, TextArea } from '../common/Input';
import { ExchangeModal } from '../exchange/ExchangeDialog';

const actions = ['HIDE_CONTENT', 'RESTORE_CONTENT', 'WARN_MEMBER', 'SUSPEND_MEMBER', 'BLOCK_MEMBER', 'RESOLVE_REPORT', 'DISMISS_REPORT'];
export default function ModerationActionModal({ initialAction, busy, close, submit }: { initialAction?: string; busy: boolean; close: () => void; submit: (action: string, notes: string) => void }) {
  const [action, setAction] = useState(initialAction ?? actions[0] ?? ''); const [notes, setNotes] = useState(''); const [error, setError] = useState('');
  return <ExchangeModal title="Moderation action" close={close} busy={busy}><form onSubmit={(event) => { event.preventDefault(); if (!notes.trim()) { setError('Notes or a reason are required.'); return; } submit(action, notes.trim()); }} className="space-y-4"><SelectInput label="Action" value={action} onChange={(e) => setAction(e.target.value)}>{actions.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</SelectInput><TextArea required label="Notes / reason" value={notes} error={error} onChange={(e) => { setNotes(e.target.value); setError(''); }} /><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Applying…' : 'Apply action'}</Button></div></form></ExchangeModal>;
}
