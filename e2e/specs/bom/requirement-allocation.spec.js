/**
 * BOM — requirement status and PO allocation from the job-work PO ledger (UI mock phase)
 *
 * Partially / Fully Used are no longer seeded: they are derived from the Cut Panel PO and
 * Garment Process PO ledger, whose seeded POs cover CPR-2026-00003 / -00005 and
 * GPR-2026-00003 / -00004. Every test gets a fresh browser context, so all three mock
 * stores start from the same seed.
 *
 * What this tests:
 *   - Lists show the derived status (CPR-3 Partially Used; GPR-4 Fully Used)
 *   - CPR-2026-00005 "PO allocation": Panel Printing 3,960 required, 800 PO'd (CPP-2026-00031),
 *     3,160 balance — the Cut Panel PO PRD §13.4 starting point; Panel Embroidery 3,966 in draft
 *   - GPR-2026-00003: the submitted GPO-2026-00003 already counts as PO'd (allocation from submit)
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';

const openAllocation = async (page, path) => {
  await navigateWithAuth(page, path);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'PO allocation' }).click();
  const drawer = page.locator('.ant-drawer-open').last();
  await expect(drawer.getByText('Purchase orders')).toBeVisible();
  return drawer;
};

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Lists show the status the PO ledger derives', async ({ page }) => {
  await navigateWithAuth(page, '/bom/cut-panel/list');
  await expect(page.locator('.ant-table-row').filter({ hasText: 'CPR-2026-00003' })).toContainText('Partially Used');
  await expect(page.locator('.ant-table-row').filter({ hasText: 'CPR-2026-00001' })).toContainText('Submitted');
  await navigateWithAuth(page, '/bom/garment-process/list');
  await expect(page.locator('.ant-table-row').filter({ hasText: 'GPR-2026-00004' })).toContainText('Fully Used');
});

test('Cut panel allocation per process step, with the POs raised against it', async ({ page }) => {
  const drawer = await openAllocation(page, '/bom/cut-panel/5');
  const printing = drawer.locator('.ant-table-row').filter({ hasText: 'Panel Printing' }).first();
  await expect(printing).toContainText('3,960');
  await expect(printing).toContainText('800');
  await expect(printing).toContainText('3,160');
  await expect(printing).toContainText('Partially allocated');
  await expect(drawer.locator('.ant-table-row').filter({ hasText: 'Panel Embroidery' }).first()).toContainText('3,966');
  await expect(drawer.getByRole('link', { name: 'CPP-2026-00031' })).toBeVisible();
  await expect(drawer.locator('.ant-table-row').filter({ hasText: 'CPP-2026-00034' })).toContainText('Draft');
});

test('A submitted Garment Process PO already counts against the requirement', async ({ page }) => {
  const drawer = await openAllocation(page, '/bom/garment-process/3');
  const line = drawer.locator('.ant-table-row').filter({ hasText: 'Garment Dyeing' }).first();
  await expect(line).toContainText('552');
  await expect(line).toContainText('414');
  await expect(line).toContainText('138');
  await expect(drawer.locator('.ant-table-row').filter({ hasText: 'GPO-2026-00003' })).toContainText('Submitted');
});
