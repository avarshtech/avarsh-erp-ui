/**
 * Cutting › External Process — panels sent out against an approved Cut Panel PO, received back and checked.
 *
 * beforeAll makes, through the API (e2e/helpers/job-work-api.js): a submitted Cut Panel Requirement on ORD/0002
 * (Camel Sleeve (Left), Panel Printing, S–XL) with an approved Cut Panel PO on all of it (Annai Panel Printers),
 * an approved IN-HOUSE cutting PO cutting Camel, and an approved OUTSOURCED one.
 *
 * What this tests:
 *   - An in-house Cut PO issues against the approved Cut Panel PO (D4): the PO's process, job worker, dates and
 *     instructions read-only; its lines in the cut's colour with what each has left; the first DC sends the PO (D5)
 *   - Receive from Vendor takes good and rejected panels and the vendor's DC no.; both close the PO line (D6)
 *   - An outsourced Cut PO keeps the free-text issue (process picker, Add Panel)
 *   - A Panel Check on the issue saves (its date is checkDate, D8)
 */

import { test, expect } from '@playwright/test';
import { ensureSessionActive, navigateWithAuth, waitForPageReady } from '../../helpers/navigation.js';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { submittedCpr, cutPanelPo, approvedCuttingPo, getCutPanelPo, VENDOR } from '../../helpers/job-work-api.js';

const SIZES = { S: 150, M: 300, L: 300, XL: 150 }; // ORD/0002 Camel

async function pick(page, name, text) {
  // The select's wrapper takes the click: antd's search input is not itself visible
  const box = page.getByRole('combobox', { name }).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]');
  await box.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await box.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.waitFor({ state: 'visible' });
  await page.keyboard.type(text);
  await dropdown.locator('.ant-select-item-option').filter({ hasText: text }).first().click();
  await dropdown.waitFor({ state: 'hidden' }).catch(() => {});
}

async function openTab(page) {
  await navigateWithAuth(page, '/production/cutting?tab=external');
  await waitForPageReady(page);
}

const fx = {};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const api = await createAuthenticatedClient();
  try {
    fx.cpr = await submittedCpr(api, { orderNo: 'ORD/0002', colour: 'Camel', panel: 'Sleeve (Left)' });
    fx.cpp = await cutPanelPo(api, fx.cpr);
    const rows = Object.entries(SIZES).map(([size, qty]) => ({ color: 'Camel', size, qty }));
    fx.inHouse = await approvedCuttingPo(api, { orderNo: 'ORD/0002', rows });
    fx.outsourced = await approvedCuttingPo(api, { orderNo: 'ORD/0002', rows, unitType: 'VENDOR' });
  } finally {
    await api.dispose();
  }
});

test.beforeEach(async ({ page }) => {
  test.setTimeout(120000);
  await ensureSessionActive(page);
  page.on('pageerror', (err) => console.log(`[browser:pageerror] ${err.message}`));
});

test('An in-house Cut PO issues against the approved Cut Panel PO; the first DC sends it', async ({ page }) => {
  await openTab(page);
  await page.getByRole('button', { name: /Issue to Other Vendor/ }).click();
  const drawer = page.locator('.ant-drawer-open');
  await pick(page, 'Cut PO', fx.inHouse.cuttingPoNo);
  await expect(drawer.getByText('In-house — against a Cut Panel PO')).toBeVisible();

  await pick(page, 'Cut Panel PO', fx.cpp.poNo);
  await expect(drawer).toContainText(VENDOR.printers); // read-only, from the PO
  await expect(drawer).toContainText('Print to the approved strike-off');
  await expect(drawer.getByRole('combobox', { name: 'Process', exact: true })).toBeDisabled();
  await expect(drawer.locator('.ant-table-row')).toHaveCount(4); // Camel Sleeve (Left) S–XL
  await drawer.getByRole('button', { name: 'Fill balance' }).click();
  await expect(drawer).toContainText('Total: 900 pcs');

  await drawer.getByRole('button', { name: /Save & Print DC/ }).click();
  await expect(page.getByText(/issued to Panel Printing — DC ready to print/)).toBeVisible();

  const api = await createAuthenticatedClient();
  try {
    const po = await getCutPanelPo(api, fx.cpp.id);
    expect(po.status).toBe('SENT_TO_VENDOR');
    expect(po.lines.reduce((s, l) => s + Number(l.issuedQty), 0)).toBe(900);
  } finally {
    await api.dispose();
  }
  await expect(page.locator('.ant-table-row').filter({ hasText: fx.cpp.poNo })).toContainText(VENDOR.printers);
});

test('Receive from Vendor: good and rejected panels and the vendor DC close the PO lines', async ({ page }) => {
  await openTab(page);
  await page.getByRole('button', { name: /Receive from Vendor/ }).first().click();
  const drawer = page.locator('.ant-drawer-open');
  await pick(page, 'Panel issue', fx.cpp.poNo);
  await expect(drawer.locator('.ant-table-row')).toHaveCount(4);
  await drawer.getByRole('textbox', { name: 'Vendor DC No.' }).fill('APP-DC-77');
  const rows = drawer.locator('.ant-table-row');
  for (let i = 0; i < 4; i += 1) {
    const out = Number((await rows.nth(i).locator('td').nth(3).innerText()).replace(/,/g, ''));
    await rows.nth(i).locator('input[name^="good-"]').fill(String(i === 0 ? out - 2 : out));
    if (i === 0) await rows.nth(i).locator('input[name^="rejected-"]').fill('2');
  }
  await drawer.getByRole('button', { name: /Save & Print Receipt/ }).click();
  await expect(page.getByText(/saved — returned panels go to Panel Check/)).toBeVisible();

  const api = await createAuthenticatedClient();
  try {
    const po = await getCutPanelPo(api, fx.cpp.id);
    expect(po.status).toBe('COMPLETED');
    expect(po.lines.reduce((s, l) => s + Number(l.rejectedQty), 0)).toBe(2);
  } finally {
    await api.dispose();
  }
});

test('A Panel Check on the returned panels saves', async ({ page }) => {
  await navigateWithAuth(page, '/production/cutting/panel-check/new');
  await waitForPageReady(page);
  const select = page.getByText('Panel Issue (external process PO)').locator('..').locator('.ant-select');
  await select.click();
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)').last();
  await dropdown.locator('.ant-select-item-option').filter({ hasText: 'Panel Printing' }).last().click();
  await expect(page.locator('.ant-table-row').first()).toBeVisible();
  await page.getByRole('button', { name: /Save Check/ }).click();
  await expect(page.getByText(/Panel check saved as/)).toBeVisible();
});

test('An outsourced Cut PO keeps the free-text issue', async ({ page }) => {
  await openTab(page);
  await page.getByRole('button', { name: /Issue to Other Vendor/ }).click();
  const drawer = page.locator('.ant-drawer-open');
  await pick(page, 'Cut PO', fx.outsourced.cuttingPoNo);
  await expect(drawer.getByText('Outsourced unit')).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Add Panel/ })).toBeVisible();
  await expect(drawer.getByRole('combobox', { name: 'Cut Panel PO' })).toHaveCount(0);
});
