/**
 * Core modules — each one's records come back from the API and its list shows them.
 *
 * What this tests, for orders, BOM, costing, supplier POs and GRNs:
 *   - the API search returns the e2e seed's records (the `api` fixture)
 *   - the list screen renders them in a table with its key columns, with no page error or
 *     console error (`authedPage` + `consoleGuard`)
 *
 * Read-only against the e2e seed, so it runs in any order and on any lane. The route sweep in
 * this project covers every other screen loading cleanly.
 */
import { test, expect } from '../../fixtures.js';

const rowsOf = (data) => (Array.isArray(data) ? data : data?.content || []);

const MODULES = [
  { name: 'Orders', api: '/orders/search', list: '/orders/list', columns: ['Order No', 'Buyer', 'Total Qty', 'Status'] },
  { name: 'BOM', api: '/boms', list: '/bom/list', columns: ['Order No', 'Style No', 'Buyer', 'Status'] },
  { name: 'Costing', api: '/cost-sheets/search', list: '/costing/list', columns: ['Costing ID', 'Buyer', 'Style #', 'Status'] },
  { name: 'Supplier PO', api: '/purchase-orders/search', list: '/purchase-orders/supplier-po/list', columns: ['Status'] },
  { name: 'GRN', api: '/grns', list: '/inventory/grn/list', columns: ['Status'] },
];

for (const module of MODULES) {
  test.describe(module.name, () => {
    test('the API search returns the seeded records', async ({ api }) => {
      const res = await api.get(module.api, { page: 0, size: 5 });
      expect(res.status).toBe(200);
      expect(rowsOf(res.data).length).toBeGreaterThan(0);
    });

    test('the list shows them with its key columns', async ({ authedPage, consoleGuard }) => {
      await authedPage.goto(module.list);
      await expect(authedPage.locator('.ant-table-row').first()).toBeVisible({ timeout: 20000 });
      for (const column of module.columns) {
        await expect(authedPage.getByRole('columnheader', { name: column, exact: true }).first()).toBeVisible();
      }
    });
  });
}
