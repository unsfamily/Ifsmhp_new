/**
 * Prisma client singleton.
 *
 * Milestone 3 introduces the schema and the generated client. Until `prisma
 * generate` has been run against a real schema, importing this module fails
 * loudly — which is correct. A stub client that silently returns empty
 * results would let the frontend look functional while doing nothing
 * (spec §67 — never fabricate functionality).
 *
 * The schema lives at `database/prisma/schema.prisma` (path configured in
 * package.json), so migrations and seeds sit alongside it rather than in a
 * separate top-level directory.
 *
 * Uncomment once the schema exists:
 *
 * import { PrismaClient } from '@prisma/client';
 * import { env } from './env';
 *
 * const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
 *
 * export const prisma =
 *   globalForPrisma.prisma ??
 *   new PrismaClient({ log: env.isProduction ? ['error'] : ['warn', 'error'] });
 *
 * // Prevents connection-pool exhaustion from hot reloads in development.
 * if (!env.isProduction) globalForPrisma.prisma = prisma;
 */

export {};
