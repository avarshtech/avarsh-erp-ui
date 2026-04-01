import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let poId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('PO Workflow — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();

    // Create a PO for workflow testing
    const createRes = await api.post('/purchase-orders', {
      supplierId: 1,
      poDate: new Date().toISOString().split('T')[0],
      deliveryDate: '2025-10-15',
      currency: 'USD',
      remarks: 'E2E workflow test PO',
      lineItems: [
        {
          itemId: 1,
          quantity: 50,
          unitPrice: 10.00,
          uomId: 1,
        },
      ],
    });
    poId = createRes.data.id;
  });

  test('Submit → Approve PO', async () => {
    expect(poId).toBeDefined();

    // Submit PO
    const { data: po } = await api.get(`/purchase-orders/${poId}`);
    const submitRes = await api.put(`/purchase-orders/${poId}`, {
      ...po,
      status: 'SUBMITTED',
    });
    expect(submitRes.status).toBe(200);

    // Approve PO (with pdfBucketPath)
    const approveRes = await api.put(`/purchase-orders/${poId}/approve`, {
      pdfBucketPath: `po/${poId}/approved.pdf`,
    });
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.status).toBe('APPROVED');
  });

  test('Submit → Reject PO with reason', async () => {
    // Create a fresh PO for rejection test
    const createRes = await api.post('/purchase-orders', {
      supplierId: 1,
      poDate: new Date().toISOString().split('T')[0],
      deliveryDate: '2025-10-15',
      currency: 'USD',
      lineItems: [{ itemId: 1, quantity: 25, unitPrice: 8.00, uomId: 1 }],
    });
    const id = createRes.data.id;

    // Submit
    const { data: po } = await api.get(`/purchase-orders/${id}`);
    await api.put(`/purchase-orders/${id}`, { ...po, status: 'SUBMITTED' });

    // Reject with reason
    const rejectRes = await api.put(`/purchase-orders/${id}/reject`, {
      reason: 'Unit price exceeds budget allocation',
    });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.data.status).toBe('REJECTED');

    // Clean up
    await api.delete(`/purchase-orders/${id}`);
  });

  test('Refer back PO', async () => {
    // Create a fresh PO for refer-back test
    const createRes = await api.post('/purchase-orders', {
      supplierId: 1,
      poDate: new Date().toISOString().split('T')[0],
      deliveryDate: '2025-10-15',
      currency: 'USD',
      lineItems: [{ itemId: 1, quantity: 30, unitPrice: 12.00, uomId: 1 }],
    });
    const id = createRes.data.id;

    // Submit
    const { data: po } = await api.get(`/purchase-orders/${id}`);
    await api.put(`/purchase-orders/${id}`, { ...po, status: 'SUBMITTED' });

    // Refer back
    const referRes = await api.put(`/purchase-orders/${id}/refer-back`, {
      reason: 'Delivery date needs to be earlier',
    });
    expect(referRes.status).toBe(200);
    expect(referRes.data.status).toBe('DRAFT');

    // Clean up
    await api.delete(`/purchase-orders/${id}`);
  });

  test('Version history for PO', async () => {
    expect(poId).toBeDefined();

    const res = await api.get(`/purchase-orders/${poId}/versions`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
    expect(res.data.length).toBeGreaterThan(0);
  });

  test.afterAll(async () => {
    if (poId) {
      await api.delete(`/purchase-orders/${poId}`);
    }
  });
});

test.describe('PO Workflow — UI Tests', () => {
  test('Approve/Reject buttons visible on submitted PO view page', async ({ page }) => {
    await goToListPage(page, '/purchase-orders/list');
    await antTableWaitForData(page);

    // Find a SUBMITTED PO
    const submittedTag = page.locator('.ant-tag:has-text("SUBMITTED")').first();
    if (await submittedTag.isVisible()) {
      const row = submittedTag.locator('xpath=ancestor::tr');
      await row.click();
      await page.waitForTimeout(1000);

      // Check for approve/reject action buttons
      const approveBtn = page.locator('button:has-text("Approve")');
      const rejectBtn = page.locator('button:has-text("Reject")');

      // At least one action should be available for submitted POs
      const approveVisible = await approveBtn.isVisible().catch(() => false);
      const rejectVisible = await rejectBtn.isVisible().catch(() => false);
      expect(approveVisible || rejectVisible).toBeTruthy();
    }
  });
});
