import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.js/,
    },
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        storageState: './e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  // No webServer — start `npm run dev` manually before running tests.
  // This avoids timeout issues on Windows and lets you reuse your running server.
});
