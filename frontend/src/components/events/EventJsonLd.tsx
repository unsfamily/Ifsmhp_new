import { useMemo } from 'react';
import type { PublicEvent, PublicEventDetail } from '../../api/public';
import { awardsCeremonySchemaOrg, toSchemaOrgEvent } from '../../domain/publicEventSchema';

type EventLike = PublicEvent | PublicEventDetail;

/** Injects Schema.org Event JSON-LD for crawlers (Google, Bing, Apple). */
export function EventJsonLd({ events }: { events: EventLike[] }) {
  const json = useMemo(() => {
    if (!events.length) return null;
    const payload = events.length === 1 ? toSchemaOrgEvent(events[0]) : events.map((event) => toSchemaOrgEvent(event));
    return JSON.stringify(payload);
  }, [events]);

  if (!json) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Canonical awards ceremony Event markup for the landing page. */
export function AwardsCeremonyJsonLd() {
  const json = useMemo(() => JSON.stringify(awardsCeremonySchemaOrg()), []);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
