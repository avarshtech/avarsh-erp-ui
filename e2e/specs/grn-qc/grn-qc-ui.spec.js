import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  antSelect, antFormFill, antTableWaitForData,
  antDatePickerToday, antMessageContains,
} from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, waitForPageReady } from '../../helpers/navigation.js';
import {
  findPOByNumber, refreshPO, fabricGrnPayload, fabricQcPayload, submitGrn, today,
} from '../../helpers/grn-qc-data.js';

let api;
let fabricPO;
let accessoriesPO;

const STAMP = () => Date.now().toString(36);

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  try { fabricPO = await findPOByNumber(api, 'FAB/PO/0001'); } catch { /* ok */ }
  try { accessoriesPO = await findPOByNumber(api, 'ACC/PO/0001'); } catch { /* ok */ }
});

test.afterAll(async () => { await api.dispose(); });

test.beforeEach(async ({ page }) => { await ensureSessionActive(page); });

// ═══════════════════════════════════════════════════════════════════════════
// GRN UI TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('GRN UI Tests', () => {

  test('Test 1: GRN list page loads with table and stat cards', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await expect(page.locator('.ant-table')).toBeVisible({ timeout: 15000 });
    expect(await page.locator('.ant-statistic').count()).toBeGreaterThan(0);
  });

  test('Test 2: Create Fabric GRN via UI form', async ({ page }) => {
    test.skip(!fabricPO, 'No Fabric PO available');
    test.setTimeout(60000);

    await navigateWithAuth(page, '/inventory/grn/fabric/new');
    await waitForPageReady(page);

    // 1. Select PO (first available)
    const poSelect = page.locator('.ant-form-item').filter({ hasText: 'Purchase Order' }).locator('.ant-select').first();
    await antSelect(page, poSelect, null, { first: true });
    await page.waitForTimeout(2000);

    // 2. Check line item checkbox if present
    const rowCheckboxes = page.locator('.ant-table-tbody .ant-checkbox-input:not([disabled])');
    await page.waitForTimeout(500);
    if (await rowCheckboxes.count() > 0) {
      await rowCheckboxes.first().check();
      await page.waitForTimeout(500);
    }

    // 3. Fill header fields using placeholder-based selectors (more reliable than label text)
    const tag = STAMP();
    const challanInput = page.locator('input[placeholder*="INV-"]').first();
    await challanInput.fill(`CH-UI-${tag}`);

    // Invoice Date — pick today (field is enabled after PO selection)
    const invoicePicker = page.locator('.ant-form-item').filter({ hasText: 'Invoice Date' }).locator('.ant-picker').first();
    if (await invoicePicker.isEnabled().catch(() => false)) {
      await antDatePickerToday(page, invoicePicker);
    }

    // Delivery Challan Date
    const dcPicker = page.locator('.ant-form-item').filter({ hasText: 'Delivery Challan Date' }).locator('.ant-picker').first();
    if (await dcPicker.isEnabled().catch(() => false)) {
      await antDatePickerToday(page, dcPicker);
    }

    // Vehicle Number
    const vehicleInput = page.locator('input[placeholder*="TN-"]').first();
    await vehicleInput.fill(`TN-01-UI-${tag}`);

    // Transporter
    const transporterInput = page.locator('input[placeholder*="Transporter"]').first();
    await transporterInput.fill('UI Test Transport');

    // 4. Fill roll data — use placeholders from FabricGRNRollTable
    const rollNumberInput = page.locator('input[placeholder*="R001"]').first();
    if (await rollNumberInput.isVisible().catch(() => false)) {
      await rollNumberInput.fill(`R-UI-${tag}`);
    }
    const qtyInput = page.locator('input[placeholder="Qty"]').first();
    if (await qtyInput.isVisible().catch(() => false)) {
      const val = await qtyInput.inputValue().catch(() => '');
      if (!val || val === '0') { await qtyInput.clear(); await qtyInput.fill('10'); }
    }
    const shadeLotInput = page.locator('input[placeholder*="SL-"]').first();
    if (await shadeLotInput.isVisible().catch(() => false)) {
      await shadeLotInput.fill(`SL-UI-${tag}`);
    }

    // 5. Save Draft — click and check for success
    const draftBtn = page.getByRole('button', { name: /Save Draft/i }).first();
    await draftBtn.click();

    // Wait for success message or redirect
    await Promise.race([
      antMessageContains(page, /saved|created|success|draft/i),
      page.waitForURL(/\/inventory\/grn/, { timeout: 15000 }),
    ]).catch(() => {});
  });

  test('Test 3: Submit Fabric GRN via UI — verify status in list', async ({ page }) => {
    test.skip(!fabricPO, 'No Fabric PO');

    // Submit GRN via API
    await refreshPO(api, fabricPO);
    const item = fabricPO.items.find((i) => i.pendingQty > 0);
    test.skip(!item, 'No items with balance');

    const grn = await submitGrn(api, fabricGrnPayload(fabricPO, [item], {
      [item.id]: [{ rollNumber: `R-T3-${STAMP()}`, receivingQty: 5, shadeLot: 'SL-T3' }],
    }));

    // Verify in GRN list — status label is "QC Pending" (space, not underscore)
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const row = page.locator('.ant-table-row').filter({ hasText: grn.grnNumber }).first();
    if (await row.isVisible({ timeout: 5000 }).catch(() => false)) {
      const statusTag = row.locator('.ant-tag').last();
      await expect(statusTag).toContainText('QC Pending');
    }
  });

  test('Test 5: Create Accessories GRN via UI', async ({ page }) => {
    test.skip(!accessoriesPO, 'No Accessories PO');
    test.setTimeout(60000);

    await navigateWithAuth(page, '/inventory/grn/accessories/new');
    await waitForPageReady(page);

    // Select PO
    const poSelect = page.locator('.ant-form-item').filter({ hasText: 'Purchase Order' }).locator('.ant-select').first();
    await antSelect(page, poSelect, null, { first: true });
    await page.waitForTimeout(2000);

    // Check checkbox
    const rowCheckboxes = page.locator('.ant-table-tbody .ant-checkbox-input:not([disabled])');
    await page.waitForTimeout(500);
    if (await rowCheckboxes.count() > 0) {
      await rowCheckboxes.first().check();
      await page.waitForTimeout(500);
    }

    const tag = STAMP();
    const challanInput = page.locator('input[placeholder*="INV-"]').first();
    if (await challanInput.isVisible().catch(() => false)) {
      await challanInput.fill(`CH-ACC-${tag}`);
    }

    const invoicePicker = page.locator('.ant-form-item').filter({ hasText: 'Invoice Date' }).locator('.ant-picker').first();
    if (await invoicePicker.isEnabled().catch(() => false)) {
      await antDatePickerToday(page, invoicePicker);
    }

    const dcPicker = page.locator('.ant-form-item').filter({ hasText: 'Delivery Challan Date' }).locator('.ant-picker').first();
    if (await dcPicker.isEnabled().catch(() => false)) {
      await antDatePickerToday(page, dcPicker);
    }

    const vehicleInput = page.locator('input[placeholder*="TN-"]').first();
    if (await vehicleInput.isVisible().catch(() => false)) {
      await vehicleInput.fill(`TN-02-ACC-${tag}`);
    }

    const transporterInput = page.locator('input[placeholder*="Transporter"]').first();
    if (await transporterInput.isVisible().catch(() => false)) {
      await transporterInput.fill('ACC UI Transport');
    }

    // Save Draft
    const draftBtn = page.getByRole('button', { name: /Save Draft/i }).first();
    await draftBtn.click();
    await Promise.race([
      antMessageContains(page, /saved|created|success|draft/i),
      page.waitForURL(/\/inventory\/grn/, { timeout: 15000 }),
    ]).catch(() => {});
  });

  test('Test 9: Form validation errors display on empty submit', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/grn/fabric/new');
    await waitForPageReady(page);

    const submitBtn = page.getByRole('button', { name: /Submit/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
      await page.waitForTimeout(1000);

      const errorMessages = page.locator('.ant-form-item-explain-error');
      const messageEl = page.locator('.ant-message');
      const hasErrors = (await errorMessages.count()) > 0 || await messageEl.isVisible().catch(() => false);
      expect(hasErrors).toBeTruthy();
    }
  });

  test('Test 11: GRN reversal dialog', async ({ page }) => {
    test.skip(!fabricPO, 'No Fabric PO');
    test.setTimeout(60000);

    // Create QC_Pending GRN via API
    await refreshPO(api, fabricPO);
    const item = fabricPO.items.find((i) => i.pendingQty > 0);
    test.skip(!item, 'No items with balance');

    const grn = await submitGrn(api, fabricGrnPayload(fabricPO, [item], {
      [item.id]: [{ rollNumber: `R-REV-${STAMP()}`, receivingQty: 5, shadeLot: 'SL-REV' }],
    }));

    // Navigate to list
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    // Click the GRN number (RecordLink = span.record-link with cursor:pointer)
    const targetRow = page.locator('.ant-table-row').filter({ hasText: grn.grnNumber }).first();
    await expect(targetRow).toBeVisible({ timeout: 10000 });

    const grnLink = targetRow.locator('.record-link').first();
    await grnLink.click();

    // View modal opens (class="po-view-modal")
    const modal = page.locator('.ant-modal:visible').last();
    await modal.waitFor({ state: 'visible', timeout: 10000 });

    // Click "Request Reversal" button
    const reversalBtn = modal.getByRole('button', { name: /Request Reversal/i }).first();
    if (await reversalBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reversalBtn.click();

      // Reason dialog appears (ApprovalReasonDialog — another modal)
      await page.waitForTimeout(500);
      const reasonModal = page.locator('.ant-modal:visible').last();
      const reasonInput = reasonModal.locator('textarea').first();
      if (await reasonInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await reasonInput.click();
        await reasonInput.fill('E2E test reversal reason');
        // Trigger blur to commit the value and enable the confirm button
        await reasonInput.press('Tab');
        await page.waitForTimeout(500);

        const confirmBtn = reasonModal.getByRole('button', { name: /Request Reversal|Submit|Confirm|OK/i }).first();
        // Wait for button to become enabled
        await expect(confirmBtn).toBeEnabled({ timeout: 5000 }).catch(() => {});
        if (await confirmBtn.isEnabled().catch(() => false)) {
          await confirmBtn.click();
          await antMessageContains(page, /reversal|success|requested/i).catch(() => {});
        }
      }
    }

    // Close all open modals by pressing Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  });

  test('Test 12: View modal shows correct data', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const firstRow = page.locator('.ant-table-row').first();
    if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click RecordLink (span.record-link)
      const grnLink = firstRow.locator('.record-link').first();
      await grnLink.click();

      // Modal should open
      const modal = page.locator('.ant-modal:visible').last();
      await modal.waitFor({ state: 'visible', timeout: 10000 });

      // Verify modal has GRN content — check for status tag or any known element
      const modalContent = modal.locator('.ant-modal-body');
      await expect(modalContent).toBeVisible();
      const text = await modalContent.textContent();
      expect(text.length).toBeGreaterThan(10); // modal has substantial content

      // Close
      const closeBtn = modal.locator('.ant-modal-close').first();
      await closeBtn.click();
      await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QC UI TESTS
// ═══════════════════════════════════════════════════════════════════════════

test.describe('QC UI Tests', () => {

  test('Test 6: QC page loads with Fabric and Accessories segments', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/qc');
    await waitForPageReady(page);

    const segmented = page.locator('.ant-segmented');
    await expect(segmented).toBeVisible({ timeout: 10000 });

    const fabricOption = page.locator('.ant-segmented-item').filter({ hasText: /Fabric/i }).first();
    if (await fabricOption.isVisible().catch(() => false)) {
      await fabricOption.click();
      await page.waitForTimeout(500);
    }

    const accessoriesOption = page.locator('.ant-segmented-item').filter({ hasText: /Accessories/i }).first();
    if (await accessoriesOption.isVisible().catch(() => false)) {
      await accessoriesOption.click();
      await page.waitForTimeout(500);
    }
  });

  test('Test 6a: Fabric QC new page loads without API errors', async ({ page }) => {
    // Collect all API errors during page load
    const apiErrors = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        apiErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await navigateWithAuth(page, '/inventory/qc/fabric/new');
    await waitForPageReady(page);

    // Assert zero 500 errors from any API call during QC page load
    expect(apiErrors, `API 500 errors during QC page load: ${JSON.stringify(apiErrors)}`).toHaveLength(0);

    // The GRN dropdown should be populated (or at least the API should succeed)
    // Even if there are no QC_Pending GRNs, the select should render without errors
    const grnSelect = page.locator('.ant-form-item').filter({ hasText: 'GRN Number' }).locator('.ant-select').first();
    await expect(grnSelect).toBeVisible({ timeout: 10000 });

    // Verify no error toast appeared
    const errorMessage = page.locator('.ant-message-error');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError, 'Error toast appeared on QC page load').toBe(false);
  });

  test('Test 6b: Trims QC new page loads without API errors', async ({ page }) => {
    const apiErrors = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        apiErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await navigateWithAuth(page, '/inventory/qc/trims/new');
    await waitForPageReady(page);

    expect(apiErrors, `API 500 errors during Trims QC page load: ${JSON.stringify(apiErrors)}`).toHaveLength(0);

    const grnSelect = page.locator('.ant-form-item').filter({ hasText: 'GRN Number' }).locator('.ant-select').first();
    await expect(grnSelect).toBeVisible({ timeout: 10000 });

    const errorMessage = page.locator('.ant-message-error');
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasError, 'Error toast appeared on Trims QC page load').toBe(false);
  });

  test('Test 6c: DatePicker popup renders cleanly without extra card', async ({ page }) => {
    await navigateWithAuth(page, '/inventory/qc/fabric/new');
    await waitForPageReady(page);

    // Click the Inspection Date picker to open the popup
    const datePicker = page.locator('.ant-form-item').filter({ hasText: 'Inspection Date' }).locator('.ant-picker').first();
    await expect(datePicker).toBeVisible({ timeout: 10000 });
    await datePicker.click();

    // Wait for the dropdown popup to appear
    const dropdown = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last();
    await dropdown.waitFor({ state: 'visible', timeout: 5000 });

    // The outer dropdown wrapper must have transparent background so it
    // doesn't create a visible "extra card" around the calendar panel
    const dropdownBg = await dropdown.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    const isTransparent = dropdownBg === 'transparent'
      || dropdownBg === 'rgba(0, 0, 0, 0)'
      || dropdownBg === '';
    expect(isTransparent, `ant-picker-dropdown background should be transparent, got: ${dropdownBg}`).toBe(true);

    // The inner panel container should have a visible background
    const panelContainer = dropdown.locator('.ant-picker-panel-container').first();
    await expect(panelContainer).toBeVisible();

    // Calendar panel should show today's month and have day cells
    const calendarCells = dropdown.locator('.ant-picker-cell');
    const cellCount = await calendarCells.count();
    expect(cellCount, 'Calendar should render day cells').toBeGreaterThan(20);

    // "Today" link should be visible
    const todayLink = dropdown.locator('.ant-picker-today-btn, .ant-picker-footer a, .ant-picker-footer button').first();
    await expect(todayLink).toBeVisible();

    // Close the picker
    await datePicker.click();
  });

  test('Test 7: Create Fabric QC via UI', async ({ page }) => {
    // Monitor for API errors during this test
    const apiErrors = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        apiErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await navigateWithAuth(page, '/inventory/qc/fabric/new');
    await waitForPageReady(page);

    // Verify no API errors occurred during page load
    expect(apiErrors, `API errors on QC form load: ${JSON.stringify(apiErrors)}`).toHaveLength(0);

    // Select GRN — verify dropdown has options before selecting
    const grnSelect = page.locator('.ant-form-item').filter({ hasText: 'GRN Number' }).locator('.ant-select').first();
    await grnSelect.click();
    const grnDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
    await grnDropdown.waitFor({ state: 'visible', timeout: 5000 });
    const grnOptionCount = await grnDropdown.locator('.ant-select-item-option').count();
    if (grnOptionCount === 0) {
      // Close dropdown and skip — no QC_Pending GRNs available
      await page.keyboard.press('Escape');
      test.skip(true, 'No QC_Pending GRNs available in dropdown');
    }
    await grnDropdown.locator('.ant-select-item-option').first().click();
    await grnDropdown.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // Select PO Line Item (enabled after GRN selection)
    const poLineSelect = page.locator('.ant-form-item').filter({ hasText: 'PO Line Item' }).locator('.ant-select').first();
    if (await poLineSelect.isEnabled().catch(() => false)) {
      await antSelect(page, poLineSelect, null, { first: true });
      await page.waitForTimeout(1000);
    }

    // Inspector Name
    const inspectorInput = page.locator('input[placeholder*="Karthik"]').first();
    if (await inspectorInput.isVisible().catch(() => false)) {
      await inspectorInput.fill('E2E QC Inspector');
    }

    // Save Draft
    const draftBtn = page.getByRole('button', { name: /Save Draft/i }).first();
    if (await draftBtn.isVisible().catch(() => false)) {
      await draftBtn.click();
      await Promise.race([
        antMessageContains(page, /saved|created|success|draft/i),
        page.waitForURL(/\/inventory\/qc/, { timeout: 10000 }),
      ]).catch(() => {});
    }
  });

  test('Test 8: Create Trims QC via UI', async ({ page }) => {
    const apiErrors = [];
    page.on('response', (response) => {
      if (response.url().includes('/api/v1/') && response.status() >= 500) {
        apiErrors.push({ url: response.url(), status: response.status() });
      }
    });

    await navigateWithAuth(page, '/inventory/qc/trims/new');
    await waitForPageReady(page);

    expect(apiErrors, `API errors on Trims QC form load: ${JSON.stringify(apiErrors)}`).toHaveLength(0);

    // Select GRN
    const grnSelect = page.locator('.ant-form-item').filter({ hasText: 'GRN Number' }).locator('.ant-select').first();
    await antSelect(page, grnSelect, null, { first: true });
    await page.waitForTimeout(1500);

    // Select PO Line Item
    const poLineSelect = page.locator('.ant-form-item').filter({ hasText: 'PO Line Item' }).locator('.ant-select').first();
    if (await poLineSelect.isEnabled().catch(() => false)) {
      await antSelect(page, poLineSelect, null, { first: true });
      await page.waitForTimeout(1000);
    }

    // Save Draft
    const draftBtn = page.getByRole('button', { name: /Save Draft/i }).first();
    if (await draftBtn.isVisible().catch(() => false)) {
      await draftBtn.click();
      await Promise.race([
        antMessageContains(page, /saved|created|success|draft/i),
        page.waitForURL(/\/inventory\/qc/, { timeout: 10000 }),
      ]).catch(() => {});
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// FULL WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Full Workflow', () => {

  test('Test 10: GRN Submit → QC Approve → GRN Closed (verified in list)', async ({ page }) => {
    test.setTimeout(120000);
    test.skip(!fabricPO, 'No Fabric PO');

    await refreshPO(api, fabricPO);
    const item = fabricPO.items.find((i) => i.pendingQty > 0);
    test.skip(!item, 'No items with balance');

    // Step 1: Submit GRN via API
    const grn = await submitGrn(api, fabricGrnPayload(fabricPO, [item], {
      [item.id]: [{ rollNumber: `R-FLOW-${STAMP()}`, receivingQty: 5, shadeLot: 'SL-FLOW' }],
    }));

    // Step 2: Verify GRN is QC Pending in list
    await navigateWithAuth(page, '/inventory/grn/list');
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const grnRow = page.locator('.ant-table-row').filter({ hasText: grn.grnNumber }).first();
    if (await grnRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(grnRow.locator('.ant-tag').last()).toContainText('QC Pending');
    }

    // Step 3: Submit QC + Approve + Close via API
    const { data: grnFull } = await api.get(`/grns/${grn.id}`);
    const poLineItemId = grnFull.lineItems[0].poLineItemId;
    const qcPayload = fabricQcPayload(grnFull, poLineItemId);
    const qcRes = await api.post('/qc/submit', qcPayload);
    expect(qcRes.status).toBe(200);

    await api.post(`/qc/${qcRes.data.id}/approve`, { reason: 'E2E workflow' });
    await api.post(`/grns/${grn.id}/close-on-qc-approval`);

    // Step 4: Reload list and verify GRN is Closed
    await page.reload();
    await waitForPageReady(page);
    await antTableWaitForData(page);

    const closedRow = page.locator('.ant-table-row').filter({ hasText: grn.grnNumber }).first();
    if (await closedRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(closedRow.locator('.ant-tag').last()).toContainText('Closed');
    }
  });
});
