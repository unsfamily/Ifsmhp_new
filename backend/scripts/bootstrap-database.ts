/**
 * Production bootstrap — the minimum a real deployment needs to function.
 *
 *   npm run db:bootstrap
 *
 * Creates the first administrator and the platform's reference data, and
 * nothing else. This is the production counterpart to `db:seed`: that script
 * inserts demo members, projects, publications and events, several of which are
 * listed on the public site, which is why it refuses to run in production.
 *
 * Without this, a freshly migrated database has no administrator at all —
 * members self-register as APPLICANT and only an admin can approve them, so the
 * membership workflow would be dead on arrival.
 *
 * Safe to re-run: every step is an upsert or a no-op when the record exists. It
 * never rewrites an existing administrator's password.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config';
import { hashPassword } from '../utils/security';

const prisma = new PrismaClient();

/** The published default. Deploying with it would ship a known admin password. */
const INSECURE_DEFAULT_PASSWORD = 'ChangeMeNow!2026';

const ok = (msg: string, detail = '') => console.log(`  ✓ ${msg}${detail ? ` — ${detail}` : ''}`);
const skip = (msg: string, why = '') => console.log(`  · ${msg}${why ? ` — ${why}` : ''}`);

/** Operational defaults the admin screens read; safe in every environment. */
const PLATFORM_SETTINGS = [
  { section: 'membership', key: 'approval_sla_days', value: 5 },
  { section: 'uploads', key: 'max_file_mb', value: env.MAX_UPLOAD_MB },
  { section: 'events', key: 'default_timezone', value: 'UTC' },
];

const REPORT_DEFINITIONS = [
  {
    key: 'membership-monthly',
    title: 'Monthly Membership Review',
    category: 'Membership',
    description: 'Applicant volume, decisions, and SLA.',
    cadence: 'Monthly',
    format: 'xlsx',
    recipient: 'CRO',
  },
  {
    key: 'review-sla',
    title: 'Review SLA',
    category: 'Operations',
    description: 'Ageing queues across projects, support, and publications.',
    cadence: 'Weekly',
    format: 'xlsx',
    recipient: 'Operations',
  },
];

async function bootstrapAdmin(): Promise<void> {
  const email = env.SEED_ADMIN_EMAIL.trim().toLowerCase();

  const existingAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (existingAdmin) {
    // Never touch an existing admin's credentials — re-running this must not be
    // a way to silently reset somebody's password.
    skip('administrator already exists', existingAdmin.email);
    return;
  }

  if (env.isProduction && env.SEED_ADMIN_PASSWORD === INSECURE_DEFAULT_PASSWORD) {
    throw new Error(
      'SEED_ADMIN_PASSWORD is still the published default.\n' +
        'Set a real password in the environment before bootstrapping production —\n' +
        'otherwise the deployment ships with an administrator whose password is public.',
    );
  }

  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash) {
    throw new Error(
      `SEED_ADMIN_EMAIL (${email}) already belongs to a ${clash.role} account.\n` +
        'Choose a different address, or promote that account deliberately.',
    );
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
      fullName: 'IFSMHP Administrator',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  ok('administrator created', email);
}

async function bootstrapReferenceData(): Promise<void> {
  for (const setting of PLATFORM_SETTINGS) {
    await prisma.platformSetting.upsert({
      where: { section_key: { section: setting.section, key: setting.key } },
      // Existing values are an operator's choices; leave them alone.
      update: {},
      create: setting,
    });
  }
  ok('platform settings ready', `${PLATFORM_SETTINGS.length} keys`);

  for (const definition of REPORT_DEFINITIONS) {
    await prisma.reportDefinition.upsert({
      where: { key: definition.key },
      update: {},
      create: definition,
    });
  }
  ok('report definitions ready', `${REPORT_DEFINITIONS.length} reports`);
}

async function main(): Promise<void> {
  console.log(`\nIFSMHP database bootstrap — ${env.NODE_ENV}`);
  console.log('  Creates the first administrator and reference data. No demo content.\n');

  await bootstrapAdmin();
  await bootstrapReferenceData();

  const admins = await prisma.user.count({ where: { role: 'ADMIN' } });
  console.log(`\nBootstrap complete — ${admins} administrator${admins === 1 ? '' : 's'}.`);
  console.log(`  Sign in at /login with ${env.SEED_ADMIN_EMAIL} using password sign-in.`);
  console.log('  Members register themselves and sign in with an emailed code.\n');
}

main()
  .catch((error: unknown) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
