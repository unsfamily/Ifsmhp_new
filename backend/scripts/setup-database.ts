/**
 * One-command MySQL setup.
 *
 *   npm run db:setup              provision (if it can), migrate, generate, seed
 *   npm run db:setup -- --reset   drop and rebuild first (development only)
 *
 * The command adapts to where it runs. On a developer machine or in CI it will
 * create the database and application user, apply migrations, generate the
 * client and seed. Under NODE_ENV=production it refuses every destructive or
 * data-creating step and does only what a deployment should: migrate and
 * generate.
 *
 * DDL goes through `prisma db execute`, so no MySQL driver or `mysql` client is
 * needed beyond the Prisma CLI the project already depends on.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';
import { databaseDeploymentProblems, mysqlAccountHost, parseDatabaseUrl } from '../config/database-url';

const BACKEND_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(BACKEND_DIR, '.env');
const ENV_EXAMPLE_PATH = path.join(BACKEND_DIR, '.env.example');
const SCHEMA_PATH = 'database/prisma/schema.prisma';

/** Collation every table in the migrations uses; the database must match. */
const CHARSET = 'utf8mb4';
const COLLATION = 'utf8mb4_unicode_ci';

const RESET = process.argv.includes('--reset');

/* -------------------------------------------------------------------------- */
/* Output                                                                     */
/* -------------------------------------------------------------------------- */

const ok = (msg: string, detail = '') => console.log(`  ✓ ${msg}${detail ? ` — ${detail}` : ''}`);
const skip = (msg: string, why = '') => console.log(`  · ${msg}${why ? ` — ${why}` : ''}`);
const step = (n: number, title: string) => console.log(`\n[${n}/7] ${title}`);

class SetupError extends Error {
  constructor(message: string, readonly hint?: string) {
    super(message);
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A password that survives being embedded in a URL.
 *
 * Restricted to RFC 3986 *unreserved* characters, so it is byte-identical
 * whether or not it is percent-encoded — a reserved character silently mangling
 * DATABASE_URL is exactly how this project's connection string ended up with an
 * empty password. `-._~` are non-alphanumeric, so they still satisfy MySQL's
 * validate_password MEDIUM policy (>=8, upper, lower, digit, special).
 */
function generatePassword(length = 24): string {
  const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const LOWER = 'abcdefghijklmnopqrstuvwxyz';
  const DIGIT = '0123456789';
  const SPECIAL = '-._~';
  const ALL = UPPER + LOWER + DIGIT + SPECIAL;
  const pick = (set: string, n: number) =>
    Array.from(crypto.randomFillSync(new Uint32Array(n))).map((r) => set[r % set.length]!);

  const chars = [...pick(UPPER, 2), ...pick(LOWER, 2), ...pick(DIGIT, 2), ...pick(SPECIAL, 2), ...pick(ALL, length - 8)];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  const password = chars.join('');
  if (encodeURIComponent(password) !== password) throw new Error('generated password is not URL-safe');
  return password;
}

const PRISMA_CLI = path.join(BACKEND_DIR, 'node_modules', 'prisma', 'build', 'index.js');
const TSX_CLI = path.join(BACKEND_DIR, 'node_modules', 'tsx', 'dist', 'cli.mjs');

/**
 * Runs a command in the backend directory, streaming nothing unless it fails.
 *
 * Invokes Node with an absolute executable. Spawning `npm` directly fails on
 * Windows (`spawnSync npm ENOENT` / `npm.cmd EINVAL`) because Node does not
 * resolve PATHEXT and cannot spawn `.cmd` shims without a shell.
 */
function run(command: string, args: string[], label: string, input?: string): string {
  const result = spawnSync(command, args, {
    cwd: BACKEND_DIR,
    encoding: 'utf8',
    env: process.env,
    input,
  });
  if (result.error || result.status !== 0) {
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    const reason = result.error ? result.error.message : '';
    throw new SetupError(`${label} failed`, [reason, output].filter(Boolean).join('\n').split('\n').slice(-12).join('\n'));
  }
  return `${result.stdout ?? ''}${result.stderr ?? ''}`;
}

/** Runs the local Prisma CLI through Node, so Windows and Unix behave the same. */
function prisma(args: string[], label: string, input?: string): string {
  return run(process.execPath, [PRISMA_CLI, ...args], label, input);
}

/**
 * Executes one SQL statement against a URL.
 *
 * One statement per call on purpose: `prisma db execute` forwards its input as a
 * single query, and MySQL rejects multiple statements in one query by default.
 */
function execSql(url: string, sql: string, label: string): void {
  prisma(['db', 'execute', '--url', url, '--stdin'], label, sql);
}

/** Quotes a MySQL identifier, rejecting anything that cannot be one. */
function quoteIdent(name: string): string {
  if (!/^[A-Za-z0-9_$]+$/.test(name)) throw new SetupError(`Unsafe database or user name: ${name}`);
  return `\`${name}\``;
}

/** Escapes a string literal for the few places a value must be inlined. */
function quoteLiteral(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

interface Target {
  url: string;
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
  loopback: boolean;
}

function parseTarget(url: string): Target {
  const parsed = parseDatabaseUrl(url);
  return { url, ...parsed };
}

/** The same server, but with no database selected — for CREATE DATABASE. */
function serverOnlyUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/';
  return parsed.toString();
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Ensures backend/.env exists. Creates it from the template on a fresh checkout
 * so the command genuinely works in one step; never overwrites an existing file,
 * and never writes one in production, where config is the deployer's business.
 */
function ensureEnvFile(isProduction: boolean): void {
  if (fs.existsSync(ENV_PATH)) {
    ok('backend/.env present', 'left untouched');
    return;
  }
  if (isProduction) {
    throw new SetupError(
      'backend/.env is missing and will not be generated in production',
      'Provide DATABASE_URL, JWT_ACCESS_SECRET and JWT_REFRESH_SECRET through your deployment environment.',
    );
  }
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    throw new SetupError('backend/.env is missing and backend/.env.example was not found');
  }

  const password = generatePassword();
  const contents = fs
    .readFileSync(ENV_EXAMPLE_PATH, 'utf8')
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="mysql://ifsmhp:${password}@localhost:3306/ifsmhp_platform"`)
    .replace(/^JWT_ACCESS_SECRET=.*$/m, `JWT_ACCESS_SECRET="${crypto.randomBytes(48).toString('base64url')}"`)
    .replace(/^JWT_REFRESH_SECRET=.*$/m, `JWT_REFRESH_SECRET="${crypto.randomBytes(48).toString('base64url')}"`);

  fs.writeFileSync(ENV_PATH, contents, { mode: 0o600 });
  ok('created backend/.env from .env.example', 'generated database password and JWT secrets');
}

/** Creates the database and application user. Requires ADMIN_DATABASE_URL. */
function provision(target: Target, adminUrl: string): void {
  const db = quoteIdent(target.database);

  execSql(
    serverOnlyUrl(adminUrl),
    `CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET ${CHARSET} COLLATE ${COLLATION};`,
    'Creating the database',
  );
  ok(`database ${target.database} ready`, `${CHARSET} / ${COLLATION}`);

  // Split so the password can be set whether or not the user already exists.
  const account = `${quoteLiteral(target.user)}@${quoteLiteral(mysqlAccountHost(target.host))}`;
  const secret = quoteLiteral(target.password);
  execSql(serverOnlyUrl(adminUrl), `CREATE USER IF NOT EXISTS ${account} IDENTIFIED BY ${secret};`, 'Creating the application user');
  execSql(serverOnlyUrl(adminUrl), `ALTER USER ${account} IDENTIFIED BY ${secret};`, 'Setting the application user password');
  execSql(serverOnlyUrl(adminUrl), `GRANT ALL PRIVILEGES ON ${db}.* TO ${account};`, 'Granting privileges');
  execSql(serverOnlyUrl(adminUrl), 'FLUSH PRIVILEGES;', 'Flushing privileges');
  ok(`user ${target.user} ready`, `ALL PRIVILEGES on ${target.database}`);
}

/** Confirms the application user can actually reach its database. */
function assertAppCanConnect(target: Target): void {
  try {
    execSql(target.url, 'SELECT 1;', 'Connecting as the application user');
  } catch (error) {
    const db = quoteIdent(target.database);
    throw new SetupError(
      `Could not connect to ${target.database} as ${target.user}`,
      [
        'Set ADMIN_DATABASE_URL and re-run to provision it automatically, or run this once as an admin:',
        '',
        `  CREATE DATABASE ${db} CHARACTER SET ${CHARSET} COLLATE ${COLLATION};`,
        `  CREATE USER '${target.user}'@'${mysqlAccountHost(target.host)}' IDENTIFIED BY '<password from DATABASE_URL>';`,
        `  GRANT ALL PRIVILEGES ON ${db}.* TO '${target.user}'@'${mysqlAccountHost(target.host)}';`,
        `  FLUSH PRIVILEGES;`,
        '',
        (error as SetupError).hint ?? '',
      ].join('\n'),
    );
  }
}

/** True when the database has no users, i.e. nothing would be overwritten. */
async function databaseIsEmpty(): Promise<boolean> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    return (await prisma.user.count()) === 0;
  } finally {
    await prisma.$disconnect();
  }
}

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */

async function main(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  console.log(`\nIFSMHP database setup — ${isProduction ? 'PRODUCTION' : process.env.NODE_ENV ?? 'development'}${RESET ? ' (--reset)' : ''}`);

  if (RESET && isProduction) {
    throw new SetupError('--reset is refused in production', 'It would drop the live database.');
  }

  step(1, 'Configuration');
  ensureEnvFile(isProduction);
  dotenv.config({ path: ENV_PATH });

  if (!process.env.DATABASE_URL) {
    throw new SetupError('DATABASE_URL is not set', `Add it to ${ENV_PATH} or the environment.`);
  }
  const target = parseTarget(process.env.DATABASE_URL);
  if (!target.database) throw new SetupError('DATABASE_URL has no database name');
  if (!target.password) {
    // The exact failure that made the original connection string unusable.
    throw new SetupError(
      'DATABASE_URL has an empty password',
      'If the password contains URL-reserved characters they must be percent-encoded.',
    );
  }
  ok('DATABASE_URL parsed', `${target.user}@${target.host}:${target.port}/${target.database}`);
  const problems = databaseDeploymentProblems(target, {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    reset: RESET,
  });
  if (problems.length > 0) {
    throw new SetupError('Database configuration is not safe for this environment', problems.map((problem) => `- ${problem}`).join('\n'));
  }

  step(2, 'Server reachable');
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  // Probe the server with no database selected. Including the database name
  // here would report a missing database as "cannot reach MySQL" and short-
  // circuit the actionable message step 4 gives for exactly that case.
  const probeUrl = serverOnlyUrl(adminUrl ?? target.url);
  try {
    execSql(probeUrl, 'SELECT 1;', 'Reaching the MySQL server');
    ok(`MySQL reachable at ${target.host}:${target.port}`);
  } catch (error) {
    throw new SetupError(
      `Cannot reach MySQL at ${target.host}:${target.port}`,
      [
        'Check the server is running and the credentials are correct:',
        `  pgrep -fl mysqld    lsof -nP -iTCP:${target.port} -sTCP:LISTEN`,
        '',
        (error as SetupError).hint ?? '',
      ].join('\n'),
    );
  }

  step(3, 'Database and user');
  if (isProduction || !target.loopback) {
    skip('provisioning refused', isProduction ? 'the database and user must already exist' : 'the database host is not localhost');
  } else if (!adminUrl) {
    skip('no ADMIN_DATABASE_URL', 'assuming the database and user already exist');
  } else {
    provision(target, adminUrl);
  }

  step(4, 'Application access');
  assertAppCanConnect(target);
  ok(`connected as ${target.user}`);

  step(5, 'Schema');
  if (RESET) {
    prisma(['migrate', 'reset', '--force', '--skip-seed', '--skip-generate', '--schema', SCHEMA_PATH], 'Resetting the database');
    ok('database reset', 'dropped and re-migrated');
  } else {
    prisma(['migrate', 'deploy', '--schema', SCHEMA_PATH], 'Applying migrations');
    ok('migrations applied');
  }
  const status = prisma(['migrate', 'status', '--schema', SCHEMA_PATH], 'Checking migration status');
  if (/have not yet been applied|drift/i.test(status)) {
    throw new SetupError('The schema is not up to date after migrating', status.split('\n').slice(-10).join('\n'));
  }
  ok('schema up to date', 'no drift');

  step(6, 'Prisma client');
  prisma(['generate', '--schema', SCHEMA_PATH], 'Generating the Prisma client');
  ok('client generated');

  step(7, 'Seed data');
  if (isProduction || !target.loopback) {
    skip('seeding refused', isProduction ? 'seed data is development-only' : 'the database host is not localhost');
  } else if (!RESET && !(await databaseIsEmpty())) {
    skip('database already has users', 're-run with --reset to rebuild from scratch');
  } else {
    run(process.execPath, [TSX_CLI, 'database/prisma/seed.ts'], 'Seeding development data');
    ok('development data seeded');
  }

  console.log('\nDatabase ready.');
  if (!isProduction) {
    console.log('  Sign in as admin@ifsmhp.local / ChangeMeNow!2026 (members use an emailed code).');
  }
  console.log('  Start the app with: npm run dev\n');
}

main().catch((error: unknown) => {
  const failure = error instanceof SetupError ? error : null;
  console.error(`\n✗ ${failure ? failure.message : error instanceof Error ? error.message : String(error)}`);
  if (failure?.hint) console.error(`\n${failure.hint}`);
  console.error('');
  process.exit(1);
});
