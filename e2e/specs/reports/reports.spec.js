/**
 * Reports module (scenarios R1–R6).
 *
 * The module is definition-driven and NOTHING is seeded — `rpt_definitions` is empty on
 * a fresh e2e boot. So the suite first authors one definition over `ord_orders` via
 * `POST /reports/definitions` (the controller binds the entity directly), then walks
 * the user-facing surfaces: list, builder, execution, export, saved reports, log.
 *
 * AI chat (R7) is exercised only in the Neon smoke — Gemini is disabled on H2.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { navigateWithAuth, waitForPageReady, ensureSessionActive } from '../../helpers/navigation.js';

let api;
let defId;
const REPORT_CODE = `E2E_ORDERS_${Date.now()}`;
const REPORT_NAME = 'E2E Order Register';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

test.describe('Reports — definition-driven pipeline', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
  });

  test.afterAll(async () => {
    if (defId) await api.delete(`/reports/definitions/${defId}`).catch(() => {});
    await api?.dispose();
  });

  test('R1a — author a definition over orders via the API', async () => {
    const res = await api.post('/reports/definitions', {
      moduleName: 'ORDER',
      reportCode: REPORT_CODE,
      displayName: REPORT_NAME,
      description: 'Orders with buyer and status, authored by the regression suite',
      // baseQuery is a FROM-fragment: the executor renders SELECT <sqlExpression AS code> FROM <baseQuery>.
      baseQuery: 'ord_orders o',
      defaultSortColumn: 'order_no',
      defaultSortDir: 'ASC',
      isActive: true,
      fields: [
        { fieldCode: 'order_no', displayName: 'Order No', fieldType: 'STRING', sqlExpression: 'o.order_no', isDefault: true, isSortable: true, displayOrder: 1 },
        { fieldCode: 'buyer_name', displayName: 'Buyer', fieldType: 'STRING', sqlExpression: 'o.buyer_name', isDefault: true, isSortable: true, displayOrder: 2 },
        { fieldCode: 'style_no', displayName: 'Style', fieldType: 'STRING', sqlExpression: 'o.style_no', isDefault: true, displayOrder: 3 },
        { fieldCode: 'status', displayName: 'Status', fieldType: 'STRING', sqlExpression: 'o.status', isDefault: true, isFilterable: true, displayOrder: 4 },
        { fieldCode: 'total_quantity', displayName: 'Total Qty', fieldType: 'NUMBER', sqlExpression: 'o.total_quantity', isDefault: false, displayOrder: 5 },
      ],
      filters: [],
    });
    expect(res.status, `definition create failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);
    defId = res.data.id;
    expect(defId).toBeTruthy();
  });

  test('R6a — execute returns rows and logs the run', async () => {
    const exec = await api.post('/reports/execute', {
      reportDefId: defId,
      selectedFieldCodes: ['order_no', 'buyer_name', 'status'],
      filters: {},
      page: 0,
      size: 20,
    });
    expect(exec.status, `execute failed: ${JSON.stringify(exec.data)}`).toBeLessThan(300);
    const rows = exec.data?.rows || exec.data?.content || exec.data?.data || [];
    expect(Array.isArray(rows)).toBeTruthy();
    expect(rows.length, 'seeded orders must appear').toBeGreaterThan(0);

    const log = await api.get('/reports/execution-log?page=0&size=10');
    expect(log.status).toBeLessThan(300);
    const entries = log.data?.content || log.data || [];
    const mine = entries.find(
      (e) => e.reportDefId === defId || e.reportCode === REPORT_CODE || e.reportName === REPORT_NAME,
    );
    expect(mine, 'execution must be logged').toBeTruthy();
    expect(String(mine.status || mine.executionStatus)).toMatch(/SUCCESS/i);
  });

  test('R4 — export CSV, XLSX and PDF all return non-empty bytes', async () => {
    for (const format of ['CSV', 'EXCEL', 'PDF']) {
      const res = await api.post('/reports/export', {
        reportDefId: defId,
        selectedFieldCodes: ['order_no', 'buyer_name', 'status'],
        filters: {},
        format,
      });
      expect(res.status, `${format} export failed`).toBeLessThan(300);
      const size = typeof res.data === 'string'
        ? res.data.length
        : (res.data?.byteLength ?? JSON.stringify(res.data ?? '').length);
      expect(size, `${format} export must not be empty`).toBeGreaterThan(50);
    }
  });

  test('R1b — the definition appears on the reports list page', async ({ page }) => {
    await navigateWithAuth(page, '/reports/list');
    await waitForPageReady(page);
    await expect(page.getByText(REPORT_NAME).first()).toBeVisible({ timeout: 15000 });
  });

  test('R2 — builder: generate shows rows with the default columns', async ({ page }) => {
    await navigateWithAuth(page, '/reports/list');
    await waitForPageReady(page);
    await page.getByText(REPORT_NAME).first().click();
    await page.waitForURL(/reports\/builder/, { timeout: 15000 });
    await waitForPageReady(page);

    await page.locator('button').filter({ hasText: /Generate|Run/i }).first().click();
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 20000 });
    // Default columns come from isDefault=true fields.
    await expect(page.locator('.ant-table-thead').getByText('Order No')).toBeVisible();
    await expect(page.locator('.ant-table-thead').getByText('Buyer')).toBeVisible();
  });

  test('R5 — save the configuration, reopen it from Saved Reports, delete it', async ({ page }) => {
    const savedName = `E2E Saved ${Date.now()}`;

    await navigateWithAuth(page, '/reports/list');
    await waitForPageReady(page);
    await page.getByText(REPORT_NAME).first().click();
    await page.waitForURL(/reports\/builder/, { timeout: 15000 });
    await waitForPageReady(page);
    await page.locator('button').filter({ hasText: /Generate|Run/i }).first().click();
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 20000 });

    await page.locator('button').filter({ hasText: /Save Report|Save/i }).first().click();
    const drawer = page.locator('.ant-drawer:visible, .ant-modal:visible').first();
    await expect(drawer).toBeVisible({ timeout: 10000 });
    await drawer.locator('input:visible').first().fill(savedName);
    await drawer.locator('button').filter({ hasText: /Save|OK|Submit/i }).last().click();
    await expect(
      page.locator('.ant-message-notice').filter({ hasText: /saved|success/i }).first()
    ).toBeVisible({ timeout: 15000 });

    await navigateWithAuth(page, '/reports/saved');
    await waitForPageReady(page);
    const row = page.locator('.ant-table-row').filter({ hasText: savedName }).first();
    await expect(row).toBeVisible({ timeout: 15000 });

    await row.locator('button').filter({ hasText: /Delete/i }).first()
      .or(row.locator('button').filter({ has: page.locator('.anticon-delete') }).first())
      .click();
    await page.locator('.ant-modal:visible, .ant-popover:visible')
      .locator('button').filter({ hasText: /Yes|Delete|OK/i }).last().click();
    await expect(
      page.locator('.ant-table-row').filter({ hasText: savedName })
    ).toHaveCount(0, { timeout: 15000 });
  });

  test('R6b — a failing execution is logged as FAILED, not lost', async () => {
    // Author a deliberately broken definition (bad column) and execute it.
    const bad = await api.post('/reports/definitions', {
      moduleName: 'ORDER',
      reportCode: `E2E_BROKEN_${Date.now()}`,
      displayName: 'E2E Broken Report',
      baseQuery: 'ord_orders o',
      isActive: true,
      fields: [{ fieldCode: 'no_such_column', displayName: 'Ghost', fieldType: 'STRING', sqlExpression: 'o.no_such_column', isDefault: true, displayOrder: 1 }],
      filters: [],
    });
    expect(bad.status).toBeLessThan(300);
    const badId = bad.data.id;

    try {
      const exec = await api.post('/reports/execute', {
        reportDefId: badId,
        selectedFieldCodes: ['no_such_column'],
        filters: {},
        page: 0,
        size: 10,
      });
      expect(exec.status, 'broken SQL must not return 2xx').toBeGreaterThanOrEqual(400);

      const log = await api.get('/reports/execution-log?page=0&size=10');
      const entries = log.data?.content || log.data || [];
      const failed = entries.find(
        (e) => (e.reportDefId === badId || e.reportName === 'E2E Broken Report')
          && /FAILED/i.test(String(e.status || e.executionStatus)),
      );
      expect(failed, 'failed run must be logged as FAILED').toBeTruthy();
    } finally {
      await api.delete(`/reports/definitions/${badId}`).catch(() => {});
    }
  });
});
