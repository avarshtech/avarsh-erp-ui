/**
 * A packing list's lifecycle on the server, driven through the screens where the user acts; REST only
 * sets up (entries, shipment, the buyer's plan, the warnings no step is about) and cleans up.
 *
 * Next PLC's ORD/0003 (e2e seed V111) carries two POs to Leicester DC. No other export-docs spec packs
 * it, so the approval flow configured here, conditioned on Next PLC, reaches no other spec's lists.
 *  1. Cartons on the buyer's plan but not packed (V-17) block Submit until the range is marked Not
 *     shipping; a shipment PO with no cartons (V-21) is acknowledged; with no flow, Submit makes it final.
 *  2. Released, it closes its shipment; revised with a reason, its two revisions compare.
 *  3. With a flow on the buyer, Submit sends the revision for approval: pending, edits refused, listed
 *     under Pending approval; the approver's decision makes it final.
 *  4. Referred back by the approver, a draft says who sent it back, when and why.
 *  5. A submission withdrawn is a draft again.
 *  6. Carton Packing names the list holding an entry, and the server refuses to delete the entry.
 *
 *   E2E_BASE_URL=http://localhost:3001 E2E_PASSWORD=admin123 \
 *     npx playwright test e2e/specs/export-docs/packing-list-lifecycle.spec.js --project=export-docs
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { findPendingRequest, actOnRequest } from '../../helpers/approval.js';
import {
  deleteShipmentDocuments, getPackingList, packingListCommand, raisePackingList,
} from '../../helpers/export-documents-api.js';
import { createEntry, orderIdOf, purgeMarked, range } from '../../helpers/packing-api.js';
import {
  goTo, settle, pickOption, expectToast, button, confirmModal,
} from '../sample-requests/helpers.js';

const SHIPMENTS = '/export-docs/shipments';
const PL = '/export-docs/packing-lists';
const BUYER = 'Next PLC';
const PO_A = 'NX-PO-2026-050';
const PO_B = 'NX-PO-2026-051';
const DEST = 'Leicester DC';
const SIZES = ['S', 'M', 'L', 'XL'];
const FLOW_NAME = 'E2E packing-list lifecycle';
const STAMP = '\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}';
const REFERRED = 'E2E: recheck the carton weights before it goes.';

let api;
let orderId;
let buyer;
const shipments = [];
/** What the tests hand on: the shipment, the first entry, the list and its revision. */
const ctx = {};

const ok = (res, what) => {
  if (res.status >= 300) throw new Error(`${what} → ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
};

/** Cartons of one PO and colour, ten pieces of M each, as Carton Packing keys them. */
const ctn = (from, to, po, colorName) => range({ cartonFrom: from, cartonTo: to, buyerPoNo: po, destination: DEST, colorName });

/** A row of the buyer's plan for PO A: what the cartons hold, numbered as the buyer numbers them. */
const planned = (from, to) => ({
  sectionKey: 'MAIN', packingType: 'SOLID', cartonFrom: from, cartonTo: to, buyerPoNo: PO_A, destination: DEST,
  colorName: 'Heather Grey', sizeQty: { M: 10 }, netWeightKg: 10, grossWeightKg: 11, lengthCm: 60, breadthCm: 40, heightCm: 35,
});

const portId = async (code) => (await api.get('/ports', { search: code, kinds: 'SEA' })).data.find((p) => p.code === code).id;

/** An OPEN shipment of ORD/0003 sending both its POs, made through the API. */
const nextShipment = async () => {
  const res = await api.post(SHIPMENTS, {
    buyerId: buyer.id,
    notifyParty: { kind: 'LOCATION', locationId: buyer.shippingLocations.find((l) => l.label === 'Doncaster DC').id },
    orderIds: [orderId],
    orderPos: [{ orderId, pos: [PO_A, PO_B].map((buyerPoNo) => ({ buyerPoNo, destination: DEST })) }],
    mode: 'SEA', incoterm: 'FOB', preCarriageBy: 'ROAD', placeOfReceipt: 'Tiruppur', vesselFlightNo: 'MSC ANNA V.241E',
    portOfLoadingId: await portId('INMAA1'), portOfDischargeId: await portId('GBFXT'),
    finalDestination: 'Leicester, United Kingdom', countryOfFinalDestination: 'United Kingdom', etd: '2026-12-01', eta: '2026-12-27',
    forwarder: 'Kuehne + Nagel', containerNos: ['HLXU7654321'],
  });
  expect(res.status, JSON.stringify(res.data)).toBe(201);
  shipments.push(res.data.id);
  return res.data;
};

/** Acknowledges through the API every open warning but the codes a test acknowledges on screen. */
const acknowledgeAll = async (list, except = []) => {
  let pl = list;
  for (let round = 0; round < 5; round += 1) {
    const open = pl.panelFindings.findings.filter((f) => f.acknowledgeable && !f.acknowledged && !except.includes(f.code));
    if (!open.length) break;
    for (const f of open) {
      pl = await packingListCommand(api, pl.id, 'ack', {
        version: pl.version, code: f.code, targetKey: f.targetKey, reason: 'E2E: accepted for the lifecycle check',
      });
    }
  }
  return pl;
};

/** A list of the shipment taking this entry's cartons, its warnings acknowledged, submitted through the API. */
const submittedList = async (entryId) => {
  const pl = await acknowledgeAll(await raisePackingList(api, ctx.shipment.id, [entryId]));
  return packingListCommand(api, pl.id, 'submit', { version: pl.version });
};

/** Deactivates this spec's flows (not deleted: their requests keep pointing at them), a stopped run's too. */
const retireFlows = async () => {
  const { status, data } = await api.get('/approval-flows');
  if (status !== 200) return;
  const ours = (data || []).filter((f) => f.entityType === 'EXPORT_PACKING_LIST' && f.active && String(f.name).startsWith(FLOW_NAME));
  for (const f of ours) await api.patch(`/approval-flows/${f.id}/toggle`);
};

/** The approver's decision on the list's waiting request. */
const decide = async (plId, action, comments) => {
  const request = await findPendingRequest(api, 'EXPORT_PACKING_LIST', plId);
  expect(request, `packing list ${plId} waits in the approval engine`).toBeTruthy();
  await actOnRequest(api, request.id, action, comments);
};

const header = (page) => page.locator('.page-header');
const statusOf = (page) => header(page).locator('.status-badge-group');

const openList = async (page, plId, plNo) => {
  await goTo(page, `${PL}/edit/${plId}`);
  await expect(header(page)).toContainText(plNo, { timeout: 30000 });
};

/** Fills a reason dialog and confirms it. */
const giveReason = async (page, title, reason, okText) => {
  const dialog = page.getByRole('dialog', { name: title });
  await dialog.locator('textarea').fill(reason);
  await dialog.getByRole('button', { name: okText }).click();
};

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  orderId = await orderIdOf(api, 'ORD/0003');
  const { data } = await api.get('/buyers');
  buyer = (Array.isArray(data) ? data : data.content).find((b) => b.name === BUYER);
  // A run that stopped half-way leaves its flow on and its entries on lists
  await retireFlows();
  await purgeMarked(api, orderId);
});

test.afterAll(async () => {
  await retireFlows();
  // A final or released list is cancelled and stays on record, so its shipment stays too
  await deleteShipmentDocuments(api, shipments);
  await purgeMarked(api, orderId);
  for (const id of shipments) {
    const { status, data } = await api.get(`${SHIPMENTS}/${id}`);
    if (status === 200) await api.delete(`${SHIPMENTS}/${id}?version=${data.version}`);
  }
  await api?.dispose();
});

test.describe.configure({ mode: 'serial', timeout: 240000 });

test.describe('Packing list lifecycle', () => {
  test('a plan with cartons not packed blocks Submit until marked Not shipping; acknowledged, it is final at once', async ({ page }) => {
    ctx.shipment = await nextShipment();
    ctx.entry = await createEntry(api, { orderId, sizes: SIZES, groups: [ctn(1, 10, PO_A, 'Heather Grey')] });
    const raised = await raisePackingList(api, ctx.shipment.id, [ctx.entry.id]);
    // The buyer's plan numbers PO A's cartons 1–12; only 1–10 are packed
    const withPlan = ok(await api.put(`${PL}/${raised.id}/plans/${orderId}`, {
      version: raised.version, rows: [planned(1, 10), planned(11, 12)],
    }), 'save the plan');
    ctx.pl = await acknowledgeAll(withPlan, ['V-21']);
    expect(ctx.pl.panelFindings.blocking.map((f) => f.code).sort()).toEqual(['V-17', 'V-21']);

    await openList(page, ctx.pl.id, ctx.pl.plNo);
    await expect(page.getByText(/Cartons 11–12 of PO NX-PO-2026-050 \(ORD\/0003\) are on the buyer's plan but not packed/).first())
      .toBeVisible();
    await expect(button(header(page), 'Submit')).toBeDisabled();

    // The two cartons go short: the plan keeps them, marked Not shipping with a reason
    await page.getByRole('button', { name: 'Not shipping', exact: true }).click();
    await giveReason(page, 'Not shipping these planned cartons', 'E2E: the buyer takes two cartons fewer.', 'Mark not shipping');
    await expectToast(page, 'Marked not shipping');
    await expect(page.getByText(/are on the buyer's plan but not packed/)).toHaveCount(0);
    // PO B has no cartons on any list yet: still blocking until someone says why
    await expect(button(header(page), 'Submit')).toBeDisabled();

    await page.getByRole('button', { name: 'Acknowledge', exact: true }).click();
    await giveReason(page, 'Acknowledge V-21', 'E2E: PO 051 follows on the next vessel.', 'Acknowledge');
    await expectToast(page, 'Reason recorded against this document');

    // No approval flow applies: Submit finalises it at once
    await expect(button(header(page), 'Submit')).toBeEnabled();
    await button(header(page), 'Submit').click();
    await expect(page.getByText('It is finalised now, or sent for approval when an approval flow applies to it.')).toBeVisible();
    await confirmModal(page, 'Submit');
    await expectToast(page, `${ctx.pl.plNo} finalised`);
    await expect(statusOf(page)).toContainText('Final');
    expect((await getPackingList(api, ctx.pl.id)).status).toBe('FINAL');
  });

  test('released, the list closes its shipment; revised with a reason, its two revisions compare', async ({ page }) => {
    await openList(page, ctx.pl.id, ctx.pl.plNo);
    await button(header(page), 'Mark released').click();
    await expectToast(page, 'Documents released');
    await expect(statusOf(page)).toContainText('Released');

    await goTo(page, `${SHIPMENTS}/edit/${ctx.shipment.id}`);
    await expect(page.getByText('Closed: every packing list and invoice on this shipment is released')).toBeVisible({ timeout: 30000 });

    await openList(page, ctx.pl.id, ctx.pl.plNo);
    await button(header(page), 'Revise').click();
    await giveReason(page, 'Revise this packing list', 'E2E: the buyer moved the shipment to a later vessel.', 'Create revision');
    await expectToast(page, 'Revision created');
    await expect(page).not.toHaveURL(new RegExp(`/edit/${ctx.pl.id}$`), { timeout: 20000 });
    await expect(statusOf(page)).toContainText('R1', { timeout: 30000 });
    ctx.r1 = await getPackingList(api, Number(page.url().match(/edit\/(\d+)/)[1]));
    expect(ctx.r1.revision).toBe(1);
    expect(ctx.r1.status).toBe('DRAFT');

    // The revision before this one against this one: R0 (superseded) and R1 (the new draft)
    await button(page, 'Compare revisions').click();
    const compare = page.getByRole('dialog', { name: /Compare revisions/ });
    await expect(compare).toContainText('R0 — superseded', { timeout: 20000 });
    await expect(compare).toContainText('R1 — draft');
    await expect(compare).toContainText(/These two revisions are identical|What changed/, { timeout: 20000 });
    await compare.getByRole('button', { name: 'Close' }).click();
  });

  test('with an approval flow on the buyer, Submit waits for approval with edits refused; the approver makes it final', async ({ page }) => {
    // A revision starts with no acknowledgement: given again through the API
    ctx.r1 = await acknowledgeAll(await getPackingList(api, ctx.r1.id));
    expect(ctx.r1.canFinalise).toBe(true);
    const { data: roles } = await api.get('/roles');
    ok(await api.post('/approval-flows', {
      name: `${FLOW_NAME} ${Date.now()}`, entityType: 'EXPORT_PACKING_LIST', active: true, priority: 60,
      levels: [{
        levelNumber: 1, levelName: 'Export head', approverType: 'ROLE', allowReferBack: true, allowReject: true,
        approverRoleId: (Array.isArray(roles) ? roles : roles.content).find((r) => r.name === 'Super Admin').id,
      }],
      conditions: [{ field: 'buyerId', operator: 'EQ', value: String(buyer.id) }],
    }), 'create the packing-list flow');

    await openList(page, ctx.r1.id, ctx.r1.plNo);
    await button(header(page), 'Submit').click();
    await confirmModal(page, 'Submit');
    await expectToast(page, `${ctx.r1.plNo} sent for approval`);
    await expect(statusOf(page)).toContainText('Pending approval');
    const waiting = page.getByRole('alert').filter({ hasText: 'Waiting for approval since' });
    await expect(waiting).toContainText(new RegExp(`Waiting for approval since ${STAMP} — edits are locked\\.`));
    await expect(waiting.getByRole('button', { name: /Withdraw/ })).toBeVisible();
    await expect(button(header(page), 'Submit')).toHaveCount(0);
    await expect(button(page, 'Save details')).toHaveCount(0);

    // The server refuses an edit while it waits
    const pending = await getPackingList(api, ctx.r1.id);
    const refused = await api.put(`${PL}/${pending.id}`, { version: pending.version, plDate: pending.plDate, remarks: 'E2E: an edit while pending' });
    expect(refused.status).toBe(409);
    expect(refused.data.message).toBe(`${ctx.r1.plNo} is waiting for approval, so it cannot be changed. Withdraw the submission first.`);

    // The register's status filter finds it
    await goTo(page, `${PL}/list`);
    await pickOption(page, page.locator('.ant-select').filter({ hasText: 'Status' }).first(), 'Pending approval');
    await settle(page);
    const row = page.locator('.ant-table-row').filter({ hasText: ctx.r1.plNo });
    await expect(row).toContainText('Pending approval', { timeout: 20000 });

    await decide(ctx.r1.id, 'APPROVE', 'E2E: approved for the vessel.');
    await openList(page, ctx.r1.id, ctx.r1.plNo);
    await expect(statusOf(page)).toContainText('Final');
    await expect(page.getByText(new RegExp(`^Submitted for approval by .+ on ${STAMP}$`))).toBeVisible();
    await expect(page.getByText(new RegExp(`^Approved by .+ on ${STAMP}$`))).toBeVisible();
    expect((await getPackingList(api, ctx.r1.id)).status).toBe('FINAL');
  });

  test('referred back by the approver, the draft says who sent it back, when and why', async ({ page }) => {
    const entry = await createEntry(api, { orderId, sizes: SIZES, groups: [ctn(1, 6, PO_B, 'Midnight Navy')] });
    const pl = await submittedList(entry.id);
    expect(pl.status).toBe('PENDING_APPROVAL');
    await decide(pl.id, 'REFER_BACK', REFERRED);

    await openList(page, pl.id, pl.plNo);
    await expect(statusOf(page)).toContainText('Draft');
    await expect(page.getByRole('alert').filter({ hasText: 'Referred back by' }))
      .toContainText(new RegExp(`Referred back by .+ on ${STAMP}: ${REFERRED}`));
    await expect(button(header(page), 'Submit')).toBeVisible();
  });

  test('a submission withdrawn is a draft again', async ({ page }) => {
    const entry = await createEntry(api, { orderId, sizes: SIZES, groups: [ctn(1, 4, PO_B, 'Cream')] });
    const pl = await submittedList(entry.id);
    expect(pl.status).toBe('PENDING_APPROVAL');

    await openList(page, pl.id, pl.plNo);
    await page.getByRole('alert').filter({ hasText: 'Waiting for approval since' }).getByRole('button', { name: /Withdraw/ }).click();
    await confirmModal(page, 'Withdraw');
    await expectToast(page, 'Submission withdrawn');
    await expect(statusOf(page)).toContainText('Draft');
    await expect(page.getByRole('alert').filter({ hasText: 'Withdrawn by' })).toContainText(new RegExp(`Withdrawn by .+ on ${STAMP}`));
    expect(await findPendingRequest(api, 'EXPORT_PACKING_LIST', pl.id)).toBeNull();
  });

  test('Carton Packing names the list holding an entry, and the server refuses to delete it', async ({ page }) => {
    // The register lists the latest packing first, so today's entries are on its first page. (Not found
    // through its search box, which sends the input's change event rather than the text: a defect of
    // that screen since 2026-09-02, reported separately.)
    await goTo(page, '/production/packing/list');
    const row = page.locator('.ant-table-row').filter({ hasText: ctx.entry.packingNo });
    await expect(row).toContainText(`${ctx.r1.plNo} · PO ${PO_A}`, { timeout: 20000 });

    await row.getByRole('button', { name: 'delete' }).click();
    const confirm = page.locator('.ant-popconfirm');
    await expect(confirm).toContainText(`It is on ${ctx.r1.plNo} · PO ${PO_A}`);
    await confirm.getByRole('button', { name: 'Delete' }).click();
    await expectToast(page, `${ctx.entry.packingNo} is on packing list ${ctx.r1.plNo}. Take it off the list first.`);
    expect((await api.get(`/packing/entries/${ctx.entry.id}`)).status).toBe(200);
  });
});
