/**
 * Reports module.
 *
 * R1–R6 — the definition-driven pipeline. The module is definition-driven and NOTHING is
 * seeded: `rpt_definitions` is empty on a fresh e2e boot. So the suite first authors one
 * definition over `ord_orders` via `POST /reports/definitions` (the controller binds the
 * entity directly), then walks the user-facing surfaces: list, builder, execution, export,
 * saved reports, log.
 *
 * O1–O7 — role ownership, and the delete that used to destroy other people's saved work.
 * These run as three identities; see the block's own comment for why one is not enough.
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
      // Exports are raw bytes (CSV/XLSX/PDF) — read the body, not the JSON-parsed field.
      const body = await res.response.body();
      expect(body.length, `${format} export must not be empty`).toBeGreaterThan(50);
    }
  });

  test('R1b — the definition appears on the reports list page', async ({ page }) => {
    await navigateWithAuth(page, '/reports/list');
    await waitForPageReady(page);
    await expect(page.getByText(REPORT_NAME).first()).toBeVisible({ timeout: 15000 });
  });

  test('R2 — builder: generate shows rows with the default columns', async ({ page }) => {
    // Deep-link straight to the builder — the list card's click target proved
    // ambiguous, and the builder route itself is the surface under test here.
    await navigateWithAuth(page, `/reports/builder/${defId}`);
    await waitForPageReady(page);

    await page.locator('button').filter({ hasText: /Generate|Run/i }).first().click();
    await expect(page.locator('.ant-table-row').first()).toBeVisible({ timeout: 20000 });
    // Default columns come from isDefault=true fields.
    await expect(page.locator('.ant-table-thead').getByText('Order No')).toBeVisible();
    await expect(page.locator('.ant-table-thead').getByText('Buyer')).toBeVisible();
  });

  test('R5 — save the configuration, reopen it from Saved Reports, delete it', async ({ page }) => {
    const savedName = `E2E Saved ${Date.now()}`;

    // Deep-link straight to the builder — the list card's click target proved
    // ambiguous, and the builder route itself is the surface under test here.
    await navigateWithAuth(page, `/reports/builder/${defId}`);
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

/**
 * Scenarios O1–O7: a report belongs to the role that authored it, and deleting one no longer
 * destroys other people's saved configurations.
 *
 * Three identities, because one cannot prove either claim:
 *   • e2e-reports  — 'E2E Report Author', reports view/add/update/delete, NOT superuser
 *   • e2e-viewer   — 'Viewer' (V114), reports.view only
 *   • superadmin   — 'Super Admin', the superuser that sees every role's
 *
 * The author is deliberately not a superuser: with only superadmin available, the author and
 * the see-everything principal would be the same account and the scoping assertions would
 * pass whether or not scoping existed.
 */
test.describe('Reports — role ownership', () => {
  let author;
  let viewer;
  let superadmin;
  let ownedDefId;
  let deletedDefId;
  let savedConfigId;
  const OWNED_CODE = `E2E_OWNED_${Date.now()}`;

  test.beforeAll(async () => {
    superadmin = await createAuthenticatedClient();
    author = await createAuthenticatedClient('e2e-reports', 'admin123');
    viewer = await createAuthenticatedClient('e2e-viewer', 'admin123');
  });

  test.afterAll(async () => {
    // Soft delete, so this leaves the row behind on purpose — the saved configuration
    // pointing at it has to keep resolving.
    if (ownedDefId) await author.delete(`/reports/definitions/${ownedDefId}`).catch(() => {});
    await Promise.all([author?.dispose(), viewer?.dispose(), superadmin?.dispose()]);
  });

  test('O1 — a non-superuser role authors a report from the designer, with no SQL', async () => {
    const catalog = await author.get('/reports/catalog');
    expect(catalog.status, 'a role that may add reports must be able to load the catalog')
      .toBeLessThan(300);
    const source = catalog.data?.[0];
    expect(source, 'the catalog must offer at least one data source').toBeTruthy();

    const res = await author.post('/reports/definitions/from-blueprint', {
      dataSourceKey: source.key,
      reportCode: OWNED_CODE,
      displayName: 'E2E Owned Report',
      description: 'Authored by a non-superuser role',
      active: true,
      columns: source.columns.slice(0, 3).map((c) => ({ key: c.key, isDefault: true })),
    });
    expect(res.status, `blueprint create failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);
    ownedDefId = res.data.id;
    expect(res.data.ownerRoleName, 'the author’s role owns it, without being asked')
      .toBe('E2E Report Author');
  });

  test('O2 — the owning role sees it, another role does not, a superuser does', async () => {
    const mine = await author.get('/reports/definitions');
    expect(mine.data.some((d) => d.id === ownedDefId), 'the author must see their own').toBeTruthy();

    const theirs = await viewer.get('/reports/definitions');
    expect(theirs.status).toBeLessThan(300);
    expect(
      theirs.data.some((d) => d.id === ownedDefId),
      'another role must NOT see it — this is the whole point of ownership',
    ).toBeFalsy();

    const all = await superadmin.get('/reports/definitions');
    expect(all.data.some((d) => d.id === ownedDefId), 'a superuser sees every role’s')
      .toBeTruthy();
  });

  test('O3 — another role cannot open or run it by id', async () => {
    const byId = await viewer.get(`/reports/definitions/${ownedDefId}`);
    expect(byId.status, 'a deep link from another role must be refused').toBe(403);

    const run = await viewer.post('/reports/execute', {
      reportDefId: ownedDefId,
      selectedFieldCodes: [],
      filters: {},
      page: 0,
      size: 5,
    });
    expect(run.status, 'and so must executing it').toBe(403);
  });

  test('O4 — authoring is gated by permission, raw SQL by superuser', async () => {
    const viewerAttempt = await viewer.post('/reports/definitions/from-blueprint', {
      dataSourceKey: 'anything',
      reportCode: `E2E_DENIED_${Date.now()}`,
      displayName: 'Should not exist',
      columns: [{ key: 'x' }],
    });
    expect(viewerAttempt.status, 'reports.view alone must not author a report').toBe(403);

    // The blueprint path carries no SQL; this one does, so it stays superuser-only even for
    // a role that may design reports.
    const rawAttempt = await author.post('/reports/definitions', {
      moduleName: 'ORDER',
      reportCode: `E2E_RAW_${Date.now()}`,
      displayName: 'Raw SQL attempt',
      baseQuery: 'ord_orders o',
      isActive: true,
      fields: [{ fieldCode: 'order_no', displayName: 'Order No', fieldType: 'STRING', sqlExpression: 'o.order_no', isDefault: true, displayOrder: 1 }],
      filters: [],
    });
    expect(rawAttempt.status, 'supplying executable SQL is a superuser action').toBe(403);
  });

  test('O5 — a saved configuration is visible to the whole role, deletable only by its author', async () => {
    const saved = await author.post('/reports/saved', {
      reportDefId: ownedDefId,
      savedName: `E2E Shared ${Date.now()}`,
      selectedFields: [],
      appliedFilters: {},
      sortConfig: {},
    });
    expect(saved.status, `save failed: ${JSON.stringify(saved.data)}`).toBeLessThan(300);
    savedConfigId = saved.data.id;
    expect(saved.data.canEdit, 'its author may edit it').toBeTruthy();

    const outsider = await viewer.get('/reports/saved');
    expect(
      outsider.data.some((s) => s.id === savedConfigId),
      'a different role must not see it',
    ).toBeFalsy();

    const outsiderDelete = await viewer.delete(`/reports/saved/${savedConfigId}`);
    expect(outsiderDelete.status, 'and certainly must not delete it').toBe(403);
  });

  test('O6 — deleting the report keeps every saved configuration built on it', async () => {
    // The bug this proves gone: fk_rpt_saved_reports_definition carried ON DELETE CASCADE
    // and delete() was a hard deleteById, so this call used to destroy the row asserted
    // below — for every user, silently.
    const removed = await author.delete(`/reports/definitions/${ownedDefId}`);
    expect(removed.status, `delete failed: ${JSON.stringify(removed.data)}`).toBeLessThan(300);

    const gone = await author.get('/reports/definitions');
    expect(gone.data.some((d) => d.id === ownedDefId), 'it leaves the list').toBeFalsy();

    const stillThere = await author.get('/reports/saved');
    const config = stillThere.data.find((s) => s.id === savedConfigId);
    expect(config, 'the saved configuration MUST survive the report being deleted').toBeTruthy();
    expect(config.reportAvailable, 'but it can no longer be run, and says so').toBe(false);

    deletedDefId = ownedDefId;
    ownedDefId = null; // afterAll must not delete it twice
  });

  test('O7 — a deleted report can no longer be opened or run', async () => {
    expect(deletedDefId, 'O6 must have run first').toBeTruthy();

    const reopen = await author.get(`/reports/definitions/${deletedDefId}`);
    expect(reopen.status, 'a deleted definition is not found, not served').toBe(404);

    const run = await author.post('/reports/execute', {
      reportDefId: deletedDefId,
      selectedFieldCodes: [],
      filters: {},
      page: 0,
      size: 5,
    });
    expect(run.status, 'and it cannot be executed either').toBe(404);
  });
});
