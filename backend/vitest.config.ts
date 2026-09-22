import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    setupFiles: ['tests/audit-contract.ts'],
    // These suites are integration tests against one real MySQL database, and
    // each file wipes and recreates its own fixtures in beforeEach. Run in
    // parallel and one file's wipe lands in the middle of another file's
    // assertions, which showed up as tests failing at random across the suite.
    fileParallelism: false,
  },
});
