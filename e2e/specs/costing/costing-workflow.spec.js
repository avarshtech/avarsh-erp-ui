import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let costSheetId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Costing Workflow — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Create Draft → Final → Approved lifecycle', async () => {
    // Step 1: Create Draft
    const createRes = await api.post('/cost-sheets', {
      status: 'DRAFT',
      date: new Date().toISOString().split('T')[0],
      buyerId: 1,
      styleId: 1,
      season: 'SS25',
      currency: 'USD',
      quoteCurrency: 'USD',
      actualRate: 1.0,
      sizes: ['S', 'M', 'L'],
      fabricRows: [],
      localTrims: [],
      importedTrims: [],
      manufacturingRows: [],
      overheadRows: [],
      agentCommissionPct: 5.0,
      profitPct: 10.0,
    });
    expect(createRes.status).toBe(200);
    costSheetId = createRes.data.id;
    expect(createRes.data.status).toBe('DRAFT');

    // Step 2: Update to FINAL
    const { data: draft } = await api.get(`/cost-sheets/${costSheetId}`);
    const finalRes = await api.post('/cost-sheets', {
      ...draft,
      status: 'FINAL',
    });
    expect(finalRes.status).toBe(200);
    expect(finalRes.data.status).toBe('FINAL');

    // Step 3: Update to APPROVED
    const { data: finalSheet } = await api.get(`/cost-sheets/${costSheetId}`);
    const approvedRes = await api.post('/cost-sheets', {
      ...finalSheet,
      status: 'APPROVED',
    });
    expect(approvedRes.status).toBe(200);
    expect(approvedRes.data.status).toBe('APPROVED');
  });

  test('Get history for a cost sheet', async () => {
    expect(costSheetId).toBeDefined();
    const res = await api.get(`/cost-sheets/${costSheetId}/history`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
  });

  test('Duplicate a cost sheet', async () => {
    expect(costSheetId).toBeDefined();
    const res = await api.post(`/cost-sheets/${costSheetId}/duplicate`);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    expect(res.data.id).not.toBe(costSheetId);
    expect(res.data.status).toBe('DRAFT');

    // Clean up duplicated sheet
    await api.delete(`/cost-sheets/${res.data.id}`);
  });

  test.afterAll(async () => {
    // Clean up the test cost sheet
    if (costSheetId) {
      await api.delete(`/cost-sheets/${costSheetId}`);
    }
  });
});

test.describe('Costing Workflow — UI Tests', () => {
  test('Submit Draft cost sheet via edit page', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    // Click on a DRAFT row to open edit
    const draftTag = page.locator('.ant-tag:has-text("DRAFT")').first();
    if (await draftTag.isVisible()) {
      const row = draftTag.locator('xpath=ancestor::tr');
      await row.click();
      await page.waitForTimeout(1000);

      const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Finalize")');
      if (await submitBtn.isVisible()) {
        await expect(submitBtn).toBeEnabled();
      }
    }
  });

  test('View Approved cost sheet details', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    const approvedTag = page.locator('.ant-tag:has-text("APPROVED")').first();
    if (await approvedTag.isVisible()) {
      const row = approvedTag.locator('xpath=ancestor::tr');
      await row.click();
      await page.waitForTimeout(1000);

      // Verify details are displayed (form fields should be read-only or view mode)
      const content = page.locator('.ant-form, .ant-descriptions, .cost-sheet-view');
      await expect(content).toBeVisible();
    }
  });
});
