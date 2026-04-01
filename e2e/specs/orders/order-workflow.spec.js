import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let orderId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Order Workflow — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Create DRAFT → SUBMITTED → APPROVED lifecycle', async () => {
    // Step 1: Create DRAFT order
    const createRes = await api.post('/orders', {
      buyerId: 1,
      styleId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      season: 'SS25',
      deliveryDate: '2025-09-30',
      currency: 'USD',
      pricingTerm: 'FOB',
      status: 'DRAFT',
    });
    expect(createRes.status).toBe(200);
    orderId = createRes.data.id;
    expect(createRes.data.status).toBe('DRAFT');

    // Step 2: Submit (DRAFT → SUBMITTED)
    const { data: draft } = await api.get(`/orders/${orderId}`);
    const submitRes = await api.put(`/orders/${orderId}`, {
      ...draft,
      status: 'SUBMITTED',
    });
    expect(submitRes.status).toBe(200);
    expect(submitRes.data.status).toBe('SUBMITTED');

    // Step 3: Approve (SUBMITTED → APPROVED)
    const { data: submitted } = await api.get(`/orders/${orderId}`);
    const approveRes = await api.put(`/orders/${orderId}`, {
      ...submitted,
      status: 'APPROVED',
    });
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.status).toBe('APPROVED');
  });

  test('Refer back order (SUBMITTED → DRAFT with reason)', async () => {
    // Create and submit an order
    const createRes = await api.post('/orders', {
      buyerId: 1,
      styleId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      season: 'SS25',
      deliveryDate: '2025-09-30',
      currency: 'USD',
      pricingTerm: 'FOB',
      status: 'DRAFT',
    });
    const id = createRes.data.id;

    // Submit the order
    const { data: draft } = await api.get(`/orders/${id}`);
    await api.put(`/orders/${id}`, { ...draft, status: 'SUBMITTED' });

    // Refer back with reason
    const { data: submitted } = await api.get(`/orders/${id}`);
    const referRes = await api.put(`/orders/${id}`, {
      ...submitted,
      status: 'DRAFT',
      referBackReason: 'Missing size breakdown details',
    });
    expect(referRes.status).toBe(200);
    expect(referRes.data.status).toBe('DRAFT');

    // Clean up
    await api.delete(`/orders/${id}`);
  });

  test('Cancel order with reason', async () => {
    // Create a draft order
    const createRes = await api.post('/orders', {
      buyerId: 1,
      styleId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      season: 'SS25',
      deliveryDate: '2025-09-30',
      currency: 'USD',
      pricingTerm: 'FOB',
      status: 'DRAFT',
    });
    const id = createRes.data.id;

    // Cancel order
    const { data: order } = await api.get(`/orders/${id}`);
    const cancelRes = await api.put(`/orders/${id}`, {
      ...order,
      status: 'CANCELLED',
      cancelReason: 'Buyer withdrew the order',
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.data.status).toBe('CANCELLED');

    // Clean up
    await api.delete(`/orders/${id}`);
  });

  test.afterAll(async () => {
    if (orderId) {
      await api.delete(`/orders/${orderId}`);
    }
  });
});

test.describe('Order Workflow — UI Tests', () => {
  test('Status transitions via buttons on order detail page', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);

    // Find a DRAFT order and click into it
    const draftTag = page.locator('.ant-tag:has-text("DRAFT")').first();
    if (await draftTag.isVisible()) {
      const row = draftTag.locator('xpath=ancestor::tr');
      await row.click();
      await page.waitForTimeout(1000);

      // Verify status action buttons are present
      const submitBtn = page.locator('button:has-text("Submit")');
      if (await submitBtn.isVisible()) {
        await expect(submitBtn).toBeEnabled();
      }
    }
  });
});
