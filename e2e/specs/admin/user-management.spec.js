import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdUserId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('User Management — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

  test('Get all users', async () => {
    const res = await api.get('/users');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
    expect(res.data.length).toBeGreaterThan(0);
  });

  test('Create user', async () => {
    const timestamp = Date.now();
    const payload = {
      name: `E2E Test User ${timestamp}`,
      username: `e2e_user_${timestamp}`,
      password: 'Test@12345',
      email: `e2e_${timestamp}@test.com`,
      roleId: 1,
    };

    const res = await api.post('/users', payload);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('id');
    createdUserId = res.data.id;
    expect(res.data.name).toBe(payload.name);
  });

  test('Update user', async () => {
    expect(createdUserId).toBeDefined();
    const { data: existing } = await api.get(`/users/${createdUserId}`);

    const res = await api.put(`/users/${createdUserId}`, {
      ...existing,
      name: 'E2E Updated User',
    });
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Updated User');
  });

  test('Reset password', async () => {
    expect(createdUserId).toBeDefined();

    const res = await api.post(`/users/${createdUserId}/reset-password`, {
      newPassword: 'NewTest@12345',
    });
    expect(res.status).toBe(200);
  });

  test('Delete user', async () => {
    expect(createdUserId).toBeDefined();

    const res = await api.delete(`/users/${createdUserId}`);
    expect(res.status).toBe(200);
    createdUserId = null;
  });

  test.afterAll(async () => {
    // Safety cleanup
    if (createdUserId) {
      await api.delete(`/users/${createdUserId}`);
    }
  });
});

test.describe('User Management — UI Tests', () => {
  test('List page at /admin/users loads with table', async ({ page }) => {
    await goToListPage(page, '/admin/users');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();

    const rows = page.locator('.ant-table-tbody tr');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('Create user form opens and has required fields', async ({ page }) => {
    await goToListPage(page, '/admin/users');

    // Click Add/Create button
    const addBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();
    await addBtn.click();
    await page.waitForTimeout(500);

    // Verify form fields in modal or drawer
    const formContainer = page.locator('.ant-modal, .ant-drawer').first();
    await expect(formContainer).toBeVisible();

    await expect(formContainer.locator('text=Name').or(formContainer.getByLabel('Name'))).toBeVisible();
    await expect(formContainer.locator('text=Username').or(formContainer.getByLabel('Username'))).toBeVisible();
    await expect(formContainer.locator('text=Email').or(formContainer.getByLabel('Email'))).toBeVisible();
    await expect(formContainer.locator('text=Role').or(formContainer.getByLabel('Role'))).toBeVisible();
  });
});
