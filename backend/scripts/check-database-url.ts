/**
 * Validates DATABASE_URL before Prisma talks to it.
 *
 * `prisma migrate deploy` does not load the API env schema, so a remote
 * database without TLS would otherwise be migrated anyway.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { databaseDeploymentProblems, parseDatabaseUrl } from '../config/database-url';

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const problems = databaseDeploymentProblems(parseDatabaseUrl(databaseUrl), {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  reset: false,
});

if (problems.length > 0) {
  console.error(problems.map((problem) => `- ${problem}`).join('\n'));
  process.exit(1);
}
