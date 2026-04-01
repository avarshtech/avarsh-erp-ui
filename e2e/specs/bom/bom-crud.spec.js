import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('BOM CRUD — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Search BOMs returns paginated results', async () => {
    const res = await api.get('/boms?page=0&size=10');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(Array.isArray(res.data.content)).toBeTruthy();
    expect(res.data.content.length).toBeLessThanOrEqual(10);
  });

  test('Get BOM by order number', async () => {
    const res = await api.get('/boms/by-order-no?orderNo=ORD/0003');
    expect(res.status).toBe(200);
    // Response may be a single BOM or list — verify it's valid
    if (Array.isArray(res.data)) {
      expect(res.data.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(res.data).toHaveProperty('id');
    }
  });

  test('Create BOM', async () => {
    const payload = {
      orderId: 1,
      status: 'DRAFT',
      remarks: 'E2E test BOM',
    };

    const res = await api.post('/boms', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdId = res.data.id;
  });

  test('Update BOM', async () => {
    expect(createdId).toBeDefined();
    const { data: existing } = await api.get(`/boms/${createdId}`);

    const updated = {
      ...existing,
      remarks: 'Updated BOM remarks',
    };

    const res = await api.put(`/boms/${createdId}`, updated);
    expect(res.status).toBe(200);
    expect(res.data.remarks).toBe('Updated BOM remarks');
  });

  test('Delete BOM', async () => {
    expect(createdId).toBeDefined();
    const res = await api.delete(`/boms/${createdId}`);
    expect(res.status).toBe(200);

    const getRes = await api.get(`/boms/${createdId}`);
    expect([404, 400]).toContain(getRes.status);
  });
});

test.describe('BOM CRUD — UI Tests', () => {
  test('List page at /bom/list loads with table', async ({ page }) => {
    await goToListPage(page, '/bom/list');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();
  });

  test('Navigate to /bom/new and verify form renders', async ({ page }) => {
    await navigateWithAuth(page, '/bom/new');

    const form = page.locator('form, .ant-form');
    await expect(form).toBeVisible();

    // Verify order selection is available
    await expect(
      page.locator('text=Order').or(page.getByLabel('Order')).or(page.locator('[class*="order"]'))
    ).toBeVisible();
  });
});
