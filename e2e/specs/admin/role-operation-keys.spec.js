import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

/**
 * Role & Access offers the operations decisions and payments got of their own (review F093) and the
 * bill-passing masters' own key (F266): each is a checkbox that can be ticked, is saved as ticked,
 * and comes back ticked after a reload, apart from the operation it was copied from.
 *
 * RBAC is OFF in e2e, so what the API refuses a role without them is proven by the API's tests.
 */

// Each new right as the matrix shows it: its section, the checkbox's label ("<op label> on <screen>"),
// the stored key and operation, and the operation the migration copied it from, which stays unticked.
const NEW_RIGHTS = [
  { section: 'Purchase Orders', label: 'Approve on Cutting PO', key: 'cutting-po', op: 'approve', source: 'update' },
  { section: 'Purchase Orders', label: 'Approve on Work Orders', key: 'work-order', op: 'approve', source: 'update' },
  { section: 'Purchase Orders', label: 'Approve on Finishing PO', key: 'finishing-po', op: 'approve', source: 'update' },
  { section: 'Production', label: 'Approve on Production — Sewing', key: 'production-sewing', op: 'approve', source: 'update' },
  { section: 'Sample Requests', label: 'Dispatch on Sample Dispatches', key: 'sample-dispatches', op: 'dispatch', source: 'add' },
  { section: 'Sample Requests', label: 'Issue on Invoices (Samples)', key: 'sample-invoices', op: 'post', source: 'add' },
  { section: 'Sample Requests', label: 'Cancel on Invoices (Samples)', key: 'sample-invoices', op: 'cancel', source: 'update' },
  { section: 'Master Data', label: 'View on Bill Passing Masters', key: 'inventory-bill-passing-masters', op: 'view' },
  { section: 'Master Data', label: 'Add on Bill Passing Masters', key: 'inventory-bill-passing-masters', op: 'add' },
  { section: 'Master Data', label: 'Update on Bill Passing Masters', key: 'inventory-bill-passing-masters', op: 'update' },
  { section: 'Master Data', label: 'Delete on Bill Passing Masters', key: 'inventory-bill-passing-masters', op: 'delete' },
  { section: 'HR & Payroll', label: 'Pay on Payroll', key: 'hr-payroll', op: 'pay', source: 'add' },
  { section: 'HR & Payroll', label: 'Write off on Loans & Advances', key: 'hr-loans', op: 'approve', source: 'update' },
  { section: 'HR & Payroll', label: 'Pay on Bonus', key: 'hr-bonus', op: 'pay', source: 'add' },
  { section: 'HR & Payroll', label: 'Approve on Statutory', key: 'hr-statutory', op: 'approve', source: 'update' },
  { section: 'HR & Payroll', label: 'Pay on Statutory', key: 'hr-statutory', op: 'pay', source: 'add' },
  { section: 'HR & Payroll', label: 'Settle on F&F Settlement', key: 'hr-fnf', op: 'pay', source: 'add' },
];

const SECTIONS = [...new Set(NEW_RIGHTS.map((r) => r.section))];

// Role names take letters and spaces only, so the run's timestamp is spelled in letters
const ROLE_NAME = `Operation Keys ${String(Date.now()).replace(/\d/g, (d) => 'abcdefghij'[Number(d)])}`;

let api;
let roleId;

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  const res = await api.post('/roles', {
    name: ROLE_NAME,
    description: 'F093 operation keys e2e',
    status: 'ACTIVE',
    permissions: { dashboard: { access: true, operations: { view: true } } },
  });
  expect(res.status, JSON.stringify(res.data)).toBe(200);
  roleId = res.data.id;
});

test.afterAll(async () => {
  if (roleId) await api.delete(`/roles/${roleId}`);
  await api?.dispose();
});

test.beforeEach(async ({ page }) => {
  await ensureSessionActive(page);
});

/** Opens the role's editor from a freshly loaded list page. */
const openRole = async (page) => {
  await goToListPage(page, '/admin/roles');
  await page.getByPlaceholder('Search by role name or description...').fill(ROLE_NAME);
  const row = page.locator('.ant-table-row').filter({ hasText: ROLE_NAME });
  await expect(row).toHaveCount(1, { timeout: 20000 });
  await row.locator('button:has(.anticon-edit)').click();
  const dialog = page.locator('.ant-modal').filter({ hasText: `Edit Role — ${ROLE_NAME}` });
  await expect(dialog).toBeVisible();
  return dialog;
};

/** Shows one section of the matrix: the rail on the left picks which section the pane lists. */
const showSection = async (dialog, section) => {
  await dialog.locator('.perm-rail-item').filter({ hasText: section }).click();
  await expect(dialog.locator('.perm-panel-head')).toContainText(section);
};

const box = (dialog, label) => dialog.getByRole('checkbox', { name: label, exact: true });

/** "Add on Payroll" for hr-payroll's add: the CRUD boxes are labelled by the screen's name. */
const sourceLabel = (right) => {
  const screen = right.label.slice(right.label.indexOf(' on ') + 4);
  return `${right.source[0].toUpperCase()}${right.source.slice(1)} on ${screen}`;
};

test('the new operations and the bill-passing masters key are ticked, saved and come back after a reload', async ({ page }) => {
  test.setTimeout(120000);

  await test.step('every new checkbox renders unticked and can be ticked', async () => {
    const dialog = await openRole(page);
    for (const section of SECTIONS) {
      await showSection(dialog, section);
      for (const right of NEW_RIGHTS.filter((r) => r.section === section)) {
        const checkbox = box(dialog, right.label);
        await expect(checkbox, right.label).toBeVisible();
        await expect(checkbox, right.label).not.toBeChecked();
        await checkbox.check();
        await expect(checkbox, right.label).toBeChecked();
      }
    }

    const saved = page.waitForResponse((r) => r.url().includes(`/roles/${roleId}`) && r.request().method() === 'PUT');
    await dialog.getByRole('button', { name: /Update Role/ }).click();
    expect((await saved).status()).toBe(200);
    await expect(dialog).toBeHidden({ timeout: 15000 });
  });

  await test.step('the API stored each one on its own, apart from the operation it was copied from', async () => {
    const { data } = await api.get(`/roles/${roleId}`);
    for (const right of NEW_RIGHTS) {
      expect(data.permissions?.[right.key]?.operations?.[right.op], `${right.key}:${right.op}`).toBe(true);
      if (right.source) {
        expect(data.permissions?.[right.key]?.operations?.[right.source], `${right.key}:${right.source}`).not.toBe(true);
      }
    }
    // The masters key does not reach back into the bill workspace's own key
    expect(data.permissions?.['inventory-bill-passing']?.operations?.view, 'inventory-bill-passing:view').not.toBe(true);
  });

  await test.step('after a reload every new checkbox is still ticked and its source is not', async () => {
    const dialog = await openRole(page);
    for (const section of SECTIONS) {
      await showSection(dialog, section);
      for (const right of NEW_RIGHTS.filter((r) => r.section === section)) {
        await expect(box(dialog, right.label), right.label).toBeChecked();
        if (right.source) await expect(box(dialog, sourceLabel(right)), sourceLabel(right)).not.toBeChecked();
      }
    }
  });
});
