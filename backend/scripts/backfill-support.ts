import { prisma } from '../config/database';
import { backfillSupportConversations } from '../services/support.service';

backfillSupportConversations()
  .then((result) => console.log('Support conversation backfill:', result))
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
