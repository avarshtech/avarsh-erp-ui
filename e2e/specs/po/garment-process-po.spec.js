/**
 * Purchase Orders — Garment Process PO, on the real API (/garment-process-pos) and the approval engine.
 *
 * beforeAll makes, through the API (e2e/helpers/job-work-api.js): the seeded job workers and return units
 * (e2e/helpers/job-work-seed.js) and submitted Garment Process Requirements on ORD/0003 (4 colours × S–XL,
 * 4,900 pcs a line). No approval flow applies to an ordinary PO, so submit approves it at once (decision D1); the
 * sign-off test adds a flow that only a PO above ₹1,00,000 meets, and removes it afterwards.
 *
 * What this tests:
 *   - Section ② (order, requirement, select-all) → Add to PO → vendor → rate → delivery → Save Draft
 *     (GPPO/<FY>/NNNN) → Submit (approved, no flow) → Send to Vendor
 *   - An excess over the balance blocks Submit until approved (AC-06)
 *   - A vendor short of the PO's process warns; under an approval flow the approver signs it off in the engine's
 *     Approve dialog — refused without the tick (§13)
 *   - Amend delivery on a sent PO is audited; the print carries no internal quantities; the list pages on the server
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureJobWorkers, ensureJobWorkUnits, JOB_WORK_UNITS } from '../../helpers/job-work-seed.js';
import { submittedGpr, garmentProcessPo } from '../../helpers/job-work-api.js';

const BASE = '/purchase-orders/garment-process-po';

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${d.getFullYear()}`;
};

const openDropdown = async (page, input) => {
  const select = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await select.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  return dropdown;
};

async function pickVendor(page, name) {
  const input = page.locator('#gpo-vendor-select');
  const dropdown = await openDropdown(page, input);
  await input.fill(name.split(' ')[0]);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: name }).first().click();
}

async function setDate(page, id, text) {
  const input = page.locator(`#${id}`);
  await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await input.click();
  await input.fill(text);
  await input.press('Enter');
}

/** Picks an option, and checks it took: a click that lands while the dropdown re-renders is retried once. */
async function pickSelect(page, id, text) {
  const input = page.locator(`#${id}`);
  const root = input.locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const dropdown = await openDropdown(page, input);
    await input.fill(text);
    await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
    const took = await expect(root).toContainText(text, { timeout: 3000 }).then(() => true, () => false);
    if (took) return;
    await page.keyboard.press('Escape');
  }
  await expect(root).toContainText(text);
}

/** Section ②: Order #, then Garment Process #, then the header select-all (one process), then Add to PO. */
async function addFromRequirement(page, gpr) {
  await pickSelect(page, 'gpo-order', 'ORD/0003');
  await pickSelect(page, 'gpo-gpr', gpr.requirementNo);
  await page.locator('#gpo-selection').getByRole('checkbox', { name: 'Select all' }).check();
  await page.getByRole('button', { name: 'Add to PO' }).click();
  await expect(page.getByText('16 line(s) added')).toBeVisible(); // 4 colours × 4 sizes
}

async function fillRates(page, rate) {
  const dropdown = await openDropdown(page, page.getByRole('combobox', { name: 'Fill rate for' }));
  await dropdown.locator('.ant-select-item-option').filter({ hasText: 'All lines' }).first().click();
  await page.getByRole('spinbutton', { name: 'Rate to fill' }).fill(String(rate));
  const apply = page.getByRole('button', { name: /^Apply to \d+$/ });
  await apply.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await apply.click();
  await page.locator('.ant-popover:not(.ant-popover-hidden)').getByRole('button', { name: 'Apply' }).click();
}

/** ⑤ Delivery Instructions: Return To stays Finishing; the return unit (its address is the delivery place) and the date. */
async function delivery(page) {
  await pickSelect(page, 'gpo-returnUnit', JOB_WORK_UNITS.fin.unitName);
  await expect(page.locator('#gpo-delivery')).toContainText('4 Dye House Street, Tiruppur, Tamil Nadu 641604');
  await setDate(page, 'gpo-expectedReturnDate', plusDays(12));
}

/** A draft built on screen from one requirement, saved. */
async function draft(page, gpr, { vendor, rate }) {
  await navigateWithAuth(page, `${BASE}/new`);
  await waitForPageReady(page);
  await addFromRequirement(page, gpr);
  await pickVendor(page, vendor);
  await fillRates(page, rate);
  await delivery(page);
}

const approvalCard = (page) => page.locator('.ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: /^Approval$/ }) });

const fx = {};
let flowId;

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    await ensureJobWorkers(api);
    await ensureJobWorkUnits(api);
    fx.create = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Enzyme Washing' });
    fx.excess = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Over Dyeing' });
    fx.signOff = await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Bleach Washing' });
    const sent = await garmentProcessPo(api, await submittedGpr(api, { orderNo: 'ORD/0003', process: 'Acid Washing' }), { vendor: 'Bluewave Garment Washers' });
    fx.sent = (await api.post(`/garment-process-pos/${sent.id}/send`, { version: sent.version })).data;
    const flow = await api.post('/approval-flows', {
      name: `E2E Garment Process PO above 1 lakh ${Date.now()}`, entityType: 'GARMENT_PROCESS_PO', active: true, priority: 10,
      preventSelfApproval: false, conditions: [{ field: 'amount', operator: 'GT', value: 100000 }],
      levels: [{ levelNumber: 1, levelName: 'Purchase Manager', approverType: 'USER', approverUserId: 1, allowReject: true, allowReferBack: true }],
    });
    if (flow.status >= 300) throw new Error(`approval flow → ${flow.status} ${JSON.stringify(flow.data)}`);
    flowId = flow.data.id;
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

test('Create from a requirement, save, submit (approved with no flow), send', async ({ page }) => {
  await draft(page, fx.create, { vendor: 'Bluewave Garment Washers', rate: 4.5 }); // 4,900 × ₹4.50 stays under the flow's ₹1,00,000
  await expect(page.getByText('All lines within balance · ready to submit')).toBeVisible();
  await expect(page.locator('#gpo-requirements')).toContainText(fx.create.requirementNo);

  await page.getByRole('button', { name: 'Save Draft' }).click();
  await expect(page.getByRole('heading', { name: /GPPO\/\d{2}-\d{2}\/\d+/ })).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible();
  await page.getByRole('button', { name: 'Send to Vendor' }).click();
  await expect(page.getByText('Sent to the vendor')).toBeVisible();
});

test('An excess over the balance blocks Submit until approved (AC-06)', async ({ page }) => {
  await draft(page, fx.excess, { vendor: 'Colourtex Dye House', rate: 3 });
  await page.getByRole('spinbutton', { name: 'PO qty Heather Grey S' }).fill('204'); // required 200; 3% allows 6
  await expect(page.getByText('Exceeds balance by 4 pcs')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit for Approval' })).toBeDisabled();
  await page.getByRole('button', { name: 'Request excess override' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('At most 3%');
  const dropdown = await openDropdown(page, dialog.getByRole('combobox', { name: 'Reason' }));
  await dropdown.locator('.ant-select-item-option').filter({ hasText: 'Process wastage' }).click();
  await dialog.getByRole('textbox', { name: 'Justification' }).fill('Dye-house shrinkage losses on light shades.');
  await dialog.getByRole('button', { name: 'Request override' }).click();
  await expect(page.getByText(/Excess requested/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Authorise' }).click(); // a superuser may approve their own request — logged
  await expect(page.getByText('Excess approved').first()).toBeVisible();
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();
});

test("A vendor short of the PO's process warns; the approver signs it off in the engine's Approve dialog (§13)", async ({ page }) => {
  await draft(page, fx.signOff, { vendor: 'Colourtex Dye House', rate: 25 }); // does no Bleach Washing; 4,900 × ₹25 meets the flow
  await expect(page.locator('#gpo-header')).toContainText('Does not do Bleach Washing');
  await page.getByRole('button', { name: 'Submit for Approval' }).click();
  await expect(page.getByText(/Submitted for approval/)).toBeVisible();

  const card = approvalCard(page);
  await expect(card).toContainText('Approval level 1 of 1');
  await card.getByRole('button', { name: /Approve/ }).click();
  let dialog = page.locator('.ant-modal').last();
  await expect(dialog).toContainText('Colourtex Dye House');
  await dialog.getByRole('button', { name: /Approve$/ }).click(); // without the sign-off: refused
  await expect(page.getByText(/sign off the vendor/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toHaveCount(0);

  dialog = page.locator('.ant-modal').last();
  await dialog.getByRole('checkbox', { name: /I sign off this vendor/ }).check();
  await dialog.getByRole('button', { name: /Approve$/ }).click();
  await expect(page.getByRole('button', { name: 'Send to Vendor' })).toBeVisible(); // reloaded: Approved
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText('vendor signed off');
});

test('Amend delivery on a sent PO is audited; the print carries no internal quantities', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/${fx.sent.id}`);
  await waitForPageReady(page);
  await page.getByRole('button', { name: 'Amend delivery / instructions' }).click();
  const dialog = page.getByRole('dialog');
  await setDate(page, 'amend-expectedReturnDate', plusDays(20));
  await dialog.locator('#amend-reason').fill('Wash house asked for four more days.');
  await dialog.getByRole('button', { name: 'Save amendment' }).click();
  await expect(page.getByText('Delivery / instructions amended')).toBeVisible();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.ant-drawer-open')).toContainText('Expected delivery date: ');
  await expect(page.locator('.ant-drawer-open')).toContainText(plusDays(20));
  await page.keyboard.press('Escape');

  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Print', exact: true }).click()]);
  await popup.waitForLoadState();
  const html = await popup.content();
  expect(html).toContain(fx.sent.poNo);
  expect(html).toContain('Grand total');
  expect(html).not.toMatch(/Previously|Balance|Required qty/i);
  await popup.close();
});

test('The list opens on the open POs and pages on the server', async ({ page }) => {
  await navigateWithAuth(page, `${BASE}/list`);
  await expect(page.locator('.ant-layout-sider .ant-menu-item-selected')).toContainText('Garment Process PO');
  await expect(page.locator('.ant-table-row').filter({ hasText: fx.sent.poNo })).toBeVisible();
});
