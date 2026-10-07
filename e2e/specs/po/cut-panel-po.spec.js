/**
 * Purchase Orders — Cut Panel PO, on the real API (/cut-panel-pos) and the approval engine.
 *
 * beforeAll makes, through the API (e2e/helpers/job-work-api.js): the seeded job workers and the job-work return
 * units (e2e/helpers/job-work-seed.js), submitted Cut Panel Requirements on ORD/0002, and approved Cut Panel POs
 * on some of them. No approval flow applies to an ordinary PO, so submit approves it at once (decision D1); the
 * engine test adds a flow that only a PO above ₹1,00,000 meets, and removes it afterwards.
 *
 * What this tests:
 *   - Create on a released requirement: process → requirement → Add to Grid → job worker → return unit → date →
 *     one rate on all lines → value → Save Draft (CPPO/<FY>/NNNN, still in edit mode) → Submit for Approval (approved, no flow) → Send to Vendor
 *   - Ineligible job workers stay listed, greyed, with the reason (BR-14)
 *   - An approved PO's terms change before it is sent, audited field by field (BR-16)
 *   - A PO an approval flow applies to waits for its approver, who approves it from the PO's Approval panel
 *   - Amend: the open amendment's diff is on screen; submitted with no flow it is approved and becomes R1
 *   - Close short releases the unreceived quantity; the vendor copy carries no internal quantities
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureJobWorkers, ensureJobWorkUnits, JOB_WORK_UNITS } from '../../helpers/job-work-seed.js';
import { submittedCpr, cutPanelPo, VENDOR } from '../../helpers/job-work-api.js';

const BASE = '/purchase-orders/cut-panel-po';

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mon = d.toLocaleString('en-US', { month: 'short' });
  return `${String(d.getDate()).padStart(2, '0')}-${mon}-${d.getFullYear()}`;
};

const openDropdown = async (page, input) => {
  // Centred first: the sticky action bar would cover a control at the bottom edge.
  const select = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
};

async function pickOption(page, input, text) {
  const dropdown = await openDropdown(page, input);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await dropdown.waitFor({ state: 'hidden' }).catch(() => {});
}

const selectOf = (page, id) => page.locator(`#${id}`);

async function setDate(page, id, text) {
  const input = page.locator(`#${id}`);
  await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

async function fillRate(page, rate, count) {
  await pickOption(page, page.getByRole('combobox', { name: 'Fill rate for' }), 'All lines');
  await page.getByRole('spinbutton', { name: 'Rate to fill' }).fill(String(rate));
  const apply = page.getByRole('button', { name: `Apply to ${count}` });
  await apply.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await apply.click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Apply' }).click();
}

async function reason(page, { code, remark }) {
  const dialog = page.getByRole('dialog');
  if (code) await pickOption(page, dialog.getByRole('combobox', { name: 'Reason' }), code);
  await dialog.getByRole('textbox', { name: 'Remark' }).fill(remark);
  await dialog.locator('.ant-modal-footer .ant-btn-primary').click();
  await expect(dialog).toBeHidden();
}

const valueRow = (page, label) => page.locator('#cpp-delivery div').filter({ hasText: new RegExp(`^${label}`) }).last();
const approvalCard = (page) => page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: /^Approval$/ }) });

const fx = {};
let flowId;

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    await ensureJobWorkers(api);
    await ensureJobWorkUnits(api);
    fx.forUi = await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Slate Blue' });
    fx.terms = await cutPanelPo(api, await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Slate Blue', panel: 'Back Panel' }));
    fx.amend = await cutPanelPo(api, await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Slate Blue', panel: 'Collar' }));
    const sent = await cutPanelPo(api, await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Slate Blue', panel: 'Pocket' }));
    const res = await api.post(`/cut-panel-pos/${sent.id}/send`, { version: sent.version });
    fx.sent = res.data;
    // A flow only a PO above ₹1,00,000 meets, approved by superadmin (user 1): the engine test's PO alone
    const flow = await api.post('/approval-flows', {
      name: `E2E Cut Panel PO above 1 lakh ${Date.now()}`, entityType: 'CUT_PANEL_PO', active: true, priority: 10,
      preventSelfApproval: false, conditions: [{ field: 'amount', operator: 'GT', value: 100000 }],
      levels: [{ levelNumber: 1, levelName: 'GM Operations', approverType: 'USER', approverUserId: 1, allowReject: true, allowReferBack: true }],
    });
    if (flow.status >= 300) throw new Error(`approval flow → ${flow.status} ${JSON.stringify(flow.data)}`);
    flowId = flow.data.id;
    fx.engine = await cutPanelPo(api, await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Slate Blue', panel: 'Hood' }),
      { rate: 500, rateRemark: 'Hood print is all-over: a different job' });
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  if (!flowId) return;
  const api = await createAuthenticatedClient();
  try {
    await api.delete(`/approval-flows/${flowId}`);
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000); // journeys across the PO and its requirement
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('Create on a released requirement: fetch, rate, value, save, submit (approved with no flow), send', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);

  await pickOption(page, selectOf(page, 'cpp-process'), 'Panel Printing');
  await page.getByRole('checkbox', { name: `Select ${fx.forUi.cprNo}` }).check();
  await page.getByRole('button', { name: 'Add to Grid' }).click();
  await expect(page.getByText('4 line(s) added')).toBeVisible(); // Slate Blue S, M, L, XL
  await expect(page.getByRole('spinbutton', { name: 'PO qty Slate Blue M' })).toHaveValue('200.00');

  await pickOption(page, selectOf(page, 'cpp-vendor-select'), VENDOR.printers);
  const delivery = page.locator('#cpp-delivery');
  await pickOption(page, selectOf(page, 'cpp-returnUnit'), JOB_WORK_UNITS.cut.unitName);
  await expect(delivery).toContainText('12 Mill Road, Tiruppur, Tamil Nadu 641601');
  await setDate(page, 'cpp-requiredDeliveryDate', plusDays(20));
  await fillRate(page, 5, 4);
  await expect(valueRow(page, 'Basic amount')).toContainText('₹3,000.00'); // 600 pcs × ₹5

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/\\d+\\?edit=1$`)); // a saved draft stays in edit mode
  await expect(page.getByRole('heading', { name: /CPPO\/\d{2}-\d{2}\/\d+/ })).toBeVisible();

  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText('Submitted for approval').first()).toBeVisible(); // the toast, and the approval panel's entry
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible(); // no flow: approved at once
  await page.getByRole('button', { name: 'Send to Vendor' }).click();
  await expect(page.getByText('Sent to the vendor')).toBeVisible();
});

test('Ineligible job workers stay listed, greyed, with the reason', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await pickOption(page, selectOf(page, 'cpp-process'), 'Panel Printing');
  const input = selectOf(page, 'cpp-vendor-select');
  const dropdown = await openDropdown(page, input);
  // The list is virtual: search each vendor so its option is rendered.
  const expectOption = async (name, why, disabled = true) => {
    await input.fill(name.split(' ')[0]);
    const option = dropdown.locator('.ant-select-item-option').filter({ hasText: name });
    await expect(option).toContainText(why);
    await expect(option).toHaveClass(disabled ? /option-disabled/ : /^((?!option-disabled).)*$/);
  };
  await expectOption('Sri Murugan Prints', 'Approved to', false);
  await expectOption('Star Heat Transfers', 'Approval expired');
  await expectOption('Nova Prints', 'Job-work approval missing');
  await expectOption('Classic Embroidery Works', 'Does not do Panel Printing');
  await expectOption('Old Town Dyers', 'Inactive');
});

test('An approved PO changes its terms before it is sent, audited', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/${fx.terms.id}`);
  await waitForPageReady(page);
  await expect(page.locator('#cpp-requiredDeliveryDate')).toBeDisabled(); // opened read-only
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await setDate(page, 'cpp-requiredDeliveryDate', plusDays(25));
  // Edit mode offers only its save: sending now would send the stored terms.
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Changes saved')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeEnabled();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText(`Expected delivery date: `);
  await expect(page.locator('.ant-drawer-open')).toContainText(plusDays(25));
});

test('A PO an approval flow applies to waits for its approver, who approves it in the Approval panel', async ({ page }) => {
  expect(fx.engine.status).toBe('SUBMITTED');
  await navigateWithAuth(page, `${BASE}/${fx.engine.id}`);
  await waitForPageReady(page);
  const card = approvalCard(page);
  await expect(card).toContainText('Approval level 1 of 1');
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toHaveCount(0);
  await card.getByRole('button', { name: /Approve/ }).click();
  const dialog = page.locator('.ant-modal').last();
  await dialog.getByRole('button', { name: /Approve$/ }).click();
  await expect(page.getByText(`Approve recorded for ${fx.engine.poNo}`)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible(); // reloaded: Approved
  await expect(card).toContainText('GM Operations');
});

test('Amend an approved PO: the diff is on screen; with no flow the amendment is approved as R1', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/${fx.amend.id}`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Amend' }).click();
  await reason(page, { remark: 'Buyer reduced Slate Blue M by 20.' });
  await expect(page.getByText(/Amendment R1 being drafted/)).toBeVisible();
  await page.getByRole('spinbutton', { name: 'PO qty Slate Blue M' }).fill('180');
  await expect(page.locator('#cpp-amendments')).toContainText('Slate Blue M — PO qty');
  await page.getByRole('button', { name: 'Submit amendment R1' }).click();
  await expect(page.getByText('Amendment submitted for approval')).toBeVisible();
  await expect(page.locator('#cpp-amendments')).toContainText('R1 — Buyer reduced Slate Blue M by 20.');
  await expect(page.getByRole('spinbutton', { name: 'PO qty Slate Blue M' })).toHaveValue('180.00');
});

test('Close short a sent PO; the vendor copy carries no internal quantities', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/${fx.sent.id}`);
  await waitForPageReady(page);
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Print vendor copy' }).click(),
  ]);
  await popup.waitForLoadState();
  const html = await popup.content();
  expect(html).toContain(fx.sent.poNo);
  expect(html).toContain(VENDOR.printers);
  expect(html).toContain('Print to the approved strike-off'); // the processing instructions
  expect(html).not.toMatch(/Previously|Balance|Required qty/i);
  await popup.close();

  await page.getByRole('button', { name: 'Close short' }).click();
  await reason(page, { code: 'Vendor cannot complete', remark: 'Vendor capacity lost; balance to be re-issued.' });
  await expect(page.getByText(/PO closed short/)).toBeVisible();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
});

test('The list pages on the server and opens on the open POs', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/list`);
  await expect(page.locator('.ant-layout-sider .ant-menu-item-selected')).toContainText('Cut Panel PO');
  await expect(page.locator('.ant-table-row').filter({ hasText: fx.terms.poNo })).toBeVisible();
  await expect(page.locator('.ant-table-row').filter({ hasText: fx.sent.poNo })).toHaveCount(0); // closed: not open
});
