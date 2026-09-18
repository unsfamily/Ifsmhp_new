import { Calendar, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import type { Paginated, PublicEvent } from '../../api/public';
import Button from '../common/Button';

export function formatEventDate(value: string | null) {
  if (!value) return { day: '-', month: '-', year: '', full: 'Date unavailable' };
  const date = new Date(`${value}T00:00:00Z`);
  return { day: date.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' }), month: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), year: date.toLocaleDateString('en-US', { year: 'numeric', timeZone: 'UTC' }), full: date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }) };
}
export function EventRegistration({ event }: { event: PublicEvent }) {
  if (event.past) return null;
  return event.registrationRequired && event.externalUrl ? <Button as="link" to={event.externalUrl} target="_blank" rel="noopener noreferrer" size="sm"><Calendar className="h-4 w-4" />Register</Button>
    : <Button size="sm" disabled title={event.registrationRequired ? 'The organizer has not supplied a registration link.' : 'This event does not require registration.'}><Calendar className="h-4 w-4" />{event.registrationRequired ? 'Registration unavailable' : 'No registration required'}</Button>;
}
export function EventListState({ loading, error, empty, retry, label }: { loading: boolean; error: string | null; empty: boolean; retry: () => void; label: string }) {
  if (error) return <div role="alert" className="rounded-lg border border-paper-border bg-paper-raised p-5 text-sm text-ink-muted">{error}<Button onClick={retry} variant="outline" size="sm" className="ml-3"><RefreshCw className="h-4 w-4" />Retry {label}</Button></div>;
  if (loading) return <p role="status" className="py-6 text-sm text-ink-muted">Loading {label}...</p>;
  return empty ? <p role="status" className="py-6 text-sm text-ink-muted">No {label} for this selection.</p> : null;
}
export function EventPagination({ pagination, label, setPage }: { pagination: Paginated<PublicEvent>['pagination']; label: string; setPage: (page: number) => void }) {
  if (pagination.pages <= 1) return null;
  return <nav aria-label={`${label} pagination`} className="mt-6 flex items-center justify-center gap-3 text-xs text-ink-muted">
    <button title={`Previous ${label}`} aria-label={`Previous ${label}`} disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)} className="p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
    <span>{pagination.page} / {pagination.pages}</span>
    <button title={`Next ${label}`} aria-label={`Next ${label}`} disabled={pagination.page >= pagination.pages} onClick={() => setPage(pagination.page + 1)} className="p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
  </nav>;
}
export const resourceKinds = { recordings: ['recording', 'video'], proceedings: ['proceedings', 'slides', 'document', 'pdf'] };
