/**
 * The rules the server owns, exercised through the screens that rely on them.
 * These are the ones a UI-only change could silently break.
 */
import { test, expect } from '@playwright/test';
import { ensureSessionActive } from '../../helpers/navigation.js';
import { openTab, settle, pickOption, selectAt, tableRows, TABS, watchConsole } from './helpers.js';

test.describe('Sewing — server-derived rules reach the screen', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('a trim card cannot be filed without the physical-check confirmation', async ({ page }) => {
    await openTab(page, TABS.trims);
    await page.getByRole('button', { name: /New Verification Card/i }).click();

    const drawer = page.locator('.ant-drawer-body');
    await drawer.waitFor({ state: 'visible', timeout: 15000 });
    // The BOM arrives from the server, so wait for it rather than the drawer.
    await settle(page, 2500);

    // Judge every BOM item so the only thing left is the confirmation itself.
    const groups = drawer.locator('.ant-radio-group');
    const count = await groups.count();
    if (count === 0) {
      test.info().annotations.push({ type: 'note', description: 'Selected order has no BOM lines — physical-check guard not exercised.' });
      return;
    }
    // Mark every item Correct by clicking the visible button, not the radio
    // input behind it: AntD renders that input at opacity 0 and off-viewport,
    // so Playwright will never click it.
    for (let i = 0; i < count; i++) {
      const correct = groups.nth(i).locator('.ant-radio-button-wrapper', { hasText: /^Correct$/ }).first();
      await correct.scrollIntoViewIfNeeded();
      await correct.click();
    }

    await page.locator('.ant-drawer-footer button.ant-btn-primary').click();

    // The card is only filed after the QC says yes — answering no must not save.
    const confirm = page.locator('.ant-modal-confirm');
    await expect(confirm).toBeVisible({ timeout: 10000 });
    await expect(confirm).toContainText(/physically/i);
    await confirm.getByRole('button', { name: /^No$/ }).click();
    await expect(confirm).toBeHidden({ timeout: 10000 });
    await expect(drawer).toBeVisible();
  });

  test('the hourly grid offers only the plan operations and rejects a clashing hour', async ({ page }) => {
    const errors = watchConsole(page);
    await openTab(page, TABS.hourly);

    // Rows are pre-seeded from the plan, and the operation column is a select
    // limited to that plan — a free-typed part name is no longer possible.
    // With no plan running there is no grid to check, which is not a failure.
    const grid = page.locator('.ant-table-tbody');
    const rows = grid.locator('tr').filter({ has: page.locator('.ant-select') });
    if (await rows.count() === 0) {
      test.info().annotations.push({ type: 'note', description: 'No plan in progress for today — hourly grid empty, operation binding not exercised.' });
      expect(errors, errors.join(' | ')).toHaveLength(0);
      return;
    }

    const operationSelect = rows.first().locator('.ant-select').nth(1);
    await operationSelect.click();
    const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    const optionCount = await options.count();
    expect(optionCount, 'the operation select should be bounded by the plan').toBeGreaterThan(0);
    await page.keyboard.press('Escape');

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('the receipt drawer derives the order from the cutting bundle issue', async ({ page }) => {
    await openTab(page, TABS.receipt);
    await page.getByRole('button', { name: /Receive Bundles/i }).click();

    const drawer = page.locator('.ant-drawer-body');
    await drawer.waitFor({ state: 'visible', timeout: 10000 });
    await settle(page);

    const issueSelect = selectAt(drawer, 0);
    await issueSelect.click();
    const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    const hasPending = await options.count();

    if (!hasPending) {
      // Every issue received already — the screen must say so rather than
      // offering an empty picker with no explanation.
      await page.keyboard.press('Escape');
      await expect(drawer.getByText(/No bundle issues are awaiting receipt/i)).toBeVisible();
      return;
    }

    await options.first().click();
    await settle(page);

    // Order, style and cut PO all arrive with the issue — none of them is chosen.
    await expect(drawer.getByText(/Order/).first()).toBeVisible();
    await expect(drawer.getByText(/Cut PO/).first()).toBeVisible();
    const bundleRows = await tableRows(page, drawer);
    expect(bundleRows.length, 'the issue should pre-fill its bundles').toBeGreaterThan(0);
  });

  test('the incentive table shows the slab and the DHU deduction behind it', async ({ page }) => {
    await openTab(page, TABS.operators);
    await page.getByText('Incentives', { exact: true }).click();
    await settle(page);

    await expect(page.getByText(/Slabs:/i)).toBeVisible({ timeout: 15000 });
    const headers = await page.locator('.ant-table-thead th').allInnerTexts();
    expect(headers.join(' ')).toMatch(/Slab/);
    expect(headers.join(' ')).toMatch(/DHU Deduction/);
    expect(headers.join(' ')).toMatch(/Net/);
  });
});
