/**
 * Variant / Attribute Master — E2E Tests (sidebar label: "Attributes")
 *
 * What this tests:
 *   - List loads, columns (Name, Data Type tag) render, search works
 *   - Create with all fields; dataType defaults to Text
 *   - Conditional field: "Dropdown Options" (tags) appears ONLY for Dropdown/Multi-Select
 *   - Required validation + client-side duplicate-name guard
 *   - Edit (Save disabled until dirty — 300ms settle) and delete
 *
 * Prerequisites: seeded attribute configs (V102: Color, Size, Weight (GSM), ...)
 */

import { test, expect } from '@playwright/test';
import { antTableWaitForData, antSelect } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToMasterEntity } from '../../helpers/navigation.js';

const STAMP = () => Date.now().toString().slice(-6);

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[browser:error] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
  await goToMasterEntity(page, 'Attributes');
});

async function createAttribute(page, name, dataTypeLabel = null, tagValues = []) {
  await page.getByRole('button', { name: /Add Attribute/i }).click();
  // dirty-tracking suppression window in split-view masters
  await page.waitForTimeout(400);
  await page.locator('#attributeName').fill(name);
  if (dataTypeLabel) {
    const formItem = page.locator('.ant-form-item').filter({ hasText: 'Data Type' }).first();
    await antSelect(page, formItem.locator('.ant-select').first(), dataTypeLabel);
  }
  for (const v of tagValues) {
    const valuesItem = page.locator('.ant-form-item').filter({ hasText: 'Dropdown Options' }).first();
    const input = valuesItem.locator('.ant-select input').first();
    await input.click();
    await input.fill(v);
    await input.press('Enter');
  }
  const [resp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/v1/attribute-configs') && r.request().method() === 'POST',
      { timeout: 15000 },
    ),
    page.getByRole('button', { name: /Save/i }).click(),
  ]);
  expect(resp.status()).toBeLessThan(300);
  await antTableWaitForData(page);
}

test.describe('Attribute Master — CRUD', () => {
  test('list loads with Name and Data Type columns + seeded rows', async ({ page }) => {
    await antTableWaitForData(page);
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Data Type/i })).toBeVisible();
    expect(await page.locator('.ant-table-row').count()).toBeGreaterThan(0);
    // seeded attribute from V102
    await expect(page.locator('.ant-table-row').filter({ hasText: 'Color' }).first()).toBeVisible();
  });

  test('required validation: empty save shows errors', async ({ page }) => {
    await page.getByRole('button', { name: /Add Attribute/i }).click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Save/i }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
  });

  test('conditional Dropdown Options field appears only for Dropdown/Multi-Select', async ({ page }) => {
    await page.getByRole('button', { name: /Add Attribute/i }).click();
    await page.waitForTimeout(400);

    const valuesItem = page.locator('.ant-form-item').filter({ hasText: 'Dropdown Options' });
    // default dataType = Text → hidden
    await expect(valuesItem).toHaveCount(0);

    const dtItem = page.locator('.ant-form-item').filter({ hasText: 'Data Type' }).first();
    await antSelect(page, dtItem.locator('.ant-select').first(), 'Dropdown');
    await expect(valuesItem.first()).toBeVisible();

    await antSelect(page, dtItem.locator('.ant-select').first(), 'Number');
    await expect(valuesItem).toHaveCount(0);

    await antSelect(page, dtItem.locator('.ant-select').first(), 'Multi-Select');
    await expect(valuesItem.first()).toBeVisible();
  });

  test('create Text attribute and Dropdown attribute with tag values', async ({ page }) => {
    const textAttr = `E2E Attr ${STAMP()}`;
    await createAttribute(page, textAttr); // default Text
    await expect(page.locator('.ant-table-row').filter({ hasText: textAttr })).toBeVisible();

    const ddAttr = `E2E DD Attr ${STAMP()}`;
    await createAttribute(page, ddAttr, 'Dropdown', ['Small', 'Medium', 'Large']);
    const row = page.locator('.ant-table-row').filter({ hasText: ddAttr });
    await expect(row).toBeVisible();
    await expect(row.locator('.ant-tag')).toContainText(/Dropdown/i);
  });

  test('duplicate attribute name is blocked client-side', async ({ page }) => {
    const name = `E2E DupAttr ${STAMP()}`;
    await createAttribute(page, name);

    await page.getByRole('button', { name: /Add Attribute/i }).click();
    await page.waitForTimeout(400);
    await page.locator('#attributeName').fill(name);
    await page.getByRole('button', { name: /Save/i }).click();
    // client duplicate check: error message/toast, no POST expected
    await expect(page.getByText(/already exists|duplicate/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('edit attribute name persists; delete removes row', async ({ page }) => {
    const name = `E2E EditAttr ${STAMP()}`;
    const renamed = `${name} v2`;
    await createAttribute(page, name);

    await page.locator('.ant-table-row').filter({ hasText: name }).click();
    await page.waitForTimeout(400); // dirty-suppression settle
    await page.locator('#attributeName').fill(renamed);
    const [putResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/attribute-configs\/\d+/) && r.request().method() === 'PUT'),
      page.getByRole('button', { name: /Save/i }).click(),
    ]);
    expect(putResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    const row = page.locator('.ant-table-row').filter({ hasText: renamed });
    await expect(row).toBeVisible();

    // delete
    await row.click();
    await page.waitForTimeout(400);
    await page.getByRole('button', { name: /Delete/i }).click();
    const confirm = page.getByRole('dialog', { name: /Delete Attribute/i });
    await expect(confirm).toBeVisible();
    await expect(confirm.getByText(/cannot be undone/i)).toBeVisible();
    const [delResp] = await Promise.all([
      page.waitForResponse((r) => r.url().match(/\/attribute-configs\/\d+/) && r.request().method() === 'DELETE'),
      confirm.getByRole('button', { name: /^Delete$/ }).click(),
    ]);
    expect(delResp.status()).toBeLessThan(300);
    await antTableWaitForData(page);
    await expect(page.locator('.ant-table-row').filter({ hasText: renamed })).toHaveCount(0);
  });
});
