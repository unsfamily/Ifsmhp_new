/** Add supported defaults without changing any existing setting or audit row. */
import { prisma } from '../config/database';
import { effectiveSettings } from '../services/settings.service';
import { sections } from '../domain/settings';
async function main() {
  const result = await prisma.$transaction(async tx => {
    const values = await effectiveSettings(tx);
    const rows = Object.entries(values).flatMap(([section, fields]) => Object.entries(fields).map(([key, value]) => ({ section, key, value })));
    const inserted = await tx.platformSetting.createMany({ data: rows, skipDuplicates: true });
    await tx.settingRevision.createMany({ data: sections.map(section => ({ section })), skipDuplicates: true });
    return inserted.count;
  });
  console.log(`Initialized ${result} missing settings; existing values and audit history preserved.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
