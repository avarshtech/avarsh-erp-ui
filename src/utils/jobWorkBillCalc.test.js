// Node-only: the job-work bill calculator against its golden cases. No browser, no login, no API.
//   npx vitest run src/utils/jobWorkBillCalc.test.js
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { deriveLine, computeTotals, proposeDeductions, computeExceptions } from './jobWorkBillCalc.js';

const golden = JSON.parse(readFileSync(new URL('./jobWorkBillGolden.json', import.meta.url), 'utf8'));

describe('job-work bill lines', () => {
  for (const c of golden.lines) {
    test(c.name, () => {
      const got = deriveLine(c.line, c.poStatus);
      for (const [key, value] of Object.entries(c.expect)) expect(got[key], key).toBe(value);
      // The identity the bill shows as its check: invoiced − rejection − rate difference = passed.
      expect(Math.round((got.invoiceAmount - got.rejectionAmount - got.rateDiffAmount) * 100) / 100).toBe(got.passedAmount);
      expect(got.rejectionAmount).toBeGreaterThanOrEqual(0);
      expect(got.rateDiffAmount).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('job-work bill totals', () => {
  for (const c of golden.totals) {
    test(c.name, () => {
      const got = computeTotals(c.bill, c.lines, c.deductions);
      for (const [key, value] of Object.entries(c.expect)) expect(got[key], key).toBe(value);
    });
  }
});

test('proposals: rejection, rate difference and material damage; a keyed rate and a ruling survive re-proposal', () => {
  const bill = { gstRatePercent: 5, otherCharges: 0, poOtherCharges: 0 };
  const line = deriveLine(golden.lines[1].line, 'COMPLETED');
  let seq = 0;
  const nextId = () => { seq += 1; return seq; };
  const first = proposeDeductions(bill, [line], [], nextId);
  const byType = Object.fromEntries(first.map((d) => [d.type, d]));
  expect(byType.REJECTION_CHARGE).toMatchObject({ qty: 22, rate: 18.5, amount: 407, gstTreatment: 'WITH_GST', gstAmount: 20.35 });
  expect(byType.RATE_DIFFERENCE).toMatchObject({ qty: 998, rate: 0.5, amount: 499 });
  expect(byType.MATERIAL_DAMAGE).toMatchObject({ qty: 2, rate: 0, amount: 0, gstTreatment: 'WITHOUT_GST' });

  const edited = first.map((d) => {
    if (d.type === 'MATERIAL_DAMAGE') return { ...d, rate: 150, amount: 300 };
    if (d.type === 'RATE_DIFFERENCE') return { ...d, status: 'DROPPED' };
    return d;
  });
  const again = proposeDeductions(bill, [line], edited, nextId);
  expect(again.filter((d) => d.type === 'RATE_DIFFERENCE')).toHaveLength(1);
  expect(again.find((d) => d.type === 'RATE_DIFFERENCE').status).toBe('DROPPED');
  expect(again.find((d) => d.type === 'MATERIAL_DAMAGE')).toMatchObject({ rate: 150, amount: 300, status: 'PROPOSED' });
});

test('exceptions: a partial PO blocks, an unchecked DC blocks, paying rejects needs an override', () => {
  const lines = [deriveLine(golden.lines[6].line, 'PARTIALLY_COMPLETED')];
  const bill = { poNumber: 'GPPO/26-27/1001', poStatus: 'PARTIALLY_COMPLETED', gstRatePercent: 5, dcs: [{ vendorDcNo: 'DC-9' }] };
  const totals = computeTotals(bill, lines, []);
  const codes = Object.fromEntries(computeExceptions(bill, lines, totals, []).map((x) => [x.code, x.severity]));
  expect(codes).toMatchObject({ PO_NOT_FINAL: 'BLOCK', QC_PENDING: 'BLOCK', PASSED_ABOVE_ACCEPTED: 'BLOCK_WITH_OVERRIDE' });
});
