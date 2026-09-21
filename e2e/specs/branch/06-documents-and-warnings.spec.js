/**
 * Branch hierarchy — the documents that carry a GSTIN, the branch-routed
 * approval flow, the unit-scoped cutting tables, and the buyer-approval warning.
 *
 * GST registration is state-wise, so a purchase order names the branch it is
 * delivered to and a sample invoice the branch it exports from; both print that
 * branch's address and GSTIN. Buyers approve a facility, not a company, so work
 * sent to a unit off a buyer's list warns without ever blocking.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import { ensureBranch, ensureUnit, headOffice, eligibleOrder, branchHeader } from '../../helpers/branch-seed.js';

let api;
let ho;
let second;

// Paged lists answer with `content`; a report run answers with `rows`.
const rowsOf = (data) => (Array.isArray(data) ? data : data?.content || data?.rows || []);
const today = () => new Date().toISOString().slice(0, 10);

test.beforeAll(async () => {
  api = await createAuthenticatedClient();
  ho = await headOffice(api);
  second = await ensureBranch(api, {
    branchCode: 'E2E-TIR', branchName: 'E2E Tirupur', stateCode: '33',
    gstin: '33AABCT1234A1ZP', address: '12 Mill Road', city: 'Tirupur', state: 'Tamil Nadu', pincode: '641604',
  });
  // the GSTIN and address only matter once they are on the branch
  await api.put(`/branches/${second.id}`, {
    ...second, gstin: '33AABCT1234A1ZP', address: '12 Mill Road',
    city: 'Tirupur', state: 'Tamil Nadu', pincode: '641604',
  });
});

test.afterAll(async () => { await api?.dispose(); });

test.describe('Purchase orders deliver to a branch', () => {

  test('seeded purchase orders are delivered to the head office', async () => {
    const { data } = await api.get('/purchase-orders/search', { size: '100' }, branchHeader(ho.id));
    const list = rowsOf(data);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.deliveryBranchId === ho.id)).toBe(true);

    const { data: atSecond } = await api.get('/purchase-orders/search', { size: '100' }, branchHeader(second.id));
    expect(rowsOf(atSecond)).toHaveLength(0);
  });

  test('a PO delivered to a branch carries that branch\'s ship-to block', async () => {
    const { data: drafts } = await api.get('/purchase-orders/search', { size: '100', status: 'Draft' });
    const candidate = rowsOf(drafts)[0];
    test.skip(!candidate, 'no draft purchase order in the seed');

    const { data: full } = await api.get(`/purchase-orders/${candidate.id}`);
    const { data: moved, status } = await api.put(`/purchase-orders/${candidate.id}`, { ...full, deliveryBranchId: second.id });
    expect(status).toBe(200);
    expect(moved.deliveryBranchId).toBe(second.id);
    expect(moved.deliveryBranchName).toBe('E2E Tirupur');
    expect(moved.deliveryBranchGstin).toBe('33AABCT1234A1ZP');
    expect(moved.deliveryBranchAddress).toMatch(/Mill Road/);

    // an edit that says nothing about the branch leaves the PO where it is
    const { data: again } = await api.put(`/purchase-orders/${candidate.id}`, { ...moved, deliveryBranchId: null });
    expect(again.deliveryBranchId).toBe(second.id);
  });
});

test.describe('Sample invoices export from a branch', () => {
  const base = {
    invoiceType: 'SAMPLE', consigneeName: 'E2E Buyer', consigneeAddress: 'Somewhere',
    destinationCountry: 'Germany', countryOfOrigin: 'India', currency: 'USD', lines: [], srIds: [],
  };

  test('an invoice with a branch carries its exporter block; one without prints the company profile', async () => {
    const { data: withBranch, status } = await api.post('/sample-invoices', { ...base, invoiceDate: today(), branchId: second.id });
    expect(status).toBeLessThan(300);
    expect(withBranch.branchId).toBe(second.id);
    expect(withBranch.branchGstin).toBe('33AABCT1234A1ZP');
    expect(withBranch.branchAddress).toMatch(/Tirupur/);

    const { data: none } = await api.post('/sample-invoices', { ...base, invoiceDate: today(), consigneeName: 'E2E Buyer HO' });
    expect(none.branchId).toBeFalsy();
  });

  test('an unknown branch is refused', async () => {
    const { status } = await api.post('/sample-invoices', { ...base, invoiceDate: today(), branchId: 999999 });
    expect(status).toBe(400);
  });

  test('the invoice list follows the working branch, and the company-profile ones read as head office', async () => {
    const { data: atSecond } = await api.get('/sample-invoices', { size: '100' }, branchHeader(second.id));
    const { data: atHo } = await api.get('/sample-invoices', { size: '100' }, branchHeader(ho.id));
    expect(rowsOf(atSecond).every((i) => i.branchId === second.id)).toBe(true);
    expect(rowsOf(atHo).every((i) => i.branchId == null || i.branchId === ho.id)).toBe(true);
  });
});

test.describe('Cutting tables sit on a unit\'s floor', () => {

  test('a unit is offered its own tables and the shared ones', async () => {
    const unitA = await ensureUnit(api, ho.id, { unitCode: 'E2E-TBLA', unitName: 'E2E Table Unit A' });
    const unitB = await ensureUnit(api, ho.id, { unitCode: 'E2E-TBLB', unitName: 'E2E Table Unit B' });
    const stamp = Date.now().toString().slice(-5);

    const { data: own } = await api.post('/cutting-tables', { name: `E2E A ${stamp}`, unitId: unitA.id });
    const { data: shared } = await api.post('/cutting-tables', { name: `E2E Shared ${stamp}` });
    const { data: other } = await api.post('/cutting-tables', { name: `E2E B ${stamp}`, unitId: unitB.id });
    expect(own.unitId).toBe(unitA.id);
    expect(own.unitName).toBe('E2E Table Unit A');
    expect(shared.unitId).toBeFalsy();

    const names = (list) => rowsOf(list).map((t) => t.name);
    const { data: forA } = await api.get('/cutting-tables/active', { unitId: String(unitA.id) });
    expect(names(forA)).toContain(own.name);
    expect(names(forA)).toContain(shared.name);
    expect(names(forA)).not.toContain(other.name);

    const { data: all } = await api.get('/cutting-tables/active');
    expect(names(all)).toEqual(expect.arrayContaining([own.name, shared.name, other.name]));
  });

  test('an unknown unit is refused', async () => {
    const { status } = await api.post('/cutting-tables', { name: `E2E Bad ${Date.now()}`, unitId: 999999 });
    expect(status).toBe(400);
  });
});

test.describe('Approval flows can route by branch', () => {

  test('a flow conditioned on a branch takes only that branch\'s purchase orders', async () => {
    const { data: me } = await api.get('/me/permissions');
    const { data: flow, status } = await api.post('/approval-flows', {
      name: `E2E branch route ${Date.now().toString().slice(-5)}`, entityType: 'PURCHASE_ORDER',
      active: true, priority: 100,
      conditions: [{ field: 'branchId', operator: 'EQ', value: second.id }],
      levels: [{ levelNumber: 1, levelName: 'Branch manager', approverType: 'ROLE', approverRoleId: me.roleId }],
    });
    expect(status).toBeLessThan(300);

    const { data: drafts } = await api.get('/purchase-orders/search', { size: '100', status: 'Draft' });
    const candidate = rowsOf(drafts)[0];
    test.skip(!candidate, 'no draft purchase order left to submit');

    const { data: full } = await api.get(`/purchase-orders/${candidate.id}`);
    await api.put(`/purchase-orders/${candidate.id}`, { ...full, deliveryBranchId: second.id, status: 'Pending_Approval' });

    const { data: requests } = await api.get(`/approval-requests/entity/PURCHASE_ORDER/${candidate.id}`);
    expect(rowsOf(requests).some((r) => r.approvalFlowId === flow.id)).toBe(true);

    // clean up: the flow would otherwise route every later branch PO in the suite
    await api.put(`/approval-flows/${flow.id}`, { ...flow, active: false });
  });
});

test.describe('Buyer-approved units warn, never block', () => {

  test('work at a unit off the buyer\'s list saves with a warning', async () => {
    const order = await eligibleOrder(api);
    test.skip(!order, 'no CONFIRMED order with a BOM in the seed');
    const { data: orderRow } = await api.get(`/orders/${order.id}`);
    test.skip(!orderRow?.buyerId, 'the order has no buyer');

    const approved = await ensureUnit(api, ho.id, { unitCode: 'E2E-APPR', unitName: 'E2E Approved Unit' });
    const notApproved = await ensureUnit(api, ho.id, { unitCode: 'E2E-NOTAPPR', unitName: 'E2E Unapproved Unit' });

    const { data: buyer } = await api.get(`/buyers/${orderRow.buyerId}`);
    const { data: withList, status } = await api.put(`/buyers/${orderRow.buyerId}`, {
      ...buyer, approvedUnits: [{ unitId: approved.id, auditRef: 'SEDEX-E2E' }],
    });
    expect(status).toBe(200);
    expect(withList.approvedUnits).toHaveLength(1);

    // Keep the split exactly as it is and only name the unit on the head-office
    // row: a share that already carries a production PO cannot be dropped, and
    // this spec is about the warning, not about re-splitting.
    const { data: current } = await api.get(`/orders/${order.id}/allocations`);
    const withUnit = (unitId) => ({
      rows: current.rows.map((r) => ({
        branchId: r.branchId, qty: r.qty,
        unitId: r.branchId === ho.id ? unitId : r.unitId ?? null,
      })),
    });

    const { data: off, status: offStatus } = await api.put(`/orders/${order.id}/allocations`, withUnit(notApproved.id));
    expect(offStatus).toBe(200);               // saved
    expect(off.warnings).toHaveLength(1);      // and warned
    expect(off.warnings[0]).toMatch(/E2E Unapproved Unit/);

    const { data: on } = await api.put(`/orders/${order.id}/allocations`, withUnit(approved.id));
    expect(on.warnings || []).toHaveLength(0);

    // an expired approval warns too
    await api.put(`/buyers/${orderRow.buyerId}`, {
      ...withList, approvedUnits: [{ unitId: approved.id, validTill: '2020-01-01' }],
    });
    const { data: stale } = await api.put(`/orders/${order.id}/allocations`, withUnit(approved.id));
    expect(stale.warnings?.[0]).toMatch(/expired/i);

    // and a buyer who keeps no list never warns
    const { data: cleared } = await api.get(`/buyers/${orderRow.buyerId}`);
    await api.put(`/buyers/${orderRow.buyerId}`, { ...cleared, approvedUnits: [] });
    const { data: quiet } = await api.put(`/orders/${order.id}/allocations`, withUnit(notApproved.id));
    expect(quiet.warnings || []).toHaveLength(0);
  });
});

test.describe('Branch reports', () => {

  test('the material requirement report sums BOM consumption per branch', async () => {
    const { data: defs } = await api.get('/reports/definitions');
    const seeded = rowsOf(defs).find((d) => d.reportCode === 'MATERIAL_REQUIREMENT_BY_BRANCH');
    expect(seeded).toBeTruthy();

    const { data: run, status } = await api.post('/reports/execute', {
      reportDefId: seeded.id,
      selectedFieldCodes: ['branch', 'item_code', 'uom', 'required_qty', 'allocated_pcs'],
      page: 0, size: 100,
    });
    expect(status).toBe(200);
    const rows = rowsOf(run);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.branch && r.required_qty != null)).toBe(true);
  });

  test('the catalog offers a Branch column on the branch-aware sources', async () => {
    const { data } = await api.get('/reports/catalog');
    const sources = rowsOf(data);
    const cutting = sources.find((s) => s.key === 'cutting_pos');
    const fabric = sources.find((s) => s.key === 'fabric_stock');
    expect((cutting?.columns || []).some((c) => c.key === 'branch')).toBe(true);
    expect((fabric?.columns || []).some((c) => c.key === 'branch')).toBe(true);
  });
});
