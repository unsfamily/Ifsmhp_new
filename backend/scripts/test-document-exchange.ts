import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { env } from '../config';

const databaseUrl = process.env.TEST_DATABASE_ADMIN_URL || env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

// Never migrate, seed, or truncate the configured application database for tests.
async function main() {
  const name = `ifsmhp_exchange_test_${crypto.randomBytes(6).toString('hex')}`;
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  const childEnv = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test', SMTP_HOST: '' };
  await prisma.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  try {
    const migration = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { env: childEnv, stdio: 'inherit' });
    if (migration.status !== 0) throw new Error('Test database migration failed');
    const files = process.argv.slice(2);
    const result = spawnSync('npx', ['vitest', 'run', ...(files.length ? files : ['tests/document-exchange.test.ts', 'tests/messaging.test.ts', 'tests/support.test.ts']), '--silent'], { env: childEnv, stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
  } finally {
    await prisma.$executeRawUnsafe(`DROP DATABASE \`${name}\``);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
