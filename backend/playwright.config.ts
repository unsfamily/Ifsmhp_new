import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // This machine's Playwright CDN download times out. Installed Chrome
        // is the browser. Set PLAYWRIGHT_CHANNEL=chromium after
        // `npx playwright install chromium` to use the bundled browser instead.
        channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
