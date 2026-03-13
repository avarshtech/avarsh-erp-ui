/**
 * Playwright Global Setup — Authenticate once and save storage state.
 * All tests reuse the saved auth state so they don't need to log in individually.
 *
 * Environment variables:
 *   E2E_USERNAME — login username (default: s)
 *   E2E_PASSWORD — login password (default: a)
 */

import { test as setup, expect } from '@playwright/test';
import process from 'process';

const authFile = './e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const username = process.env['E2E_USERNAME'] || 's';
  const password = process.env['E2E_PASSWORD'] || 'a';

  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Fill login form — Ant Design inputs use placeholder, not label
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);

  // Submit — button text is "Sign In"
  await page.getByRole('button', { name: /Sign In/i }).click();

  // Wait for redirect away from login page (successful auth)
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });

  // Save authenticated state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
