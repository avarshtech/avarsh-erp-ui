/**
 * The Production Masters screen — the lists every sewing screen reads from.
 * A full create → edit → delete cycle on one master, plus a load check on the
 * rest, because a master that will not load takes its floor screen with it.
 */
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { settle, tableRows, expectToast, watchConsole } from './helpers.js';

const MASTERS = '/production/masters';
const TABS = [
  'Production Lines', 'Machine Types', 'Operations', 'Defect Types',
  'Lookups & Thresholds', 'Incentive Slabs', 'Measurement Charts',
];

async function openMasterTab(page, label) {
  await page.locator('.ant-tabs-tab').filter({ hasText: label }).first().click();
  await settle(page);
}

test.describe('Production Masters', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
    await navigateWithAuth(page, MASTERS);
    await waitForPageReady(page);
    await settle(page);
  });

  test('every master tab loads its list', async ({ page }) => {
    const errors = watchConsole(page);

    for (const label of TABS) {
      await openMasterTab(page, label);
      if (label === 'Measurement Charts') {
        // Chart is per style, so it starts empty until one is chosen.
        await expect(page.getByText(/Select a style/i)).toBeVisible({ timeout: 10000 });
        continue;
      }
      const rows = await tableRows(page);
      expect(rows.length, `${label} loaded no rows`).toBeGreaterThan(0);
    }

    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('a production line can be created, edited and deleted', async ({ page }) => {
    const name = `E2E-Line-${Date.now().toString().slice(-5)}`;
    await openMasterTab(page, 'Production Lines');

    // ── create ──
    await page.getByRole('button', { name: /Add Line/i }).click();
    await page.getByLabel(/Line Name/i).fill(name);

    const unit = page.locator('.ant-form-item').filter({ hasText: 'Unit (Factory)' }).locator('.ant-select');
    await unit.click();
    await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
      .first().click();

    await page.locator('.ant-form-item').filter({ hasText: 'Operator Capacity' })
      .locator('.ant-input-number-input').fill('18');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expectToast(page, /created/i);
    await settle(page);

    expect((await tableRows(page)).some((r) => r.includes(name))).toBe(true);

    // ── edit: Save stays disabled until something actually changes ──
    await page.locator('.ant-table-tbody tr').filter({ hasText: name }).first().click();
    await settle(page, 600);
    await expect(page.getByRole('button', { name: /^Save$/ })).toBeDisabled();

    await page.locator('.ant-form-item').filter({ hasText: 'Operator Capacity' })
      .locator('.ant-input-number-input').fill('26');
    await page.getByRole('button', { name: /^Save$/ }).click();
    await expectToast(page, /updated/i);
    await settle(page);

    expect((await tableRows(page)).find((r) => r.includes(name))).toContain('26');

    // ── delete ──
    await page.locator('.ant-table-tbody tr').filter({ hasText: name }).first().click();
    await settle(page, 600);
    await page.getByRole('button', { name: /Delete/i }).first().click();
    const confirm = page.locator('.ant-modal-confirm');
    await expect(confirm).toBeVisible({ timeout: 10000 });
    await confirm.getByRole('button', { name: /^Delete$/ }).click();
    await expectToast(page, /deleted/i);
    await settle(page);

    expect((await tableRows(page)).some((r) => r.includes(name))).toBe(false);
  });

  test('the incentive slab form refuses a band that ends below where it starts', async ({ page }) => {
    await openMasterTab(page, 'Incentive Slabs');
    await page.getByRole('button', { name: /Add Slab/i }).click();

    await page.getByLabel(/Slab Name/i).fill('E2E Bad Band');
    await page.locator('.ant-form-item').filter({ hasText: 'From Efficiency' })
      .locator('.ant-input-number-input').fill('90');
    await page.locator('.ant-form-item').filter({ hasText: 'To Efficiency' })
      .locator('.ant-input-number-input').fill('80');
    await page.locator('.ant-form-item').filter({ hasText: 'Amount per day' })
      .locator('.ant-input-number-input').fill('50');

    await page.getByRole('button', { name: /^Save$/ }).click();
    await expect(page.getByText(/must end above where it starts/i)).toBeVisible({ timeout: 10000 });
  });

  test('a measurement chart reads left to right in the size run', async ({ page }) => {
    await openMasterTab(page, 'Measurement Charts');

    const style = page.locator('.ant-card-extra .ant-select').first();
    await style.click();
    const options = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option');
    await options.first().waitFor({ state: 'visible', timeout: 10000 });

    // Try each style until one has a chart loaded.
    const total = await options.count();
    for (let i = 0; i < total; i++) {
      await options.nth(i).click();
      await settle(page);
      const headers = await page.locator('.ant-table-thead th').allInnerTexts();
      if (headers.length > 2) {
        const sizes = headers.slice(2).filter((h) => h.trim());
        expect(sizes.length, 'a loaded chart should have size columns').toBeGreaterThan(0);
        // Numeric-leading size runs must not be alphabetical: "104/4" before
        // "92/2" is exactly the bug this guards.
        const leading = sizes.map((s) => parseFloat(s)).filter((n) => !Number.isNaN(n));
        if (leading.length === sizes.length && leading.length > 1) {
          const sorted = [...leading].sort((a, b) => a - b);
          expect(leading, 'sizes should read in run order').toEqual(sorted);
        }
        return;
      }
      await style.click();
    }
    test.info().annotations.push({ type: 'note', description: 'No style had a chart uploaded — ordering not exercised.' });
  });
});
