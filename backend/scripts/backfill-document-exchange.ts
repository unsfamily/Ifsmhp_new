import { prisma } from '../config/database';
import { isLegacyVideoUrl } from '../domain/document-exchange';

async function backfill() {
  let cursor: string | undefined;
  let updated = 0;
  for (;;) {
    const rows = await prisma.sharedLink.findMany({ where: { kind: 'LINK' }, orderBy: { id: 'asc' }, take: 250, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    if (!rows.length) break;
    const ids = rows.filter(row => isLegacyVideoUrl(row.url)).map(row => row.id);
    updated += (await prisma.sharedLink.updateMany({ where: { id: { in: ids }, kind: 'LINK' }, data: { kind: 'VIDEO' } })).count;
    cursor = rows[rows.length - 1]!.id;
  }
  console.log(`Classified ${updated} legacy video links. Existing messages and files retained.`);
}
backfill().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
