import { usePublicSettings } from '../../context/SettingsContext';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { publicApi, eventCoverUrl } from '../../api/public';
import { usePolledApiData } from '../../hooks/usePolledApiData';
import { EventListState, EventRegistration, formatEventDate, resourceKinds } from './PublicEventControls';

export default function PublicEventDetails({ id, close, section }: { id: string; close: () => void; section?: 'recordings' | 'proceedings' }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const resources = useRef<HTMLDivElement>(null);
  const [failedImage, setFailedImage] = useState('');
  const settings = usePublicSettings();
  const result = usePolledApiData(() => publicApi.event(id), [id], 30000);
  const event = result.error ? null : result.data;
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  useEffect(() => { if (event && section) resources.current?.scrollIntoView({ block: 'nearest' }); }, [event?.id, section]); // eslint-disable-line react-hooks/exhaustive-deps
  return <dialog ref={dialog} aria-labelledby="event-detail-heading" onCancel={e => { e.preventDefault(); close(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg border border-paper-border bg-paper-raised p-5 text-ink shadow-xl backdrop:bg-black/50 sm:p-7">
    <div className="mb-5 flex items-start justify-between gap-4"><h2 id="event-detail-heading" className="min-w-0 break-words font-display text-xl font-semibold text-forum-900">{event?.title || 'Event details'}</h2><button autoFocus title="Close event details" aria-label="Close event details" onClick={close} className="shrink-0 rounded-md p-1 hover:bg-forum-50"><X className="h-5 w-5" /></button></div>
    <EventListState loading={result.initialLoading} error={result.error} empty={false} retry={result.refresh} label="event details" />
    {event && <div className="space-y-5 break-words [overflow-wrap:anywhere]">
      {event.cover && (failedImage === event.cover.url ? <p className="text-sm text-ink-muted">Event image unavailable.</p> : <img key={event.cover.url} src={eventCoverUrl(event.cover.url)} alt={event.cover.name} onError={() => setFailedImage(event.cover!.url)} className="h-56 w-full rounded-md object-contain sm:h-80" />)}
      <div className="space-y-1 text-sm text-ink-muted"><p>{formatEventDate(event.date, settings).full}</p><p>{event.time}</p><p>{event.location} · {event.format}</p><p>{event.seats === null ? 'Unlimited capacity' : `${event.seats.toLocaleString()} seats`} · {event.attendees.toLocaleString()} registered</p></div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{event.longDescription || event.description}</p>
      {event.speakers.length > 0 && <div><h3 className="text-sm font-semibold text-forum-900">Speakers</h3><ul className="mt-2 space-y-1 text-sm text-ink-muted">{event.speakers.map((name, index) => <li key={`${name}-${index}`}>{name}</li>)}</ul></div>}
      {event.organizer && <div className="text-sm"><h3 className="font-semibold text-forum-900">Organizer</h3><p className="mt-1 text-ink-muted">{event.organizer}</p>{event.organizerEmail && <a className="text-forum-700 underline" href={`mailto:${encodeURIComponent(event.organizerEmail)}`}>{event.organizerEmail}</a>}</div>}
      <EventRegistration event={event} />
      {event.resources.length > 0 && <div ref={resources} className="border-t border-paper-border pt-4"><h3 className="text-sm font-semibold text-forum-900">Event resources</h3><ul className="mt-3 space-y-3 text-sm">{event.resources.map(resource => <li key={resource.id} className={section && resourceKinds[section].includes(resource.kind) ? 'font-semibold' : ''}>{resource.url ? <a href={resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-2 text-forum-700 underline"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />{resource.title}</a> : <span className="text-ink-subtle">{resource.title} (unavailable)</span>}</li>)}</ul></div>}
    </div>}
  </dialog>;
}
