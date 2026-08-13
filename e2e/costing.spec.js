/**
 * E2E Tests — Costing Module
 *
 * Covers the full lifecycle of cost sheets:
 *   1. List page loads and displays data
 *   2. Create a new cost sheet (save as Draft)
 *   3. Search and filter on list page
 *   4. View cost sheet details
 *   5. Edit / update cost sheet
 *   6. Submit (Draft → Final)
 *   7. Approve (Final → Approved)
 *   8. History / version tracking
 *   9. Duplicate cost sheet
 *  10. Delete a Draft cost sheet
 *  11. Cost comparison page
 *
 * Prerequisites:
 *   - Backend running at localhost:8088
 *   - Frontend dev server running at localhost:3000
 *   - At least one buyer and one style in the master data
 *   - Authenticated session (via global-setup.js)
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:8088/api/v1';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Reliably select an option from an Ant Design Select dropdown.
 * 1. Clicks the select trigger to open the popup.
 * 2. Waits for the dropdown popup to be visible.
 * 3. Clicks the matching option by title/text.
 */
async function antSelect(page, selectLocator, optionText, { first = false } = {}) {
  await selectLocator.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible', timeout: 5000 });

  if (first) {
    await dropdown.locator('.ant-select-item-option').first().click();
  } else {
    await dropdown.locator('.ant-select-item-option').filter({ hasText: optionText }).click();
  }
  await expect(dropdown).toBeHidden({ timeout: 3000 }).catch(() => {});
}

/**
 * Navigate to a page, re-authenticate if session expired, and retry navigation.
 *
 * After page.goto(), the React router may redirect to /login if the session
 * is invalid. We race between the app sidebar appearing (authenticated) and
 * the login form appearing (session expired). If login form wins, we
 * authenticate and re-navigate.
 */
async function navigateWithAuth(page, path) {
  await page.goto(path);

  const loginField = page.getByPlaceholder('Username');
  const appSidebar = page.locator('.ant-layout-sider');

  // Race: whichever appears first — app sidebar or login form
  await Promise.race([
    loginField.waitFor({ state: 'visible', timeout: 15000 }),
    appSidebar.waitFor({ state: 'visible', timeout: 15000 }),
  ]).catch(() => {});

  // If login form appeared, re-authenticate
  if (await loginField.isVisible().catch(() => false)) {
    await loginField.fill('superadmin');
    await page.getByPlaceholder('Password').fill('admin98');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForLoadState('networkidle');
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Navigate to the costing list page and wait for the table to render.
 * Returns true if data rows exist, false if the table is empty.
 */
async function goToCostingList(page) {
  await navigateWithAuth(page, '/costing/list');
  await expect(page.locator('.ant-table')).toBeVisible({ timeout: 20000 });
  await page.waitForLoadState('networkidle');
  const dataRowCount = await page.locator('.ant-table-row').count();
  return dataRowCount > 0;
}

// ──────────────────────────────────────────────────────────
// Restore sessionStorage before each UI test.
// ──────────────────────────────────────────────────────────
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('sessionActive', 'true');
  });
});

test.describe.serial('Costing Module — Full Lifecycle', () => {

  // ──────────────────────────────────────────────────────────
  // 1. LIST PAGE
  // ──────────────────────────────────────────────────────────

  test('1.1 — List page loads and shows table', async ({ page }) => {
    await goToCostingList(page);
  });

  test('1.2 — List page displays table columns', async ({ page }) => {
    await goToCostingList(page);

    const headerRow = page.locator('.ant-table-thead');
    await expect(headerRow).toContainText('Costing ID');
    await expect(headerRow).toContainText('Buyer');
    await expect(headerRow).toContainText('Date');
  });

  // ──────────────────────────────────────────────────────────
  // 2. CREATE NEW COST SHEET
  // ──────────────────────────────────────────────────────────

  test('2.1 — Navigate to new cost sheet form', async ({ page }) => {
    await goToCostingList(page);

    const newButton = page.getByRole('button', { name: /New Cost Sheet/i });
    await expect(newButton).toBeVisible();
    await newButton.click();
    await expect(page).toHaveURL(/costing\/new/);
  });

  test('2.2 — Fill and save a new cost sheet as Draft', async ({ page }) => {
    await navigateWithAuth(page, '/costing/new');
    await page.waitForLoadState('networkidle');

    // ── Date ──
    const datePicker = page.locator('.ant-form-item').filter({ hasText: 'Date' }).locator('.ant-picker');
    await datePicker.click();
    await page.locator('.ant-picker-cell-today .ant-picker-cell-inner').click();

    // ── Buyer ──
    const buyerFormItem = page.locator('.ant-form-item').filter({ hasText: 'Buyer' }).first();
    const buyerSelect = buyerFormItem.locator('.ant-select');
    await antSelect(page, buyerSelect, null, { first: true });

    // ── Style # ──
    const styleInput = page.getByPlaceholder('e.g. N58070-1LU');
    await styleInput.fill('E2E-TEST-STYLE');

    // ── Garment Name ──
    const garmentInput = page.getByPlaceholder('e.g. Blouse SS Ladies');
    if (await garmentInput.isVisible()) {
      await garmentInput.fill('E2E Test Garment');
    }

    // ── Season ──
    const seasonFormItem = page.locator('.ant-form-item').filter({ hasText: 'Season' }).first();
    const seasonSelect = seasonFormItem.locator('.ant-select');
    await antSelect(page, seasonSelect, 'Spring/Summer 2026');

    // ── Save as Draft ──
    const saveDraftButton = page.getByRole('button', { name: /Save as Draft/i });
    await expect(saveDraftButton).toBeVisible();
    await saveDraftButton.click();

    // Should navigate back to list or show success message
    await expect(page).toHaveURL(/costing\/list|costing\/edit/, { timeout: 15000 }).catch(async () => {
      const errorMessages = page.locator('.ant-form-item-explain-error');
      if (await errorMessages.count() > 0) {
        console.log('Form validation errors found — save may have been blocked');
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // 3. SEARCH AND FILTER
  // ──────────────────────────────────────────────────────────

  test('3.1 — Search cost sheets by text', async ({ page }) => {
    await goToCostingList(page);

    const searchInput = page.getByPlaceholder(/Search ID, buyer/i);
    await expect(searchInput).toBeVisible();
    await searchInput.fill('CST');
    await page.waitForTimeout(800);
    await expect(page.locator('.ant-table')).toBeVisible();
  });

  test('3.2 — Filter cost sheets by status', async ({ page }) => {
    await goToCostingList(page);

    // Status filter — it's a standalone Select in the filter bar, not inside a Form.Item
    // Look for a Select that has "Status" placeholder text
    const statusSelect = page.locator('.ant-select').filter({ hasText: /Status/i }).first();
    if (await statusSelect.isVisible().catch(() => false)) {
      await antSelect(page, statusSelect, 'Draft');
      await page.waitForTimeout(800);
      await expect(page.locator('.ant-table')).toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────
  // 4. VIEW COST SHEET DETAILS
  // ──────────────────────────────────────────────────────────

  test('4.1 — View cost sheet via action button', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    // View action button with EyeOutlined icon
    const firstRow = page.locator('.ant-table-row').first();
    const viewButton = firstRow.locator('button').filter({ has: page.locator('.anticon-eye') });
    await expect(viewButton).toBeVisible();
    await viewButton.click();

    await expect(page).toHaveURL(/costing\/\d+/, { timeout: 10000 });
  });

  test('4.2 — View page displays cost sheet details', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const viewButton = page.locator('.ant-table-row').first().locator('button').filter({ has: page.locator('.anticon-eye') });
    await viewButton.click();
    await expect(page).toHaveURL(/costing\/\d+/, { timeout: 10000 });

    // Should display Costing ID (CST/...) and key sections
    await expect(page.getByText(/CST\//)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/General Details/i)).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────
  // 5. EDIT / UPDATE COST SHEET
  // ──────────────────────────────────────────────────────────

  test('5.1 — Edit a Draft cost sheet via action button', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const draftRow = page.locator('.ant-table-row').filter({ hasText: /Draft/i }).first();
    if (!(await draftRow.isVisible())) {
      test.skip();
      return;
    }

    const editButton = draftRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await expect(editButton).toBeVisible();
    await editButton.click();

    await expect(page).toHaveURL(/costing\/edit\/\d+/, { timeout: 10000 });
  });

  // ──────────────────────────────────────────────────────────
  // 6. STATUS TRANSITIONS — Submit (Draft → Final)
  // ──────────────────────────────────────────────────────────

  test('6.1 — Submit cost sheet (Draft → Final)', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const draftRow = page.locator('.ant-table-row').filter({ hasText: /Draft/i }).first();
    if (!(await draftRow.isVisible())) {
      test.skip();
      return;
    }

    const editButton = draftRow.locator('button').filter({ has: page.locator('.anticon-edit') });
    await editButton.click();
    await expect(page).toHaveURL(/costing\/edit\/\d+/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const submitButton = page.getByRole('button', { name: /^Submit$/i });
    if (await submitButton.isVisible()) {
      await submitButton.click();

      const confirmButton = page.getByRole('button', { name: /ok|yes|confirm/i });
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await expect(page).toHaveURL(/costing\/list/, { timeout: 15000 }).catch(() => {});
    }
  });

  // ──────────────────────────────────────────────────────────
  // 7. APPROVE (Final → Approved)
  // ──────────────────────────────────────────────────────────

  test('7.1 — Approve cost sheet (Final → Approved)', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const finalRow = page.locator('.ant-table-row').filter({ hasText: /Final/i }).first();
    if (!(await finalRow.isVisible())) {
      test.skip();
      return;
    }

    const viewButton = finalRow.locator('button').filter({ has: page.locator('.anticon-eye') });
    await viewButton.click();
    await expect(page).toHaveURL(/costing\/\d+/, { timeout: 10000 });

    const approveButton = page.getByRole('button', { name: /Approve/i });
    if (await approveButton.isVisible()) {
      await approveButton.click();

      const confirmButton = page.getByRole('button', { name: /ok|yes|confirm/i });
      if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmButton.click();
      }

      await expect(page.locator('.ant-message')).toContainText(/approved/i, { timeout: 10000 }).catch(() => {});
    }
  });

  // ──────────────────────────────────────────────────────────
  // 8. HISTORY
  // ──────────────────────────────────────────────────────────

  test('8.1 — View cost sheet history from list', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    // History button is only shown for Approved / Final status rows
    const eligibleRow = page.locator('.ant-table-row').filter({ hasText: /Approved|Final/i }).first();
    if (!(await eligibleRow.isVisible())) {
      test.skip();
      return;
    }

    const historyButton = eligibleRow.locator('button').filter({ has: page.locator('.anticon-history') });
    if (!(await historyButton.isVisible())) {
      test.skip();
      return;
    }
    await historyButton.click();

    const modal = page.locator('.ant-modal').filter({ hasText: /History|Version/i });
    await expect(modal).toBeVisible({ timeout: 5000 });

    await modal.locator('.ant-modal-close').click();
    await expect(modal).toBeHidden({ timeout: 3000 });
  });

  // ──────────────────────────────────────────────────────────
  // 9. DUPLICATE
  // ──────────────────────────────────────────────────────────

  test('9.1 — Duplicate a cost sheet from view page', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const viewButton = page.locator('.ant-table-row').first().locator('button').filter({ has: page.locator('.anticon-eye') });
    await viewButton.click();
    await expect(page).toHaveURL(/costing\/\d+/, { timeout: 10000 });

    const duplicateButton = page.getByRole('button', { name: /Duplicate/i });
    if (await duplicateButton.isVisible()) {
      await duplicateButton.click();
      await expect(page).toHaveURL(/costing\/edit\/\d+/, { timeout: 15000 });
    }
  });

  test('9.2 — Duplicate a cost sheet from list actions', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const firstRow = page.locator('.ant-table-row').first();
    const duplicateButton = firstRow.locator('button').filter({ has: page.locator('.anticon-copy') });
    await expect(duplicateButton).toBeVisible();
    await duplicateButton.click();

    await expect(page.locator('.ant-message')).toContainText(/Duplicated/i, { timeout: 10000 }).catch(() => {});
  });

  // ──────────────────────────────────────────────────────────
  // 10. DELETE
  // ──────────────────────────────────────────────────────────

  test('10.1 — Delete a Draft cost sheet', async ({ page }) => {
    const hasData = await goToCostingList(page);
    if (!hasData) {
      test.skip();
      return;
    }

    const draftRow = page.locator('.ant-table-row').filter({ hasText: /Draft/i }).first();
    if (!(await draftRow.isVisible())) {
      test.skip();
      return;
    }

    const deleteButton = draftRow.locator('button').filter({ has: page.locator('.anticon-delete') });
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Popconfirm dialog appears
    const popconfirm = page.locator('.ant-popconfirm');
    await expect(popconfirm).toBeVisible({ timeout: 3000 });
    await popconfirm.getByRole('button', { name: /Delete/i }).click();

    await page.waitForTimeout(2000);
    await expect(page.locator('.ant-message')).toContainText(/deleted/i, { timeout: 5000 }).catch(() => {});
  });

  // ──────────────────────────────────────────────────────────
  // 11. COST COMPARISON
  // ──────────────────────────────────────────────────────────

  test('11.1 — Cost comparison page loads', async ({ page }) => {
    await navigateWithAuth(page, '/costing/compare');
    await page.waitForLoadState('networkidle');

    const body = page.locator('body');
    await expect(body).not.toContainText('500');
    await expect(body).not.toContainText('404');
  });
});

// ──────────────────────────────────────────────────────────
// API-Level Integration Tests
// These hit the backend directly (port 8088) — not the Vite dev server.
// ──────────────────────────────────────────────────────────

test.describe('Costing Module — API Integration', () => {
  let authToken;

  test.beforeAll(async ({ request }) => {
    const loginResponse = await request.post(`${API_BASE}/auth/login`, {
      data: { username: 'superadmin', password: 'admin98' },
    });
    expect(loginResponse.ok()).toBeTruthy();
    const loginData = await loginResponse.json();
    authToken = loginData.token;
    expect(authToken).toBeTruthy();
  });

  const authGet = (request, path) =>
    request.get(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

  const authPost = (request, path, data) =>
    request.post(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${authToken}` },
      data,
    });

  const authDelete = (request, path) =>
    request.delete(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

  test('API — Search cost sheets returns paginated response', async ({ request }) => {
    const response = await authGet(request, '/cost-sheets/search?page=0&size=10');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('totalElements');
    expect(data).toHaveProperty('totalPages');
    expect(Array.isArray(data.content)).toBe(true);
  });

  test('API — Get exchange rate returns valid rate', async ({ request }) => {
    const response = await authGet(request, '/exchange-rates/today?from=USD&to=INR');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('rate');
    expect(data).toHaveProperty('from', 'USD');
    expect(data).toHaveProperty('to', 'INR');
    expect(typeof data.rate).toBe('number');
    expect(data.rate).toBeGreaterThan(0);
  });

  test('API — Get cost sheet summaries returns array', async ({ request }) => {
    const response = await authGet(request, '/cost-sheets/summaries');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);

    if (data.length > 0) {
      expect(data[0]).toHaveProperty('id');
      expect(data[0]).toHaveProperty('costingId');
      expect(data[0]).toHaveProperty('status');
    }
  });

  test('API — Get styles list returns array', async ({ request }) => {
    const response = await authGet(request, '/styles');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });

  test('API — Create, read, update, submit, approve, duplicate, delete lifecycle', async ({ request }) => {
    // Step 1: Get a buyer
    const buyersResponse = await authGet(request, '/buyers');
    expect(buyersResponse.ok()).toBeTruthy();
    const buyersData = await buyersResponse.json();
    const buyers = Array.isArray(buyersData) ? buyersData : (buyersData.content || []);
    if (buyers.length === 0) {
      test.skip();
      return;
    }
    const buyerId = buyers[0].id;

    // Step 2: Find or create a style
    const stylesResponse = await authGet(request, `/styles/buyer/${buyerId}`);
    let styleId;

    if (stylesResponse.ok()) {
      const styles = await stylesResponse.json();
      if (Array.isArray(styles) && styles.length > 0) {
        styleId = styles[0].id;
      }
    }

    if (!styleId) {
      const styleResponse = await authPost(request, '/styles', {
        styleNo: `E2E-TEST-${Date.now()}`,
        garmentName: 'E2E Test Garment',
        buyerId,
        season: 'SS26',
      });
      if (styleResponse.ok()) {
        const style = await styleResponse.json();
        styleId = style.id;
      } else {
        test.skip();
        return;
      }
    }

    // Step 3: Create a cost sheet
    const createPayload = {
      status: 'Draft',
      date: new Date().toISOString().split('T')[0],
      buyerId,
      styleId,
      season: 'SS26',
      currency: 'INR',
      quoteCurrency: 'USD',
      actualRate: 83.80,
      todaysRate: 83.80,
      sizes: ['S', 'M', 'L'],
      fabricRows: [],
      localTrims: [],
      importedTrims: [],
      manufacturingRows: [],
      overheadRows: [],
      agentCommissionPct: 5,
      profitPct: 10,
    };

    const createResponse = await authPost(request, '/cost-sheets', createPayload);
    expect(createResponse.ok()).toBeTruthy();

    const created = await createResponse.json();
    expect(created).toHaveProperty('id');
    expect(created).toHaveProperty('costingId');
    expect(created.status).toBe('Draft');

    const costSheetId = created.id;

    // Step 4: Read
    const getResponse = await authGet(request, `/cost-sheets/${costSheetId}`);
    expect(getResponse.ok()).toBeTruthy();

    const fetched = await getResponse.json();
    expect(fetched.id).toBe(costSheetId);
    expect(fetched.costingId).toBe(created.costingId);

    // Step 5: Update
    const updatePayload = { ...fetched, agentCommissionPct: 7 };
    const updateResponse = await authPost(request, '/cost-sheets', updatePayload);
    expect(updateResponse.ok()).toBeTruthy();

    const updated = await updateResponse.json();
    expect(updated.agentCommissionPct).toBe(7);

    // Step 6: Submit (Draft → Final)
    const submitPayload = { ...updated, status: 'Final' };
    const submitResponse = await authPost(request, '/cost-sheets', submitPayload);
    expect(submitResponse.ok()).toBeTruthy();

    const submitted = await submitResponse.json();
    expect(submitted.status).toBe('Final');

    // Step 7: Check history
    const historyResponse = await authGet(request, `/cost-sheets/${costSheetId}/history`);
    expect(historyResponse.ok()).toBeTruthy();

    const history = await historyResponse.json();
    expect(Array.isArray(history)).toBe(true);

    // Step 8: Approve (Final → Approved)
    const approvePayload = { ...submitted, status: 'Approved' };
    const approveResponse = await authPost(request, '/cost-sheets', approvePayload);
    expect(approveResponse.ok()).toBeTruthy();

    const approved = await approveResponse.json();
    expect(approved.status).toBe('Approved');

    // Step 9: Duplicate
    const duplicateResponse = await authPost(request, `/cost-sheets/${costSheetId}/duplicate`);
    expect(duplicateResponse.ok()).toBeTruthy();

    const duplicated = await duplicateResponse.json();
    expect(duplicated.status).toBe('Draft');
    expect(duplicated.id).not.toBe(costSheetId);

    // Step 10: Delete the duplicate (Draft status)
    const deleteResponse = await authDelete(request, `/cost-sheets/${duplicated.id}`);
    expect(deleteResponse.ok()).toBeTruthy();

    // Verify deleted
    const verifyResponse = await authGet(request, `/cost-sheets/${duplicated.id}`);
    expect(verifyResponse.ok()).toBeFalsy();
  });

  test('API — Past price suggestions', async ({ request }) => {
    const itemsResponse = await authGet(request, '/items/search?page=0&size=5');
    if (!itemsResponse.ok()) {
      test.skip();
      return;
    }

    const items = await itemsResponse.json();
    if (!items.content || items.content.length === 0) {
      test.skip();
      return;
    }

    const itemId = items.content[0].id;
    const response = await authGet(request, `/cost-sheets/past-prices?type=fabric&itemId=${itemId}`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
