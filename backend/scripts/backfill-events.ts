import { prisma } from '../config/database';
import { localDateTime, normalizeTimezone } from '../domain/event-input';

async function main() {
  const events = await prisma.event.findMany({ where: { startsAt: null, date: { not: null } } });
  for (const e of events) {
    const date = e.date!.toISOString().slice(0, 10);
    const timezone = normalizeTimezone(e.timezone);
    const start = localDateTime(date, e.timeStart, timezone);
    const end = localDateTime(date, e.timeEnd, timezone);
    if (!start.isValid || !end.isValid || end <= start) throw new Error(`Event ${e.id} needs a valid date/time before backfill.`);
    await prisma.event.update({ where: { id: e.id }, data: { timezone, startsAt: start.toJSDate(), endsAt: end.toJSDate() } });
  }
  console.log(`Backfilled ${events.length} events.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
