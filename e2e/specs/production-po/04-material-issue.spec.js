// Material Issue journey — issues real GRN stock against the production POs
// created by specs 01/02: a partial fabric-roll issue (split) against the
// approved Cutting PO and an accessories issue against the approved Work
// Order. Asserts the MIS/ document is persisted and appears in the list,
// proving the stock decrement path (backend rejects the save otherwise).
// Idempotent: small quantities against the large V117 stock budget
// (ROLL-E2E-001 800kg, TRM-BTN-001 30000pc) tolerate repeated runs.
import { test, expect } from '@playwright/test';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';
import { waitForTableSettled } from '../../helpers/ui-master.js';
import { selectOptionByText, expectSuccessToast } from './helpers.js';

const ORDER_NO = 'ORD/0003';
const FABRIC_ROLL = 'ROLL-E2E-001';
const TRIM_CODE = 'TRM-BTN-001';

/** Wait for the freshly-created MIS row to appear on the list we landed on. */
async function expectIssueRowVisible(page, issueNumber) {
  await waitForPageReady(page);
  await waitForTableSettled(page);
  await expect(page.locator('.ant-table-row', { hasText: issueNumber }).first())
    .toBeVisible({ timeout: 15000 });
}

/** Pull the MIS/… number out of the success toast so the list check is exact. */
async function readIssueNumberFromToast(page) {
  const toast = page.locator('.ant-message-notice', { hasText: /MIS\// }).first();
  await expect(toast).toBeVisible({ timeout: 15000 });
  const text = await toast.innerText();
  const match = text.match(/MIS\/[0-9-]+\/\d+/);
  expect(match, `toast should contain an MIS number: "${text}"`).toBeTruthy();
  return match[0];
}

test.describe('Material Issue', () => {
  test.beforeEach(async ({ page }) => {
    await ensureSessionActive(page);
  });

  test('issue a partial fabric roll (split) against the approved Cutting PO', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/issue/fabric/new');
    await waitForPageReady(page);

    // Cutting PO from spec 01, then its (single) fabric line for ORD/0003.
    await selectOptionByText(page, 'Cutting PO', 'CPO/');
    await selectOptionByText(page, 'Cutting PO Line', ORDER_NO);

    // Real GRN rolls arrive from /material-issues/issuable-rolls.
    const rollRow = page.locator('.ant-table-row', { hasText: FABRIC_ROLL }).first();
    await expect(rollRow).toBeVisible({ timeout: 15000 });

    // Split off a 50kg slice — the issued sub-roll (-A) is auto-selected.
    await rollRow.getByRole('button', { name: /Split/ }).click();
    const popover = page.locator('.ant-popover:visible').first();
    await expect(popover).toBeVisible();
    const qtyInput = popover.locator('input').first();
    await qtyInput.fill('50');
    await popover.getByRole('button', { name: /^Split$/ }).click();
    await expect(page.locator('.ant-table-row', { hasText: `${FABRIC_ROLL}-A` }).first())
      .toBeVisible({ timeout: 5000 });

    await page.getByPlaceholder('Name of receiver').fill('E2E Cutting Master');
    // ActionButton's accessible name includes the icon alt ("send Issue").
    await page.getByRole('button', { name: /\bIssue$/ }).click();

    const issueNumber = await readIssueNumberFromToast(page);
    await expectSuccessToast(page, /stock cleared/i);
    await expectIssueRowVisible(page, issueNumber);
  });

  test('issue accessories against the approved Work Order', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/issue/accessories/new');
    await waitForPageReady(page);

    await selectOptionByText(page, 'Work Order', 'WO/');

    // BOM items table hydrates from /material-issues/work-orders.
    const trimRow = page.locator('.ant-table-row', { hasText: TRIM_CODE }).first();
    await expect(trimRow).toBeVisible({ timeout: 15000 });
    await trimRow.locator('input').first().fill('500');

    await page.getByPlaceholder('Name of receiver').fill('E2E Line Incharge');
    // ActionButton's accessible name includes the icon alt ("send Issue").
    await page.getByRole('button', { name: /\bIssue$/ }).click();

    const issueNumber = await readIssueNumberFromToast(page);
    // Landing page defaults to the Fabric segment — flip to Accessories first.
    await waitForPageReady(page);
    await page.locator('.ant-segmented-item', { hasText: /Accessories Material Issue/ }).click();
    await expectIssueRowVisible(page, issueNumber);
  });
});
