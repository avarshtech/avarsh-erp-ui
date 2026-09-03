/**
 * Playwright Global Setup — Authenticate once and save storage state.
 * All tests reuse the saved auth state so they don't need to log in individually.
 *
 * Environment variables:
 *   E2E_USERNAME — login username (default: superadmin)
 *   E2E_PASSWORD — login password (default: admin98)
 */

import { test as setup, expect } from '@playwright/test';
import process from 'process';

const authFile = './e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const username = process.env['E2E_USERNAME'] || 'superadmin';
  const password = process.env['E2E_PASSWORD'] || 'admin98';

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

  // Fill login form
  await page.getByPlaceholder('Username').fill(username);
  await page.getByPlaceholder('Password').fill(password);

  // Click Sign In
  await page.getByRole('button', { name: /Sign In/i }).click();

  // Wait for redirect away from login page (successful auth navigates to dashboard)
  // Use a generous timeout — the API may take a few seconds on cold start
  await expect(page).not.toHaveURL(/login/, { timeout: 30000 });

  // Save authenticated state (cookies + localStorage)
  await page.context().storageState({ path: authFile });
});
