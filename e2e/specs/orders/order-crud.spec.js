import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Order CRUD — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Search orders returns paginated results', async () => {
    const res = await api.get('/orders/search?page=0&size=10');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(Array.isArray(res.data.content)).toBeTruthy();
    expect(res.data.content.length).toBeLessThanOrEqual(10);
  });

  test('Create order', async () => {
    const payload = {
      buyerId: 1,
      styleId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      season: 'SS25',
      deliveryDate: '2025-09-30',
      currency: 'USD',
      pricingTerm: 'FOB',
      status: 'DRAFT',
    };

    const res = await api.post('/orders', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdId = res.data.id;
  });

  test('Read order by ID', async () => {
    expect(createdId).toBeDefined();
    const res = await api.get(`/orders/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdId);
    expect(res.data.status).toBe('DRAFT');
  });

  test('Update order', async () => {
    expect(createdId).toBeDefined();
    const { data: existing } = await api.get(`/orders/${createdId}`);

    const updated = {
      ...existing,
      season: 'AW25',
    };

    const res = await api.put(`/orders/${createdId}`, updated);
    expect(res.status).toBe(200);
    expect(res.data.season).toBe('AW25');
  });

  test('Delete order', async () => {
    expect(createdId).toBeDefined();
    const res = await api.delete(`/orders/${createdId}`);
    expect(res.status).toBe(200);

    const getRes = await api.get(`/orders/${createdId}`);
    expect([404, 400]).toContain(getRes.status);
  });
});

test.describe('Order CRUD — UI Tests', () => {
  test('List page at /orders/list loads with table', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Navigate to /orders/new and verify form renders', async ({ page }) => {
    await navigateWithAuth(page, '/orders/new');

    const form = page.locator('form, .ant-form');
    await expect(form).toBeVisible();

    await expect(page.locator('text=Buyer').or(page.getByLabel('Buyer'))).toBeVisible();
  });

  test('Search and filter orders on list page', async ({ page }) => {
    await goToListPage(page, '/orders/list');
    await antTableWaitForData(page);

    const searchInput = page.locator('.ant-input-search input, input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('ORD');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);

      const table = page.locator('.ant-table');
      await expect(table).toBeVisible();
    }
  });
});
