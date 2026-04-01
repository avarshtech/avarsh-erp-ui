import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Costing CRUD — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test('Search cost sheets returns paginated results', async () => {
    const res = await api.get('/cost-sheets/search?page=0&size=10');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
    expect(res.data).toHaveProperty('totalElements');
    expect(res.data).toHaveProperty('totalPages');
    expect(Array.isArray(res.data.content)).toBeTruthy();
    expect(res.data.content.length).toBeLessThanOrEqual(10);
  });

  test('Create cost sheet with full payload', async () => {
    const payload = {
      status: 'DRAFT',
      date: new Date().toISOString().split('T')[0],
      buyerId: 1,
      styleId: 1,
      season: 'SS25',
      currency: 'USD',
      quoteCurrency: 'USD',
      actualRate: 1.0,
      sizes: ['S', 'M', 'L', 'XL'],
      fabricRows: [],
      localTrims: [],
      importedTrims: [],
      manufacturingRows: [],
      overheadRows: [],
      agentCommissionPct: 5.0,
      profitPct: 10.0,
    };

    const res = await api.post('/cost-sheets', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdId = res.data.id;
  });

  test('Read cost sheet by ID', async () => {
    expect(createdId).toBeDefined();
    const res = await api.get(`/cost-sheets/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(createdId);
    expect(res.data.status).toBe('DRAFT');
    expect(res.data.season).toBe('SS25');
  });

  test('Update cost sheet', async () => {
    expect(createdId).toBeDefined();
    const { data: existing } = await api.get(`/cost-sheets/${createdId}`);

    const updated = {
      ...existing,
      profitPct: 15.0,
      agentCommissionPct: 3.0,
    };

    const res = await api.post('/cost-sheets', updated);
    expect(res.status).toBe(200);
    expect(res.data.profitPct).toBe(15.0);
    expect(res.data.agentCommissionPct).toBe(3.0);
  });

  test('Delete cost sheet', async () => {
    expect(createdId).toBeDefined();
    const res = await api.delete(`/cost-sheets/${createdId}`);
    expect(res.status).toBe(200);

    const getRes = await api.get(`/cost-sheets/${createdId}`);
    expect([404, 400]).toContain(getRes.status);
  });
});

test.describe('Costing CRUD — UI Tests', () => {
  test('List page at /costing/list loads with table', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Navigate to /costing/new and verify form renders', async ({ page }) => {
    await navigateWithAuth(page, '/costing/new');

    const form = page.locator('form, .ant-form');
    await expect(form).toBeVisible();

    await expect(page.locator('text=Buyer').or(page.getByLabel('Buyer'))).toBeVisible();
    await expect(page.locator('text=Style').or(page.getByLabel('Style'))).toBeVisible();
  });

  test('Search and filter on list page', async ({ page }) => {
    await goToListPage(page, '/costing/list');
    await antTableWaitForData(page);

    const searchInput = page.locator('.ant-input-search input, input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('SS25');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);

      const table = page.locator('.ant-table');
      await expect(table).toBeVisible();
    }
  });
});
