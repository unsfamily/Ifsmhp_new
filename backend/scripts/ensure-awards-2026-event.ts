/**
 * Upserts the published Second International IFSMHP Awards 2026 public event.
 * Safe to re-run. Does not seed other data.
 *
 * Usage from backend/: npx tsx scripts/ensure-awards-2026-event.ts
 */
import { DateTime } from 'luxon';
import { prisma } from '../config/database';

const SLUG = 'second-international-ifsmhp-awards-2026';
const ZONE = 'Asia/Kolkata';
const DATE = '2026-12-26';
const TIME_START = '09:00';
const TIME_END = '18:00';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN', deletedAt: null }, select: { id: true } });
  if (!admin) throw new Error('No admin user found to own the event.');

  const startsAt = DateTime.fromISO(`${DATE}T${TIME_START}`, { zone: ZONE }).toJSDate();
  const endsAt = DateTime.fromISO(`${DATE}T${TIME_END}`, { zone: ZONE }).toJSDate();
  const date = new Date(`${DATE}T00:00:00Z`);

  const data = {
    title: '2nd International IFSMHP Awards 2026',
    shortDescription: 'The Second International IFSMHP Awards Ceremony recognises 75 recipients across scientific, literary, and social disciplines at Azam Campus, Pune.',
    longDescription: [
      'The Second International IFSMHP Awards Ceremony will be held on 26 December 2026 at A.R. Shaikh Assembly Hall (Azam Campus), Pune.',
      'Twenty-five commemorative award categories are presented under three recognition divisions (Senior, Mid-career, and Young), for a total of 75 recipients.',
      'Nomination is separate from IFSMHP membership. Register interest or open the nomination form from the awards ceremony page.',
    ].join('\n\n'),
    date,
    startsAt,
    endsAt,
    timeStart: TIME_START,
    timeEnd: TIME_END,
    timezone: ZONE,
    location: 'A.R. Shaikh Assembly Hall (Azam Campus), Azam Campus, 2390 K.B. Hidayatullah Road, New Modikhana, Camp, Pune, Maharashtra 411001',
    format: 'In-Person',
    audience: 'Public',
    capacity: null,
    organizer: 'IFSMHP',
    organizerEmail: 'admin@ifsmhp.org',
    status: 'PUBLISHED' as const,
    featured: true,
    registrationRequired: true,
    waitlistEnabled: false,
    recordingProvided: false,
    sendReminder: false,
    externalUrl: 'https://www.ifsmhp.com/awards/second-international',
    deletedAt: null,
  };

  const existing = await prisma.event.findUnique({ where: { slug: SLUG }, select: { id: true } });
  const eventId = existing
    ? (await prisma.event.update({ where: { slug: SLUG }, data: { ...data, revision: { increment: 1 } } })).id
    : (await prisma.event.create({ data: { ...data, slug: SLUG, creatorId: admin.id } })).id;

  await prisma.eventSpeaker.deleteMany({ where: { eventId } });
  await prisma.eventTag.deleteMany({ where: { eventId } });
  await prisma.eventSpeaker.createMany({
    data: [
      { eventId, name: 'Dr. Hemachandran Ravikumar — Chief Advisor', sort: 1 },
      { eventId, name: 'Lt. Dr. Yaseen Ismail Shaikh — Organising Committee Secretary', sort: 2 },
    ],
  });
  await prisma.eventTag.createMany({ data: [{ eventId, name: 'Symposium' }] });

  console.log(JSON.stringify({ ok: true, slug: SLUG, eventId, date: DATE, featured: true }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
