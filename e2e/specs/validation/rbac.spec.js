import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { antSelect, antFormFill, antFormSelect, antTableWaitForData, antModalConfirm, antPopconfirmYes, antDatePickerToday } from '../../helpers/antd-helpers.js';
import { navigateWithAuth, ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

let viewerApi;

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('RBAC — API Tests (Restricted User)', () => {
  test.beforeAll(async () => {
    // Authenticate as restricted viewer user
    viewerApi = await createAuthenticatedClient('e2e-viewer', 'admin123');
  });

  test.afterAll(async () => { await viewerApi.dispose(); });

  test('POST /orders returns 403 (no add permission)', async () => {
    test.fail(true, 'B-048: server-side RBAC enforcement does not exist — any authenticated user passes');
    const res = await viewerApi.post('/orders', {
      buyerId: 1,
      styleId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      season: 'SS25',
      status: 'DRAFT',
    });
    expect(res.status).toBe(403);
  });

  test('PUT /orders/{id} returns 403 (no update permission)', async () => {
    test.fail(true, 'B-048: server-side RBAC enforcement does not exist — any authenticated user passes');
    const res = await viewerApi.put('/orders/1', {
      buyerId: 1,
      styleId: 1,
      season: 'AW25',
    });
    expect(res.status).toBe(403);
  });

  test('DELETE /orders/{id} returns 403 (no delete permission)', async () => {
    test.fail(true, 'B-048: server-side RBAC enforcement does not exist — any authenticated user passes');
    const res = await viewerApi.delete('/orders/1');
    expect(res.status).toBe(403);
  });

  test('GET /users returns 403 (no admin access)', async () => {
    test.fail(true, 'B-048: server-side RBAC enforcement does not exist — any authenticated user passes');
    const res = await viewerApi.get('/users');
    expect(res.status).toBe(403);
  });

  test('GET /roles returns 403 (no admin access)', async () => {
    test.fail(true, 'B-048: server-side RBAC enforcement does not exist — any authenticated user passes');
    const res = await viewerApi.get('/roles');
    expect(res.status).toBe(403);
  });

  test('GET /orders/search returns 200 (has view permission)', async () => {
    const res = await viewerApi.get('/orders/search?page=0&size=10');
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('content');
  });

  test('GET /buyers returns 200 (has view permission)', async () => {
    const res = await viewerApi.get('/buyers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBeTruthy();
  });
});

test.describe('RBAC — UI Tests (Restricted User)', () => {
  test('Login as viewer — admin menu items not visible in sidebar', async ({ page }) => {
    // Login as the restricted viewer user
    await navigateWithAuth(page, '/', 'e2e-viewer', 'admin123');
    await page.waitForTimeout(1000);

    // Verify sidebar is visible
    const sidebar = page.locator('.ant-layout-sider, .ant-menu').first();
    await expect(sidebar).toBeVisible();

    // Admin menu items should NOT be visible
    const adminMenu = page.locator('.ant-menu-item:has-text("Admin"), .ant-menu-submenu-title:has-text("Admin")');
    const usersMenu = page.locator('.ant-menu-item:has-text("Users")');
    const rolesMenu = page.locator('.ant-menu-item:has-text("Roles")');

    await expect(adminMenu).not.toBeVisible();
    await expect(usersMenu).not.toBeVisible();
    await expect(rolesMenu).not.toBeVisible();
  });

  test('Navigate directly to /admin/users — access denied or redirected', async ({ page }) => {
    await navigateWithAuth(page, '/admin/users', 'e2e-viewer', 'admin123');
    await page.waitForTimeout(1500);

    // Should either redirect away from admin page or show access denied
    const currentUrl = page.url();
    const isRedirected = !currentUrl.includes('/admin/users');
    const hasAccessDenied = await page.locator('text=Access Denied, text=Unauthorized, text=403, text=Permission').isVisible().catch(() => false);

    expect(isRedirected || hasAccessDenied).toBeTruthy();
  });
});
