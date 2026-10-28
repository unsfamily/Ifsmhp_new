import { useMemo } from 'react';
import type { PublicEvent, PublicEventDetail } from '../../api/public';
import { awardsCeremonySchemaOrg, toSchemaOrgEvent } from '../../domain/publicEventSchema';

type EventLike = PublicEvent | PublicEventDetail;

/** JSON.stringify + escape `<` so event text cannot break out of the script tag. */
function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Injects Schema.org Event JSON-LD for crawlers (Google, Bing, Apple). */
export function EventJsonLd({ events }: { events: EventLike[] }) {
  const json = useMemo(() => {
    if (!events.length) return null;
    if (events.length === 1) return safeJsonLd(toSchemaOrgEvent(events[0]!));
    return safeJsonLd(events.map((event) => toSchemaOrgEvent(event)));
  }, [events]);

  if (!json) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Canonical awards ceremony Event markup for the landing page. */
export function AwardsCeremonyJsonLd() {
  const json = useMemo(() => safeJsonLd(awardsCeremonySchemaOrg()), []);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
