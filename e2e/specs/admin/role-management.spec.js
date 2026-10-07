import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antTableWaitForData } from '../../helpers/antd-helpers.js';
import { ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let api;
let createdRoleId;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Role Management — API Tests', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => { await api.dispose(); });

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
    expect([200, 204]).toContain(res.status); // controller returns 204 No Content
    createdRoleId = null;
  });

  test.afterAll(async () => {
    if (createdRoleId) {
      await api.delete(`/roles/${createdRoleId}`);
    }
  });
});

test.describe('Role Management — UI Tests', () => {
  // Role names take letters and spaces only, so the run's timestamp is spelled in letters
  const UI_ROLE = `Role View ${String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])}`;
  let uiApi;
  let uiRoleId;

  test.beforeAll(async () => {
    uiApi = await createAuthenticatedClient();
    const res = await uiApi.post('/roles', {
      name: UI_ROLE,
      description: 'View and edit e2e',
      status: 'ACTIVE',
      permissions: { dashboard: { access: true, operations: { view: true } } },
    });
    expect(res.status, JSON.stringify(res.data)).toBe(200);
    uiRoleId = res.data.id;
  });

  test.afterAll(async () => {
    if (uiRoleId) await uiApi.delete(`/roles/${uiRoleId}`);
    await uiApi?.dispose();
  });

  test('List page at /admin/roles loads with table', async ({ page }) => {
    await goToListPage(page, '/admin/roles');
    await antTableWaitForData(page);

    const table = page.locator('.ant-table');
    await expect(table).toBeVisible();
  });

  test('a role opens read-only in the view dialog; Edit opens the editor, and Cancel discards', async ({ page }) => {
    await goToListPage(page, '/admin/roles');
    await page.getByPlaceholder('Search by role name or description...').fill(UI_ROLE);
    const row = page.locator('.ant-table-row').filter({ hasText: UI_ROLE });
    await expect(row).toHaveCount(1, { timeout: 20000 });
    await row.getByRole('button', { name: UI_ROLE }).click();

    // View: ticks, never boxes
    const dialog = page.locator('.ant-modal').filter({ hasText: UI_ROLE });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('img', { name: 'View on Dashboard', exact: true })).toBeVisible();
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);

    // Edit: the editor page, with boxes
    await dialog.getByRole('button', { name: /Edit$/ }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/roles/edit/${uiRoleId}$`));
    await expect(page.getByRole('checkbox', { name: 'View on Dashboard', exact: true })).toBeChecked();

    await page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name: /^Orders,/ }).click();
    await page.getByRole('checkbox', { name: 'View on Orders', exact: true }).check();
    await expect(page.getByText('1 unsaved change', { exact: true })).toBeVisible();

    // Cancel asks first, then returns to the dialog with nothing saved
    await page.getByRole('button', { name: /Cancel$/ }).click();
    await page.locator('.ant-modal-confirm').filter({ hasText: 'Unsaved Changes' }).getByRole('button', { name: 'Leave' }).click();
    const reopened = page.locator('.ant-modal').filter({ hasText: UI_ROLE });
    await expect(reopened).toBeVisible({ timeout: 20000 });
    await expect(reopened.getByRole('img', { name: 'View on Orders', exact: true })).toHaveCount(0);
  });
});
