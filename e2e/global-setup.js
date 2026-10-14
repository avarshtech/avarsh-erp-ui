/**
 * Playwright Global Setup — Authenticate once and save storage state.
 * All tests reuse the saved auth state so they don't need to log in individually.
 *
 * Environment variables (read through e2e/config/env.js):
 *   E2E_USERNAME — login username (default: superadmin)
 *   E2E_PASSWORD — login password (default: admin123, the e2e seed's superadmin)
 *
 * The login goes through the UI under test, which brings its own API address. A request to
 * another machine's API is stopped before it is sent and fails this setup, and with it every
 * project that depends on it, so the credentials never leave the machine.
 */

import { test as setup, expect } from '@playwright/test';
import { E2E_PASSWORD, E2E_USERNAME } from './config/env.js';
import { assertNoRemoteApi, blockRemoteApi } from './helpers/remote-api-guard.js';

const authFile = './e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const blocked = await blockRemoteApi(page);

  // Listen for console errors to help debug login failures
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Navigate to login page — use 'domcontentloaded' instead of 'networkidle'
  // to avoid timeouts from persistent connections (WebSocket, polling, etc.)
  await page.goto('/login', { waitUntil: 'domcontentloaded' });

  // Wait for the login form to be visible (page may show a spinner while checking auth)
  await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 30000 });
  assertNoRemoteApi(blocked);

  // Fill login form
  await page.getByPlaceholder('Username').fill(E2E_USERNAME);
  await page.getByPlaceholder('Password').fill(E2E_PASSWORD);

  // Click Sign In and wait until the login request has been answered or stopped
  const loginRequest = page.waitForRequest((request) => request.url().includes('/auth/login'), { timeout: 30000 });
  await page.getByRole('button', { name: /Sign In/i }).click();
  await loginRequest;
  assertNoRemoteApi(blocked);

  // Wait for redirect away from login page (successful auth navigates to dashboard)
  // Use a generous timeout — the API may take a few seconds on cold start
  await expect(page).not.toHaveURL(/login/, { timeout: 30000 });

  // Save authenticated state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
