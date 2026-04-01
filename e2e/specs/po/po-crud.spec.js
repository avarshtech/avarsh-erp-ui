import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('PO CRUD — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Search POs returns paginated results', async () => {
    const res = await api.get('/purchase-orders/search?page=0&size=10');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(Array.isArray(res.data.content)).toBeTruthy();
    expect(res.data.content.length).toBeLessThanOrEqual(10);
  });

  test('Create PO with line items', async () => {
    const payload = {
      supplierId: 1,
      poDate: new Date().toISOString().split('T')[0],
      deliveryDate: '2025-10-15',
      currency: 'USD',
      remarks: 'E2E test PO',
      lineItems: [
        {
          itemId: 1,
          quantity: 100,
          unitPrice: 5.50,
          uomId: 1,
        },
      ],
    };

    const res = await api.post('/purchase-orders', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdId = res.data.id;
  });

  test('Read PO by ID', async () => {
    expect(createdId).toBeDefined();
    const res = await api.get(`/purchase-orders/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdId);
    expect(res.data).toHaveProperty('supplierId');
  });

  test('Activity log — get and post comment', async () => {
    expect(createdId).toBeDefined();

    // Get activities
    const getRes = await api.get(`/purchase-orders/${createdId}/activities`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.data)).toBeTruthy();

    // Post a comment
    const postRes = await api.post(`/purchase-orders/${createdId}/activities`, {
      comment: 'E2E test comment on PO',
    });
    expect(postRes.status).toBe(200);

    // Verify comment appears in activities
    const updatedRes = await api.get(`/purchase-orders/${createdId}/activities`);
    expect(updatedRes.data.length).toBeGreaterThan(getRes.data.length);
  });

  test.afterAll(async () => {
    if (createdId) {
      await api.delete(`/purchase-orders/${createdId}`);
    }
  });
});

test.describe('PO CRUD — UI Tests', () => {
  test('List page at /purchase-orders/list loads with table', async ({ page }) => {
    await goToListPage(page, '/purchase-orders/list');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Navigate to /purchase-orders/new and verify form renders', async ({ page }) => {
    await navigateWithAuth(page, '/purchase-orders/new');

    const form = page.locator('form, .ant-form');
    await expect(form).toBeVisible();

    await expect(
      page.locator('text=Supplier').or(page.getByLabel('Supplier'))
    ).toBeVisible();
  });
});
