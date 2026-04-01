import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdRoleId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Role Management — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test('Get all roles', async () => {
    const res = await api.get('/roles');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
    expect(res.data.length).toBeGreaterThan(0);

    // Each role should have essential fields
    const role = res.data[0];
    expect(role).toHaveProperty('id');
    expect(role).toHaveProperty('name');
  });

  test('Create role with permissions', async () => {
    const timestamp = Date.now();
    const payload = {
      name: `E2E Test Role ${timestamp}`,
      description: 'Role created by E2E tests',
      status: 'ACTIVE',
      permissions: {
        orders: { view: true, add: false, edit: false, delete: false },
        buyers: { view: true, add: false, edit: false, delete: false },
      },
    };

    const res = await api.post('/roles', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdRoleId = res.data.id;
    expect(res.data.name).toBe(payload.name);
  });

  test('Update role permissions', async () => {
    expect(createdRoleId).toBeDefined();
    const { data: existing } = await api.get(`/roles/${createdRoleId}`);

    const res = await api.put(`/roles/${createdRoleId}`, {
      ...existing,
      permissions: {
        ...existing.permissions,
        orders: { view: true, add: true, edit: true, delete: false },
      },
    });
    expect(res.status).toBe(200);
  });

  test('Delete role', async () => {
    expect(createdRoleId).toBeDefined();

    const res = await api.delete(`/roles/${createdRoleId}`);
    expect(res.status).toBe(200);
    createdRoleId = null;
  });

  test.afterAll(async () => {
    if (createdRoleId) {
      await api.delete(`/roles/${createdRoleId}`);
    }
  });
});

test.describe('Role Management — UI Tests', () => {
  test('List page at /admin/roles loads with table', async ({ page }) => {
    await goToListPage(page, '/admin/roles');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();
  });

  test('Permission checkboxes visible in role detail/edit', async ({ page }) => {
    await goToListPage(page, '/admin/roles');
    await antTableWaitForData(page);

    // Click on first role row or edit button
    const editBtn = page.locator('.ant-table-tbody tr').first().locator('button, a').first();
    await editBtn.click();
    await page.waitForTimeout(1000);

    // Verify permission checkboxes are rendered
    const checkboxes = page.locator('.ant-checkbox, .ant-checkbox-wrapper');
    const count = await checkboxes.count();
    expect(count).toBeGreaterThan(0);
  });
});
