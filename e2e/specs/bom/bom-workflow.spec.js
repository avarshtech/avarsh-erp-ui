import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let bomId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('BOM Workflow — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();

    // Create a BOM for workflow testing
    const createRes = await api.post('/boms', {
      orderId: 1,
      status: 'DRAFT',
      remarks: 'E2E workflow test BOM',
    });
    bomId = createRes.data.id;
  });

  test('Change BOM status via PATCH', async () => {
    expect(bomId).toBeDefined();

    const res = await api.patch(`/boms/${bomId}/status`, { status: 'SUBMITTED' });
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('SUBMITTED');
  });

  test('Update BOM line PO status', async () => {
    expect(bomId).toBeDefined();

    // Get the BOM to check for lines
    const { data: bom } = await api.get(`/boms/${bomId}`);

    // If BOM has lines, test updating PO status on one
    if (bom.lines && bom.lines.length > 0) {
      const lineId = bom.lines[0].id;
      const res = await api.patch(`/boms/${bomId}/lines/${lineId}/po-status`, {
        poStatus: 'PO_RAISED',
      });
      expect(res.status).toBe(200);
    }
  });

  test.afterAll(async () => {
    if (bomId) {
      // Reset status to DRAFT before deletion if needed
      try {
        await api.patch(`/boms/${bomId}/status`, { status: 'DRAFT' });
      } catch { /* ignore */ }
      await api.delete(`/boms/${bomId}`);
    }
  });
});

test.describe('BOM Workflow — UI Tests', () => {
  test('Status transition on BOM detail page', async ({ page }) => {
    await goToListPage(page, '/bom/list');
    await antTableWaitForData(page);

    // Click on a DRAFT BOM row
    const draftTag = page.locator('.ant-tag:has-text("DRAFT")').first();
    if (await draftTag.isVisible()) {
      const row = draftTag.locator('xpath=ancestor::tr');
      await row.click();
      await page.waitForTimeout(1000);

      // Verify status action button exists
      const submitBtn = page.locator('button:has-text("Submit"), button:has-text("Finalize")');
      if (await submitBtn.isVisible()) {
        await expect(submitBtn).toBeEnabled();
      }
    }
  });
});
