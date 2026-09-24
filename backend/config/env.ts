import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Backend keeps its own .env; the frontend has a separate one because Vite
// inlines its variables into the public bundle and must never see secrets.
//
// The path is resolved against candidates rather than a single __dirname
// offset: __dirname is `backend/config` under tsx but `backend/dist/config`
// after compilation, so a fixed offset silently loads nothing in production
// and leaves every optional variable on its default.
const envCandidates = [
  path.resolve(process.cwd(), '.env'), // npm scripts run from backend/
  path.resolve(__dirname, '../.env'), // tsx: backend/config → backend/
  path.resolve(__dirname, '../../.env'), // compiled: backend/dist/config → backend/
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) dotenv.config({ path: envPath });

/**
 * Environment schema.
 *
 * Only variables the application actually consumes are declared (spec §50).
 * Secrets are NOT given defaults — a missing secret must crash the process at
 * boot rather than silently fall back to a guessable value.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Comma-separated list of allowed browser origins. */
  CLIENT_URL: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_DOMAIN: z.string().optional(),
  UPLOAD_STORAGE_PATH: z.string().default('./uploads'),
  ADMIN_AVATAR_MAX_UPLOAD_MB: z.coerce.number().int().positive().max(25).default(5),
  ADMIN_EMAIL_WORKER_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  GALLERY_MAX_UPLOAD_MB: z.coerce.number().int().positive().max(1024).default(100),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(25),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@ifsmhp.local'),
  SEED_ADMIN_PASSWORD: z.string().min(12).default('ChangeMeNow!2026'),

  // --- Mail transport -------------------------------------------------------
  // All optional so the API still boots without mail configured; in that case
  // OTP delivery falls back to a development-only log (see mail.service.ts).
  // These are read here and nowhere else — they must never reach the frontend.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Envelope From. Falls back to SMTP_USER when unset. */
  MAIL_FROM: z.string().optional(),
  SAB_PREVIEW_EMAILS: z.string().default('').transform(value => [...new Set(value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean))]).pipe(z.array(z.string().email()).max(50)),
  ANNOUNCEMENT_WORKER_ENABLED: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
  ANNOUNCEMENT_WEB_URL: z.string().url().optional(),

  // --- One-time passcodes ---------------------------------------------------
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_MAX_RESENDS: z.coerce.number().int().positive().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  // Deliberately not using the logger: config is what the logger depends on.
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  /** Mail is only usable once a host and both credentials are present. */
  mailConfigured: Boolean(raw.SMTP_HOST && raw.SMTP_USER && raw.SMTP_PASS),
  mailFrom: raw.MAIL_FROM ?? raw.SMTP_USER ?? 'no-reply@ifsmhp.local',
  /** CLIENT_URL parsed into an origin allowlist for CORS. */
  allowedOrigins: raw.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
} as const;

export type Env = typeof env;
