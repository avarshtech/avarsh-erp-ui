// Node-only: the job-work bill demo's rules, end to end, without a browser (Stage 1 mock).
//   npx playwright test --project=unit
import { test, expect } from '@playwright/test';
import { resetJwbDb } from '../../src/services/inventory/jobWorkBill/jwbDemoStore.js';
import { mockBillablePos, mockBillableVendors } from '../../src/services/inventory/jobWorkBill/jwbMockSources.js';
import { mockCreateBill, mockGetBill, mockListBills, mockUpdateBill } from '../../src/services/inventory/jobWorkBill/jwbMockBills.js';
import { transition } from '../../src/services/inventory/jobWorkBill/jwbMockWorkflow.js';
import { mockProposeDeductions, mockSaveDeduction, mockSetDeductionStatus } from '../../src/services/inventory/jobWorkBill/jwbMockDeductions.js';

const CPP = 'CUT_PANEL_PO';
const GPO = 'GARMENT_PROCESS_PO';
const errorOf = (fn) => { try { fn(); } catch (e) { return e.response?.data; } return null; };

test.beforeEach(() => { resetJwbDb(); });

test('only final POs without a live bill are offered (D3)', () => {
  const gpoVendors = mockBillableVendors(GPO).map((v) => v.id);
  const gpos = gpoVendors.flatMap((vendorId) => mockBillablePos({ source: GPO, vendorId }).map((p) => p.poNumber));
  expect(gpos).toEqual(['GPPO/26-27/1009']); // 1010 is partial; 1005 and 1007 already carry a bill
  const cpps = mockBillableVendors(CPP).flatMap((v) => mockBillablePos({ source: CPP, vendorId: v.id }).map((p) => p.poNumber));
  expect(cpps.sort()).toEqual(['CPPO/26-27/1004', 'CPPO/26-27/1006', 'CPPO/26-27/1008']);
});

test('the seeded bills list with their KPIs; the approved one carries its Vendor Debit Note', () => {
  const res = mockListBills({ sources: [CPP, GPO], page: 0, size: 10 });
  expect(res.totalElements).toBe(3);
  expect(res.stats.pendingApproval).toBe(1);
  const approved = mockGetBill(1);
  expect(approved).toMatchObject({ status: 'APPROVED', vdnNumber: 'VDN/26-27/1001' });
  expect(approved.vdnAmount).toBe(approved.debitNoteTotal);
});

test('a CPPO bill: propose, key the damage rate, confirm, walk the workflow, VDN on approval', () => {
  let bill = mockCreateBill({ source: CPP, vendorId: 1000101, poId: 504 });
  expect(bill.jwbNumber).toMatch(/^JWB\/\d\d-\d\d\/1004$/);
  expect(() => mockCreateBill({ source: CPP, vendorId: 1000101, poId: 504 })).toThrow(/one bill per PO/);

  bill = mockUpdateBill(bill.id, { vendorInvoiceNo: 'SMP/INV/1301', lines: [] });
  bill = mockProposeDeductions(bill.id);
  const types = bill.deductions.map((d) => d.type).sort();
  expect(types).toEqual(['MATERIAL_DAMAGE', 'MATERIAL_DAMAGE', 'REJECTION_CHARGE', 'REJECTION_CHARGE']);
  expect(bill.blockers).toContain('Deductions to confirm or drop');

  const damage = bill.deductions.find((d) => d.type === 'MATERIAL_DAMAGE');
  expect(errorOf(() => mockSetDeductionStatus(bill.id, damage.id, 'CONFIRMED'))?.message).toMatch(/recovery rate/);
  for (const d of bill.deductions) {
    if (d.type === 'MATERIAL_DAMAGE') mockSaveDeduction(bill.id, { ...d, rate: 92.4 });
    bill = mockSetDeductionStatus(bill.id, d.id, 'CONFIRMED');
  }
  expect(bill.blockers).toEqual([]);

  bill = transition(bill.id, 'submit');
  bill = transition(bill.id, 'startVerification');
  bill = transition(bill.id, 'sendForApproval');
  bill = transition(bill.id, 'approve');
  expect(bill.status).toBe('APPROVED');
  expect(bill.vdnNumber).toMatch(/^VDN\/\d\d-\d\d\/1002$/);
  expect(bill.vdnAmount).toBe(bill.debitNoteTotal);
  expect(bill.netPayable).toBe(Math.round((bill.invoiceTotal - bill.debitNoteTotal) * 100) / 100);

  bill = transition(bill.id, 'reopen', { reason: 'Rate on XL to be rechecked' });
  bill = transition(bill.id, 'submit');
  bill = transition(bill.id, 'startVerification');
  bill = transition(bill.id, 'sendForApproval');
  bill = transition(bill.id, 'approve');
  expect(bill).toMatchObject({ vdnRevision: 2 });
  expect(bill.vdnNumber).toMatch(/1002$/);
});

test('an unchecked DC blocks sending for approval; a duplicate invoice is refused until overridden (D9)', () => {
  let bill = mockCreateBill({ source: GPO, vendorId: 1000101, poId: 506 });
  expect(bill.blockers).toContain('Check pending on vendor DCs');
  expect(errorOf(() => transition(bill.id, 'submit'))?.message).toMatch(/invoice no/);
  mockUpdateBill(bill.id, { vendorInvoiceNo: 'SMP/INV/1310', lines: [] });
  transition(bill.id, 'submit');
  transition(bill.id, 'startVerification');
  expect(errorOf(() => transition(bill.id, 'sendForApproval'))?.message).toMatch(/Check pending on vendor DCs/);
  // Same vendor as the approved seeded bill: its invoice no. is taken this financial year.
  const second = mockCreateBill({ source: CPP, vendorId: 1000101, poId: 504 });
  const dup = errorOf(() => mockUpdateBill(second.id, { vendorInvoiceNo: 'SMP/INV/1187', vendorInvoiceDate: mockGetBill(1).vendorInvoiceDate }));
  expect(dup?.error).toBe('DUPLICATE_INVOICE');
  const saved = mockUpdateBill(second.id, { vendorInvoiceNo: 'SMP/INV/1187', vendorInvoiceDate: mockGetBill(1).vendorInvoiceDate, duplicateOverrideReason: 'One invoice covers two POs, agreed with accounts' });
  expect(saved.duplicateOverrideReason).toMatch(/two POs/);
});
