/**
 * Production PO — UI-driven E2E tests
 *
 * Exercises the Production PO module the way a real user would:
 *   • Navigate via routing, fill Ant Design forms, switch tabs, click buttons.
 *   • Uses seeded CONFIRMED orders from V111__seed_orders.sql (ORD/0002, ORD/0003).
 *   • Each test uses unique identifiers (timestamp-scoped remarks) so tests don't
 *     interfere with each other on the shared H2 DB.
 *
 * Runs against the fresh H2 backend started by scripts/run-e2e.ps1 (profile=e2e).
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

// Helper: open an ant-select by label, type a search query, pick the option that contains a text.
async function pickOrderInSelect(page, orderNo) {
  // Open the Order combobox.
  const combobox = page.getByRole('combobox', { name: /Order/i }).first();
  await combobox.click();

  // Type the full order number character-by-character so each keystroke fires the
  // Select's onSearch handler the way a real human would. `pressSequentially` fires
  // real input events through the keyboard, which Ant Design debounces correctly.
  await combobox.pressSequentially(orderNo, { delay: 60 });

  // Wait for the async orders/search call that the form fires for our query.
  await page.waitForResponse(
    (r) => r.url().includes('/api/v1/orders/search') && r.request().method() === 'GET',
    { timeout: 10000 }
  ).catch(() => {});
  await page.waitForTimeout(600); // let React rebuild the option list

  // Wait for the dropdown to show our option, then click it.
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 10000 });
  const option = dropdown.locator('.ant-select-item-option').filter({ hasText: orderNo }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });

  // Wait for Style No to auto-populate AFTER clicking the option. Retry up to 3 times —
  // the Select's onSelect handler can race with the onSearch response rebuilding options;
  // re-clicking after the options list has settled drives the stateful side-effects reliably.
  let populated = false;
  for (let attempt = 0; attempt < 3 && !populated; attempt++) {
    await option.click();
    await page.keyboard.press('Escape').catch(() => {});
    await dropdown.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    try {
      await page.waitForFunction(
        () => {
          const items = Array.from(document.querySelectorAll('.ant-form-item'));
          const styleItem = items.find((el) => {
            const label = el.querySelector('.ant-form-item-label label');
            return label && label.textContent.trim() === 'Style No';
          });
          if (!styleItem) return false;
          const input = styleItem.querySelector('input');
          return input && input.value && input.value.length > 0;
        },
        { timeout: 3000 }
      );
      populated = true;
    } catch {
      // Re-open the dropdown and try again
      if (attempt < 2) {
        await combobox.click();
        await page.waitForTimeout(400);
      }
    }
  }
  if (!populated) {
    throw new Error(`Failed to auto-populate Style No after selecting ${orderNo}`);
  }
}

// Helper: fill an input inside a Form.Item matched by its label text.
async function fillByLabel(page, labelText, value) {
  const formItem = page.locator('.ant-form-item', { hasText: labelText }).first();
  const input = formItem.locator('input').first();
  await input.click();
  await input.fill(value);
}

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);

  // Capture browser console errors/warnings and page errors to surface them in test output.
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      // eslint-disable-next-line no-console
      console.log(`[browser:${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[browser:pageerror] ${err.message}`);
  });
});

test.describe('Production PO — UI Flow', () => {
  test('List page loads with header and table', async ({ page }) => {
    await goToListPage(page, '/production-po/list');
    await expect(page.getByRole('heading', { name: /Production PO/i }).first()).toBeVisible();
    await expect(page.locator('.ant-table').first()).toBeVisible();
  });

  test('Create Production PO — fill form through all 3 tabs and save', async ({ page }) => {
    const tag = STAMP();
    await navigateWithAuth(page, '/production-po/new');
    await page.waitForLoadState('networkidle').catch(() => {});

    // Tab 1 — General
    await pickOrderInSelect(page, 'ORD/0002');

    // Style No should auto-populate (disabled input)
    const styleNoItem = page.locator('.ant-form-item', { hasText: 'Style No' }).first();
    await expect(styleNoItem.locator('input')).not.toHaveValue('', { timeout: 5000 });

    await fillByLabel(page, 'Season', `SS${tag}`);
    await fillByLabel(page, 'Colour', 'Navy');

    // Tab 2 — Size-Color — verify matrix rows came from ORD/0002 (Olive Green / Burgundy)
    await page.getByRole('tab', { name: /Size-Color/ }).click();
    const sizeColorTable = page.locator('.ant-tabs-tabpane-active .ant-table-tbody').first();
    await expect(sizeColorTable).toBeVisible();
    await expect(sizeColorTable.locator('tr.ant-table-row').first()).toBeVisible();
    // ORD/0002 has Olive Green in line 1
    await expect(sizeColorTable).toContainText('Olive Green');

    // Tab 3 — Stages (11 rows)
    await page.getByRole('tab', { name: /Production Stages/ }).click();
    const stagesTable = page.locator('.ant-tabs-tabpane-active .ant-table-tbody').first();
    await expect(stagesTable).toBeVisible();
    // Expect core stages
    await expect(stagesTable).toContainText('Cutting');
    await expect(stagesTable).toContainText('Sewing');
    await expect(stagesTable).toContainText('Packing');
    // 11 stage rows total
    const stageRowCount = await stagesTable.locator('tr.ant-table-row').count();
    expect(stageRowCount).toBe(11);

    // Click Save (Save button in the header)
    const [saveResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/production-pos') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /Save$/i }).click(),
    ]);
    expect(saveResp.status()).toBeGreaterThanOrEqual(200);
    expect(saveResp.status()).toBeLessThan(300);

    // After save we navigate to /production-po/edit/:id
    await page.waitForURL(/\/production-po\/edit\/\d+/, { timeout: 15000 });

    // Header should now show "Edit PPO — PPO-YYYY-NNNN" — proves the POST response
    // body carried a valid id and ppoNumber that the form is rendering.
    await expect(page.getByRole('heading', { name: /Edit PPO — PPO-/ })).toBeVisible({ timeout: 10000 });
  });

  test('Start Production — transitions OPEN → IN_PROGRESS', async ({ page }) => {
    // Create a fresh PPO via the UI, then click Start Production.
    const tag = STAMP();
    await navigateWithAuth(page, '/production-po/new');
    await page.waitForLoadState('networkidle').catch(() => {});

    await pickOrderInSelect(page, 'ORD/0003');
    await fillByLabel(page, 'Season', `AW${tag}`);
    await fillByLabel(page, 'Colour', 'Heather Grey');

    // Save first
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/production-pos') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /Save$/i }).click(),
    ]);
    await page.waitForURL(/\/production-po\/edit\/\d+/, { timeout: 15000 });

    // Now click Start Production
    const startBtn = page.getByRole('button', { name: /Start Production/i });
    await expect(startBtn).toBeVisible({ timeout: 5000 });
    const [statusResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/production-pos/') && r.url().includes('/status'),
        { timeout: 15000 }
      ),
      startBtn.click(),
    ]);
    expect(statusResp.status()).toBeGreaterThanOrEqual(200);
    expect(statusResp.status()).toBeLessThan(300);

    // After status change, form redirects to /production-po/list
    await page.waitForURL(/\/production-po\/list/, { timeout: 15000 });
    await antTableWaitForData(page);

    // Verify there's at least one "In Progress" tag in the table
    const inProgressTag = page.locator('.ant-tag').filter({ hasText: /In Progress/i }).first();
    await expect(inProgressTag).toBeVisible({ timeout: 10000 });
  });

  test('Delete draft PPO from list via popconfirm', async ({ page }) => {
    // Create a throwaway PPO to delete
    const tag = STAMP();
    await navigateWithAuth(page, '/production-po/new');
    await page.waitForLoadState('networkidle').catch(() => {});

    await pickOrderInSelect(page, 'ORD/0002');
    await fillByLabel(page, 'Season', `DEL${tag}`);
    await fillByLabel(page, 'Colour', 'Delete-Me');

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/v1/production-pos') && r.request().method() === 'POST',
        { timeout: 20000 }
      ),
      page.getByRole('button', { name: /Save$/i }).click(),
    ]);
    await page.waitForURL(/\/production-po\/edit\/\d+/, { timeout: 15000 });

    // Capture the ppoNumber from the page header (shown next to the Status tag)
    // The form title is "Edit PPO — <ppoNumber>"; grab the PPO number from the URL via API call.
    // Simpler: go back to list and search by season tag via the search input.
    await navigateWithAuth(page, '/production-po/list');
    await antTableWaitForData(page);

    // Find the row containing the season tag we just set (Season column is visible in the list).
    const targetRow = page.locator('.ant-table-row', { hasText: `DEL${tag}` }).first();
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    // Click the delete icon button (ActionButton action="delete" renders a Button with .anticon-delete).
    const deleteBtn = targetRow.locator('button:has(.anticon-delete)').first();
    await deleteBtn.click();

    // Confirm the popconfirm (Ant Design popconfirm renders in a portal outside the table).
    const popconfirm = page.locator('.ant-popconfirm, .ant-popover').filter({ hasText: /Delete Production PO/i }).last();
    await popconfirm.waitFor({ state: 'visible', timeout: 5000 });
    await popconfirm.getByRole('button', { name: /ok|yes|delete|confirm/i }).click();

    // Wait for the row to disappear from the table after deletion.
    await expect(targetRow).toBeHidden({ timeout: 10000 });
  });
});
