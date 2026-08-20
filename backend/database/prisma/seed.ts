/**
 * Development seed data.
 *
 * DEMO DATA ONLY — never run against production (spec §53).
 *
 * Populated in Milestone 3 once models exist. Every seeded record will be
 * clearly marked as demo data so it can never be mistaken for real
 * membership records.
 */
async function main(): Promise<void> {
  console.log('[seed] No models defined yet — seeding is implemented in Milestone 3.');
}

main().catch((error) => {
  console.error('[seed] Failed:', error);
  process.exit(1);
});
