/**
 * Bill Passing runs on the real API.
 *
 * This is the spec that would have caught the module still being on its
 * localStorage mock: every screen must issue a call to
 * /api/v1/inventory/bill-passing and render what comes back. The mock served
 * all of it without touching the network, so "made an API call" is the
 * assertion that actually distinguishes the two.
 *
 * It then walks one bill up the ladder through the screens, because the parts
 * most likely to break at cutover are the ones where the workspace and the
 * server disagree about a field name or a version.
 *
 * Everything is built on the E2E-BP-1 purchase order from db/e2eseed, which
 * carries two receipts and three inspections of its own so this suite never
 * depends on another module having run first.
 *
 * The lifecycle case bills a receipt line, and a billed line stops being
 * offered — the PO carries two billable lines (the third is a wholly rejected
 * inspection), so it survives two runs against one API instance. The e2e
 * database is in-memory H2 and is reseeded on every boot, which is the reset.
 */
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, goToMasterEntity } from '../../helpers/navigation.js';

const BP_ENDPOINT = /\/api\/v1\/inventory\/bill-passing/;

/** Land on a route with its first fetches settled. */
async function goTo(page, path) {
  await navigateWithAuth(page, path);
  await waitForPageReady(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(700);
}

/**
 * Client-side errors that would otherwise pass silently.
 *
 * The service worker is only built for production, so under `vite dev` its
 * registration fails with an HTML MIME type. That is the harness, not the app.
 */
const ENVIRONMENTAL = /ServiceWorker|service worker|unsupported MIME type|favicon|ResizeObserver/i;

function watchConsole(page) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !ENVIRONMENTAL.test(m.text())) errors.push(m.text());
  });
  page.on('pageerror', (e) => {
    if (!ENVIRONMENTAL.test(String(e))) errors.push(String(e));
  });
  return errors;
}

async function pickOption(page, selectLocator, optionText) {
  await selectLocator.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    .locator('.ant-select-item-option')
    .filter({ hasText: optionText })
    .first();
  await option.waitFor({ state: 'visible', timeout: 15000 });
  await option.click();
  await page.waitForTimeout(250);
}

test.describe('Bill Passing', () => {
  test('the list loads from the API and shows its KPI cards', async ({ page }) => {
    const errors = watchConsole(page);
    const calls = [];
    page.on('request', (r) => {
      if (BP_ENDPOINT.test(r.url())) calls.push(r.url());
    });

    await goTo(page, '/inventory/bill-passing');

    await expect(page.getByRole('heading', { name: /Bill Passing/i }).first()).toBeVisible();
    expect(calls.some((u) => u.includes('/inventory/bill-passing')), 'called the bill passing API')
      .toBeTruthy();

    // The six cards read the stats block the list endpoint carries.
    await expect(page.getByText('Pending Verification').first()).toBeVisible();
    await expect(page.getByText('On Hold / Query / Referred').first()).toBeVisible();

    expect(errors, 'no console errors').toEqual([]);
  });

  test('the line register lists the seeded receipts', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => {
      if (r.url().includes('/bill-passing/lines')) calls.push(r.url());
    });

    await goTo(page, '/inventory/bill-passing');
    await page.getByText('Lines', { exact: true }).first().click();
    await page.waitForTimeout(900);

    expect(calls.length, 'called the register endpoint').toBeGreaterThan(0);
    // The seed bills a fabric line and a trims line against E2E-BP-1.
    await expect(page.getByText('E2E-BP-1').first()).toBeVisible();
  });

  test('the configuration masters load from the API', async ({ page }) => {
    const calls = [];
    page.on('request', (r) => {
      if (r.url().includes('/bill-passing/masters')) calls.push(r.url());
    });

    // The four screens live inside the master dashboard rather than on routes
    // of their own, so they are reached through its nav.
    await goToMasterEntity(page, 'Debit Types');
    expect(calls.length, 'called the masters API').toBeGreaterThan(0);
    await expect(page.getByText(/Material Rejection/i).first()).toBeVisible({ timeout: 20000 });
  });

  test('a bill is raised, saved, referred back and resubmitted', async ({ page }) => {
    test.setTimeout(180000);
    const errors = watchConsole(page);

    await goTo(page, '/inventory/bill-passing');

    // ── raise it ────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /New Bill Passing/i }).click();
    const dialog = page.getByRole('dialog', { name: /New Bill Passing/i });
    await expect(dialog).toBeVisible({ timeout: 20000 });

    await pickOption(page, dialog.locator('.ant-select').first(), 'Arvind');
    await page.waitForTimeout(600);
    await pickOption(page, dialog.locator('.ant-select').nth(1), 'E2E-BP-1');

    await dialog.getByRole('button', { name: /Create Draft Bill/i }).click();
    await page.waitForURL(/\/inventory\/bill-passing\/\d+/, { timeout: 30000 });
    await waitForPageReady(page);
    await page.waitForTimeout(900);

    // The workspace opens on a real record with a reserved number.
    await expect(page.getByText(/BP\/\d{2}-\d{2}\//).first()).toBeVisible();
    await expect(page.getByText('Draft').first()).toBeVisible();

    // ── key the invoice and pick a line ─────────────────────────────────────
    const invoiceNo = `E2E-${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder('As printed on the supplier invoice').fill(invoiceNo);

    // Take the first billable receipt line. The page header is sticky, so
    // Playwright's scroll-into-view can leave the row beneath it; a person
    // simply scrolls past, which is what force models here. The line whose QC
    // rejected everything has its checkbox disabled, so `first()` is one that
    // can actually be billed.
    const firstRowCheckbox = page.locator('.ant-table-row .ant-checkbox-wrapper:not(.ant-checkbox-wrapper-disabled)').first();
    await firstRowCheckbox.waitFor({ state: 'visible', timeout: 20000 });
    await firstRowCheckbox.click({ force: true });
    await page.waitForTimeout(600);

    await page.getByRole('button', { name: /^save Save$/i }).click();
    await expect(page.getByText(/Bill saved/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);

    // Saving twice must not duplicate the lines, and must not be rejected as
    // stale: the screen adopts the version the server returned.
    await page.getByRole('button', { name: /^save Save$/i }).click();
    await expect(page.getByText(/Bill saved/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);

    // ── submit ──────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: /^send Submit$/i }).click();
    await page.getByRole('button', { name: /Save & Submit/i }).click();
    await expect(page.getByText(/submitted for verification/i).first())
      .toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(800);
    await expect(page.getByText('Submitted').first()).toBeVisible();

    // A submitted bill is still editable — the rule the product team asked for.
    await expect(page.getByRole('button', { name: /^save Save$/i })).toBeVisible();

    // ── refer it back, then resubmit ────────────────────────────────────────
    await page.getByRole('button', { name: /Start Verification/i }).click();
    await page.getByRole('button', { name: /^Start$/ }).click();
    await page.waitForTimeout(1200);

    await page.getByRole('button', { name: /Refer Back/i }).click();
    const reasonBox = page.getByRole('dialog').locator('textarea').first();
    await reasonBox.waitFor({ state: 'visible', timeout: 15000 });
    await reasonBox.fill('Invoice date was keyed as the challan date. Please correct and resubmit.');
    await page.getByRole('dialog').getByRole('button', { name: /Confirm/i }).click();
    await expect(page.getByText(/referred back/i).first()).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(800);

    // The clerk sees why it came back.
    await expect(page.getByText(/Referred back for correction/i).first()).toBeVisible();

    await page.getByRole('button', { name: /^send Submit$/i }).click();
    await page.getByRole('button', { name: /Save & Submit/i }).click();
    await expect(page.getByText(/submitted for verification/i).first())
      .toBeVisible({ timeout: 30000 });

    expect(errors, 'no console errors').toEqual([]);
  });
});
