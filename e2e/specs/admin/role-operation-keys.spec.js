import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureSessionActive, goToListPage } from '../../helpers/navigation.js';

/**
 * Role & Access offers the operations decisions and payments got of their own (review F093), the
 * bill-passing masters' own key (F266) and the Vendor master's key: each is a checkbox in the role
 * editor that can be ticked, is saved as ticked, and shows as granted in the view dialog after a
 * reload, apart from the operation it was copied from.
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
  { section: 'Master Data', label: 'View on Vendors', key: 'vendor-info', op: 'view' },
  { section: 'Master Data', label: 'Add on Vendors', key: 'vendor-info', op: 'add' },
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

/** The role's row on a freshly loaded list page. */
const findRole = async (page) => {
  await goToListPage(page, '/admin/roles');
  await page.getByPlaceholder('Search by role name or description...').fill(ROLE_NAME);
  const row = page.locator('.ant-table-row').filter({ hasText: ROLE_NAME });
  await expect(row).toHaveCount(1, { timeout: 20000 });
  return row;
};

/** The row's Edit opens the editor page. */
const openEditor = async (page) => {
  await (await findRole(page)).locator('button:has(.anticon-edit)').click();
  await expect(page).toHaveURL(new RegExp(`/admin/roles/edit/${roleId}$`));
  await expect(page.getByRole('navigation', { name: 'Sections' })).toBeVisible({ timeout: 20000 });
};

/** The role's name opens the read-only view dialog. */
const openDialog = async (page) => {
  await (await findRole(page)).getByRole('button', { name: ROLE_NAME }).click();
  return viewDialog(page);
};

const viewDialog = async (page) => {
  const dialog = page.locator('.ant-modal').filter({ hasText: ROLE_NAME });
  await expect(dialog).toBeVisible({ timeout: 20000 });
  return dialog;
};

/** Opens one section in the editor: the nav on the left picks which section the table lists. */
const showSection = async (page, section) => {
  await page.getByRole('navigation', { name: 'Sections' })
    .getByRole('button', { name: new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) })
    .click();
  await expect(page.locator('.ag-panel-title')).toHaveText(section);
};

const box = (page, label) => page.getByRole('checkbox', { name: label, exact: true });

/** A granted right in the view dialog: a tick carrying the same name the editor's box has. */
const tick = (dialog, label) => dialog.getByRole('img', { name: label, exact: true });

/** "Add on Payroll" for hr-payroll's add: the CRUD boxes are labelled by the screen's name. */
const sourceLabel = (right) => {
  const screen = right.label.slice(right.label.indexOf(' on ') + 4);
  return `${right.source[0].toUpperCase()}${right.source.slice(1)} on ${screen}`;
};

test('the new operations and the bill-passing masters key are ticked, saved and come back after a reload', async ({ page }) => {
  test.setTimeout(120000);

  await test.step('every new checkbox renders unticked and can be ticked', async () => {
    await openEditor(page);
    for (const section of SECTIONS) {
      await showSection(page, section);
      for (const right of NEW_RIGHTS.filter((r) => r.section === section)) {
        const checkbox = box(page, right.label);
        await expect(checkbox, right.label).toBeVisible();
        await expect(checkbox, right.label).not.toBeChecked();
        await checkbox.check();
        await expect(checkbox, right.label).toBeChecked();
      }
    }

    const saved = page.waitForResponse((r) => r.url().includes(`/roles/${roleId}`) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: /Save changes/ }).click();
    expect((await saved).status()).toBe(200);
    // Opened from the list row's Edit, the editor returns to the list
    await expect(page).toHaveURL(/\/admin\/roles$/);
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

  await test.step('after a reload the view dialog ticks every new right and not its source', async () => {
    const dialog = await openDialog(page);
    await expect(dialog.getByRole('checkbox')).toHaveCount(0); // read-only: ticks, never boxes
    for (const right of NEW_RIGHTS) {
      await expect(tick(dialog, right.label), right.label).toBeVisible();
      if (right.source) await expect(tick(dialog, sourceLabel(right)), sourceLabel(right)).toHaveCount(0);
    }
  });
});
