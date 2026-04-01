/**
 * Playwright Global Setup — Authenticate once and save storage state.
 * All tests reuse the saved auth state so they don't need to log in individually.
 *
 * Environment variables:
 *   E2E_USERNAME — login username (default: superadmin)
 *   E2E_PASSWORD — login password (default: admin123)
 */

import { test as setup, expect } from '@playwright/test';
import process from 'process';

const authFile = './e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const username = process.env['E2E_USERNAME'] || 'superadmin';
  const password = process.env['E2E_PASSWORD'] || 'admin123';

  // Listen for console errors to help debug login failures
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // Navigate to login page
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  // Wait for the login form to be visible (page may show a spinner while checking auth)
  await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 15000 });

  // Fill login form
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);

  // Click Sign In and simultaneously wait for the auth API response
  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes('/auth/login') && resp.request().method() === 'POST',
      { timeout: 30000 }
    ),
    page.getByRole('button', { name: /Sign In/i }).click(),
  ]);

  // Verify the API returned 200 — log details if not
  const status = loginResponse.status();
  if (status !== 200) {
    const body = await loginResponse.text().catch(() => '(unable to read body)');
    throw new Error(
      `Login API returned ${status}. Body: ${body}\nConsole errors: ${consoleErrors.join('\n')}`
    );
  }

  // Wait for redirect away from login page (successful auth navigates to dashboard)
  await expect(page).not.toHaveURL(/login/, { timeout: 15000 });

  // Save authenticated state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
