import type { PublicEvent, PublicEventDetail } from '../api/public';
import { eventCoverUrl } from '../api/public';
import {
  CEREMONY_ADDRESS,
  CEREMONY_END_ISO,
  CEREMONY_PAGE_TITLE,
  CEREMONY_START_ISO,
  CEREMONY_VENUE,
} from './ceremonyProgramme';
import { CEREMONY_PAGE_PATH } from './ceremonyRegistration';

const ATTENDANCE = {
  Virtual: 'https://schema.org/OnlineEventAttendanceMode',
  Hybrid: 'https://schema.org/MixedEventAttendanceMode',
  'In-Person': 'https://schema.org/OfflineEventAttendanceMode',
} as const;

const ORGANIZER_NAME = 'International Forum for Scientists and Mental Health Professionals';

function siteOrigin(origin?: string) {
  if (origin) return origin.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://www.ifsmhp.com';
}

function absoluteUrl(pathOrUrl: string | null | undefined, origin?: string) {
  const base = siteOrigin(origin);
  if (!pathOrUrl) return `${base}/events`;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${base}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
}

function placeFromLocation(location: string) {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  const name = parts[0] || location;
  const india = /india|pune|maharashtra/i.test(location);
  const postalMatch = location.match(/\b(\d{6})\b/);
  const locality = parts.find((part) => /^pune$/i.test(part));
  const region = parts.find((part) => /maharashtra/i.test(part));
  const street = parts
    .filter((part) => part !== name && part !== locality && part !== region && !/^\d{6}$/.test(part) && !/^india$/i.test(part))
    .join(', ');

  return {
    '@type': 'Place',
    name,
    address: {
      '@type': 'PostalAddress',
      ...(street ? { streetAddress: street } : { streetAddress: location }),
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      ...(postalMatch ? { postalCode: postalMatch[1] } : {}),
      ...(india ? { addressCountry: 'IN' } : {}),
    },
  };
}

/** Schema.org Event payload for Google / Bing / Apple rich-result discovery. */
export function toSchemaOrgEvent(event: PublicEvent | PublicEventDetail, origin?: string) {
  const detail = 'organizer' in event ? (event as PublicEventDetail) : null;
  const start = event.startsAt || (event.date ? `${event.date}T${event.timeStart || '00:00'}:00` : undefined);
  const end = event.endsAt || (event.date && event.timeEnd ? `${event.date}T${event.timeEnd}:00` : undefined);
  const attendance = ATTENDANCE[event.format as keyof typeof ATTENDANCE] ?? ATTENDANCE['In-Person'];
  const virtual = event.format === 'Virtual';
  const eventUrl = absoluteUrl(event.externalUrl || `/events`, origin);

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: (detail?.longDescription || event.description || '').trim() || undefined,
    startDate: start,
    endDate: end,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: attendance,
    isAccessibleForFree: true,
    location: virtual
      ? { '@type': 'VirtualLocation', url: eventUrl }
      : placeFromLocation(event.location),
    url: eventUrl,
    ...(event.cover ? { image: [eventCoverUrl(event.cover.url)] } : {}),
    organizer: {
      '@type': 'Organization',
      name: detail?.organizer || ORGANIZER_NAME,
      url: siteOrigin(origin),
      ...(detail?.organizerEmail ? { email: detail.organizerEmail } : {}),
    },
    ...(event.speakers.length
      ? { performer: event.speakers.map((name) => ({ '@type': 'Person', name })) }
      : {}),
    ...(event.registrationRequired
      ? {
          offers: {
            '@type': 'Offer',
            url: eventUrl,
            price: 0,
            priceCurrency: 'INR',
            availability: event.past ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
          },
        }
      : {}),
  };
}

/** Canonical Schema.org Event for the Second International IFSMHP Awards landing page. */
export function awardsCeremonySchemaOrg(origin?: string) {
  const base = siteOrigin(origin);
  const url = `${base}${CEREMONY_PAGE_PATH}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: CEREMONY_PAGE_TITLE,
    description:
      'The Second International IFSMHP Awards Ceremony recognises 75 recipients across scientific, literary, and social disciplines at Azam Campus, Pune. Nomination is separate from membership.',
    startDate: CEREMONY_START_ISO,
    endDate: CEREMONY_END_ISO,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    isAccessibleForFree: true,
    url,
    location: {
      '@type': 'Place',
      name: CEREMONY_VENUE,
      address: {
        '@type': 'PostalAddress',
        streetAddress: CEREMONY_ADDRESS.replace(/,\s*Pune,\s*Maharashtra\s*\d+.*$/i, '').trim(),
        addressLocality: 'Pune',
        addressRegion: 'Maharashtra',
        postalCode: '411001',
        addressCountry: 'IN',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: ORGANIZER_NAME,
      url: base,
    },
    offers: {
      '@type': 'Offer',
      url,
      price: 0,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
    },
  };
}
