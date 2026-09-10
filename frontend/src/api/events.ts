import { apiClient } from './client';
import { eventSchema, type EventInput } from '../../../backend/domain/event-input';
export { EVENT_TAGS, TIMEZONES } from '../../../backend/domain/event-input';
export type EventStatus = EventInput['status'];
export interface EventFormState {
  title: string; shortDescription: string; longDescription: string; agenda: string;
  date: string; timeStart: string; timeEnd: string; timezone: string;
  location: string; organizer: string; organizerEmail: string; externalUrl: string;
  format: EventInput['format']; audience: EventInput['audience'];
  capacity: string; speakers: string[]; tags: string[];
  registrationRequired: boolean; waitlistEnabled: boolean; sendReminder: boolean;
  reminderDays: string; recordingProvided: boolean; publishImmediately: boolean;
  scheduledPublishDate: string; featured: boolean;
}
export interface EventRecord extends Omit<EventInput, 'externalUrl'> {
  id: string; slug: string; externalUrl: string | null; attendees: number;
  displayStatus: EventStatus; updatedAt: string; startsAt: string | null; endsAt: string | null;
  coverFile: { id: string; name: string; mimeType: string } | null;
  delivery: { status: string; count: number }[];
  failures: { id: string; kind: string; error: string | null }[];
  resourceCount: number;
}
export type EventTab = 'upcoming' | 'past' | 'drafts';
export interface EventsResult {
  items: EventRecord[];
  pagination: { page: number; limit: number; total: number; pages: number };
  counts: { upcoming: number; past: number; drafts: number; rsvps: number; resources: number };
  next: { title: string; date: string | null } | null;
}
export const EMPTY_EVENT: EventFormState = {
  title: '', shortDescription: '', longDescription: '', agenda: '', date: '', timeStart: '', timeEnd: '',
  timezone: 'UTC', location: '', organizer: '', organizerEmail: '', externalUrl: '', format: 'Virtual', audience: 'All Members',
  capacity: '', speakers: [''], tags: [], registrationRequired: true, waitlistEnabled: true, sendReminder: true,
  reminderDays: '1', recordingProvided: false, publishImmediately: true, scheduledPublishDate: '', featured: false,
};
export function eventToForm(e: EventRecord): EventFormState {
  const fields = Object.fromEntries(Object.entries(EMPTY_EVENT).map(([key, fallback]) => [key, key in e ? e[key as keyof EventRecord] : fallback])) as unknown as EventFormState;
  return { ...fields, agenda: '', date: e.date || '', capacity: e.capacity === null ? '' : String(e.capacity),
    reminderDays: String(e.reminderDays), externalUrl: e.externalUrl ?? '', speakers: e.speakers.length ? e.speakers : [''], publishImmediately: e.status === 'PUBLISHED' || e.status === 'PAST' };
}
export function eventPayload(f: EventFormState, mode: 'draft' | 'submit' | 'publish' = 'submit', coverFileId: string | null = null, status?: EventStatus) {
  const { publishImmediately, ...fields } = f;
  const payload = { ...fields } as Partial<EventFormState>;
  delete payload.agenda;
  return { ...payload, capacity: f.capacity.trim() === '' ? null : Number(f.capacity), reminderDays: Number(f.reminderDays), coverFileId,
    status: mode === 'draft' ? 'DRAFT' : mode === 'publish' || publishImmediately ? 'PUBLISHED' : status === 'CANCELLED' ? 'CANCELLED' : 'DRAFT',
    scheduledPublishDate: mode === 'draft' || mode === 'publish' || publishImmediately ? '' : f.scheduledPublishDate };
}
export function validateEvent(f: EventFormState, mode: 'draft' | 'submit' | 'publish' = 'submit') {
  const parsed = eventSchema().safeParse(eventPayload(f, mode));
  return parsed.success ? {} : Object.fromEntries(parsed.error.issues.map(e => [String(e.path[0]), e.message]));
}
type Envelope<T> = { data: T };
export const eventApi = {
  list: async (params: { tab: EventTab; q: string; page: number; limit: number }) => (await apiClient.get<Envelope<EventsResult>>('/admin/events', { params })).data.data,
  detail: async (id: string) => (await apiClient.get<Envelope<EventRecord>>(`/admin/events/${id}`)).data.data,
  save: async (payload: unknown, id?: string) => (await apiClient.request<Envelope<EventRecord>>({ method: id ? 'PATCH' : 'POST', url: id ? `/admin/events/${id}` : '/admin/events', data: payload })).data.data,
  publish: async (id: string) => (await apiClient.post<Envelope<EventRecord>>(`/admin/events/${id}/publish`)).data.data,
  cancel: async (id: string, reason: string, emailAttendees: boolean) => (await apiClient.post<Envelope<EventRecord>>(`/admin/events/${id}/cancel`, { reason, emailAttendees })).data.data,
  remove: async (id: string) => { await apiClient.delete(`/admin/events/${id}`); },
};
