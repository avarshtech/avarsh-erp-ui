/**
 * Production flow 07 — finishing, on the parts that run on the API: the flow order's Finishing PO is
 * generated in-house from the approved Work Order and submitted; finishing receives the garments sewing
 * issued (which acknowledges the sewing issue); and under External Process the garments go out for
 * washing against an approved Garment Process PO, come back, and pass a garment check.
 *
 * The other Finishing tabs (hourly stations, spot wash, checking, alterations, metal detection, shade,
 * AQL) still run on the in-browser mock, so they are not part of the flow.
 */
import { test, expect } from '../../fixtures.js';
import { findFlowOrder } from '../../helpers/production-flow-seed.js';
import { submittedGpr, garmentProcessPo, getGarmentProcessPo } from '../../helpers/job-work-api.js';
import { waitForPageReady } from '../../helpers/navigation.js';
import { pickToday, submitAnywayIfAsked, expectSuccessToast } from '../production-po/helpers.js';
import { activePane, captioned, choose, chooseCaptioned, chooseLabelled, openDrawer, responseOf, successToast } from './helpers.js';

test.describe.configure({ mode: 'serial' });

const ctx = {};

test.describe('Production flow — finishing', () => {
  test.beforeAll(async ({ api }) => {
    ctx.order = await findFlowOrder(api);
    const { data: wos } = await api.get(`/work-order/approved?orderId=${ctx.order.id}`);
    expect(wos, 'run 04 first: the flow order needs an approved Work Order').toHaveLength(1);
    ctx.workOrder = wos[0];
  });

  test('Finishing PO: generated in-house from the approved Work Order and submitted', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/purchase-orders/finishing-po/new');
    await waitForPageReady(authedPage);
    await chooseLabelled(authedPage, 'Confirmed Order', ctx.order.orderNo);
    await chooseLabelled(authedPage, 'Approved Work Order', ctx.workOrder.workOrderNo);
    await pickToday(authedPage, 'Planned Start');
    await pickToday(authedPage, 'Planned End');
    await authedPage.getByRole('button', { name: /^Next$/ }).click();
    // Every process stays in-house: one Finishing PO
    await authedPage.getByRole('button', { name: /^Next$/ }).click();
    await expect(authedPage.getByText(/1 Finishing PO will be created/i)).toBeVisible({ timeout: 10000 });
    await authedPage.locator('input[name^="rate-"]').fill('3.5');
    await authedPage.getByRole('button', { name: /Confirm & Generate/i }).click();
    await expectSuccessToast(authedPage, /Finishing PO\(s\) created/i);

    const { data: generated } = await api.get(`/finishing-po/by-order/${ctx.order.id}`);
    const list = Array.isArray(generated) ? generated : generated.pos || generated.content || [];
    expect(list).toHaveLength(1);
    const fpo = list[0];
    expect(fpo.status).toBe('DRAFT');

    await authedPage.goto(`/purchase-orders/finishing-po/edit/${fpo.id}`);
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: /Save & Submit/i }).click();
    await submitAnywayIfAsked(authedPage);
    await expectSuccessToast(authedPage, /submitted/i);
    const { data: submitted } = await api.get(`/finishing-po/${fpo.id}`);
    expect(submitted.status).toBe('APPROVED');
    expect(consoleGuard).toEqual([]);
  });

  test('Receiving: finishing takes in what sewing issued, and the sewing issue is acknowledged', async ({ api, authedPage, consoleGuard }) => {
    const { data: issues } = await api.get('/sewing/garment-issues', { orderId: ctx.order.id });
    const issue = (issues.content || issues).find((i) => i.orderId === ctx.order.id && i.status === 'ISSUED');
    expect(issue, 'run 06 first: sewing must have issued garments').toBeTruthy();

    await authedPage.goto('/production/finishing?tab=receiving');
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: /Receive from Sewing/ }).click();
    const drawer = openDrawer(authedPage);
    await chooseCaptioned(authedPage, 'Order', ctx.order.orderNo, drawer);
    await chooseCaptioned(authedPage, 'Issue # (from Sewing)', issue.issueNo, drawer);
    const rows = drawer.locator('.ant-table-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const remaining = Number((await rows.nth(i).locator('td').nth(3).innerText()).trim());
      await rows.nth(i).locator('.ant-input-number input').fill(String(remaining));
    }
    await responseOf(authedPage, 'PUT', new RegExp(`/sewing/garment-issues/${issue.id}/receipt$`),
      () => drawer.getByRole('button', { name: /Record Receiving/ }).click());
    await successToast(authedPage, new RegExp(`sewing shows ${issue.totalQty} of ${issue.totalQty} received`));

    const { data: after } = await api.get('/sewing/garment-issues', { orderId: ctx.order.id });
    const acked = (after.content || after).find((i) => i.id === issue.id);
    expect(acked.status).toBe('ACKNOWLEDGED');
    expect(consoleGuard).toEqual([]);
  });

  test('External Process: garments go out for washing against the approved Garment Process PO', async ({ api, authedPage, consoleGuard }) => {
    ctx.gpr = await submittedGpr(api, { orderNo: ctx.order.orderNo, process: 'Garment Washing' });
    ctx.gpo = await garmentProcessPo(api, ctx.gpr, { cells: 2 });
    const total = ctx.gpo.lines.reduce((s, l) => s + Number(l.poQty), 0);

    await authedPage.goto('/production/finishing?tab=external-process');
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: /Issue Garments/ }).click();
    const drawer = openDrawer(authedPage);
    await choose(authedPage, drawer.locator('#workOrderId').locator('xpath=ancestor::div[contains(@class,"ant-select")][1]'), ctx.workOrder.workOrderNo);
    await expect(drawer.getByText('In-house — against a Garment Process PO')).toBeVisible();
    await choose(authedPage, drawer.getByRole('combobox', { name: 'Garment Process PO' }).locator('xpath=ancestor::div[contains(@class,"ant-select")][1]'), ctx.gpo.poNo);
    const inputs = drawer.locator('input[name^="issue-"]');
    await expect(inputs).toHaveCount(ctx.gpo.lines.length);
    for (let i = 0; i < ctx.gpo.lines.length; i++) await inputs.nth(i).fill(await inputs.nth(i).getAttribute('aria-valuemax'));
    await expect(drawer).toContainText(`Total: ${total} pcs`);
    const issue = await responseOf(authedPage, 'POST', /\/finishing\/process-issues$/,
      () => drawer.getByRole('button', { name: /^Issue$/ }).click());
    await successToast(authedPage, /issued to Garment Washing/);
    ctx.issue = issue;
    expect((await getGarmentProcessPo(api, ctx.gpo.id)).status).toBe('SENT_TO_VENDOR');
    expect(consoleGuard).toEqual([]);
  });

  test('External Process: the washed garments come back in full and the PO completes', async ({ api, authedPage, consoleGuard }) => {
    await authedPage.goto('/production/finishing?tab=external-process');
    await waitForPageReady(authedPage);
    await authedPage.getByRole('button', { name: `Receive ${ctx.issue.issueNo}` }).click();
    const drawer = openDrawer(authedPage);
    await drawer.getByLabel('Vendor DC #').fill(`KGW-DC-${Date.now().toString(36)}`);
    const inputs = drawer.locator('input[name^="received-"]');
    for (let i = 0; i < await inputs.count(); i++) await inputs.nth(i).fill(await inputs.nth(i).getAttribute('aria-valuemax'));
    await responseOf(authedPage, 'POST', /\/finishing\/process-returns$/, () => drawer.getByRole('button', { name: /^Receive$/ }).click());
    await successToast(authedPage, /received against/);

    expect((await getGarmentProcessPo(api, ctx.gpo.id)).status).toBe('COMPLETED');
    const { data: issue } = await api.get(`/finishing/process-issues/${ctx.issue.id}`);
    expect(issue.status).toBe('FULLY_RETURNED');
    expect(consoleGuard).toEqual([]);
  });

  test('Garment Check: every returned colour × size is verified OK and the check passes', async ({ authedPage, consoleGuard }) => {
    await authedPage.goto('/production/finishing/garment-check/new');
    await waitForPageReady(authedPage);
    await chooseCaptioned(authedPage, 'Process PO (garments sent out)', ctx.issue.issueNo);
    await captioned(authedPage, 'Correspondence / reference').locator('input').fill('Approved wash standard WS-01');
    const rows = authedPage.locator('.ant-table-row');
    await expect(rows).toHaveCount(ctx.gpo.lines.length, { timeout: 15000 });
    for (let i = 0; i < ctx.gpo.lines.length; i++) {
      const row = rows.nth(i);
      const issued = (await row.locator('td').nth(2).innerText()).trim();
      await row.locator('.ant-input-number input').fill(issued);
      await row.getByLabel('Verified').check();
      await choose(authedPage, row.locator('.ant-select', { hasText: 'Quality' }), 'OK');
      await choose(authedPage, row.locator('.ant-select', { hasText: 'Action' }), 'Accepted');
    }
    const check = await responseOf(authedPage, 'POST', /\/finishing\/garment-checks$/,
      () => authedPage.getByRole('button', { name: /Save Check/ }).click());
    await successToast(authedPage, /saved as passed/);
    expect(check.status).toBe('PASSED');
    await expect(activePane(authedPage)).toBeVisible();
    expect(consoleGuard).toEqual([]);
  });
});
