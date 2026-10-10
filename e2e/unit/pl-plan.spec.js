// Node-only: the buyer's plan against what was packed (owner, 2026-10-09).
//   npx playwright test --project=unit e2e/unit/pl-plan.spec.js
import { test, expect } from '@playwright/test';
import {
  matchPlan, PLAN_STATUS, planChip, rowsToPack, subtractRanges,
} from '../../src/utils/expDocPlanMatch.js';
import { printedRows, planKeyOf, NUMBERING } from '../../src/utils/expDocPlNumbering.js';
import { validate } from '../../src/utils/expDocValidation.js';
import { PHASE } from '../../src/utils/expDocConstants.js';

const plan = (id, from, to, over = {}) => ({
  id, cartonFrom: from, cartonTo: to, packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10 }, buyerPoNo: 'PO-A', poKey: 'A', ...over,
});
const packed = (id, from, to, over = {}) => ({
  id, cartonFrom: from, cartonTo: to, packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10 }, ...over,
});

test.describe('the buyer plan against the packed cartons', () => {
  test('packed as planned, partly, not yet, and packed outside the plan', () => {
    const { rows, extra } = matchPlan(
      [plan('p1', 1, 40), plan('p2', 41, 80), plan('p3', 81, 90)],
      [packed('a', 1, 40), packed('b', 41, 60), packed('c', 91, 95)],
    );
    expect(rows.map((r) => r.status)).toEqual([PLAN_STATUS.PACKED, PLAN_STATUS.PARTLY_PACKED, PLAN_STATUS.NOT_PACKED]);
    expect(rows[1].toPack).toEqual([{ from: 61, to: 80 }]);
    expect(extra).toEqual([{ from: 91, to: 95 }]);
    expect(planChip({ rows, extra })).toBe('Plan 90 · packed 60 · 30 to pack');
  });

  test('a carton holding something else than planned differs, and says what', () => {
    const { rows } = matchPlan([plan('p1', 1, 10)], [packed('a', 1, 10, { colorName: 'Black', sizeQty: { M: 12 } })]);
    expect(rows[0].status).toBe(PLAN_STATUS.DIFFERS);
    expect(rows[0].differs[0].aspects).toEqual(['colour', 'sizes per carton']);
  });

  test('a range marked not shipping needs no packing (a short shipment)', () => {
    const { rows } = matchPlan([plan('p1', 1, 10, { notShipping: { reason: 'Buyer cut the PO by 10 cartons' } })], []);
    expect(rows[0]).toMatchObject({ status: PLAN_STATUS.NOT_SHIPPING, toPack: [] });
  });

  test('Carton Packing fills the planned contents with the buyer numbers', () => {
    let n = 0;
    const out = rowsToPack(plan('p1', 1, 40), [{ from: 21, to: 40 }], () => `t${(n += 1)}`);
    expect(out).toEqual([expect.objectContaining({ id: 't1', cartonFrom: 21, cartonTo: 40, buyerPoNo: 'PO-A', colorName: 'Navy' })]);
  });

  test('subtracting ranges leaves what is not covered', () => {
    expect(subtractRanges([{ from: 1, to: 20 }], [{ from: 5, to: 8 }, { from: 15, to: 30 }]))
      .toEqual([{ from: 1, to: 4 }, { from: 9, to: 14 }]);
  });
});

test.describe('a PO with a plan prints the plan numbers', () => {
  const seg = [{ orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' }, { orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' }];
  const row = (id, orderId, poKey, from, to, packingDate, entryId, over = {}) => ({
    id, orderId, poKey, cartonFrom: from, cartonTo: to, packingDate, sourceEntryId: entryId, ...over,
  });
  const out = (rows, plans) => printedRows(rows, seg, { rule: NUMBERING.CONTINUE, plans })
    .map((r) => [r.id, r.cartonFrom, r.cartonTo]);

  test('cartons packed as per the plan keep its numbers; the next order continues after it', () => {
    const plans = new Map([[planKeyOf(1, 'A'), [{ from: 121, to: 160 }]]]);
    expect(out([row('a', 1, 'A', 121, 160, '2026-10-01', 1), row('c', 2, 'C', 1, 10, '2026-10-01', 2)], plans))
      .toEqual([['a', 121, 160], ['c', 161, 170]]);
  });

  test('cartons packed before the plan fill its free numbers in date order; what does not fit prints after it', () => {
    const plans = new Map([[planKeyOf(1, 'A'), [{ from: 121, to: 160 }]]]);
    const rows = [
      row('asPlan', 1, 'A', 141, 160, '2026-10-03', 3),
      row('early', 1, 'A', 1, 20, '2026-10-01', 1),
      row('more', 1, 'A', 1, 5, '2026-10-02', 2),
    ];
    expect(out(rows, plans)).toEqual([['early', 121, 140], ['asPlan', 141, 160], ['more', 161, 165]]);
  });

  test('two entries that both started at 1 inside the plan never print the same number', () => {
    const plans = new Map([[planKeyOf(1, 'A'), [{ from: 1, to: 40 }]]]);
    expect(out([row('b', 1, 'A', 1, 10, '2026-10-02', 2), row('a', 1, 'A', 1, 10, '2026-10-01', 1)], plans))
      .toEqual([['a', 1, 10], ['b', 11, 20]]);
  });

  test('the carton holding what the plan says keeps the numbers over an earlier one that started at 1 too', () => {
    const plans = new Map([[planKeyOf(1, 'A'), [{ from: 1, to: 20, plan: plan('p1', 1, 20) }]]]);
    const navy = { packingType: 'SOLID', colorName: 'Navy', sizeQty: { M: 10 } };
    const rows = [
      row('asPlan', 1, 'A', 1, 10, '2026-10-03', 3, navy),
      row('early', 1, 'A', 1, 10, '2026-10-01', 1, { ...navy, colorName: 'Black' }),
    ];
    expect(out(rows, plans)).toEqual([['asPlan', 1, 10], ['early', 11, 20]]);
  });

  test('numbers of a range marked not shipping are never handed to cartons packed before the plan', () => {
    const plans = new Map([[planKeyOf(1, 'A'), [{ from: 1, to: 10 }, { from: 11, to: 20, notShipping: true }]]]);
    expect(out([row('asPlan', 1, 'A', 1, 10, '2026-10-03', 3), row('early', 1, 'A', 1, 5, '2026-10-04', 1)], plans))
      .toEqual([['asPlan', 1, 10], ['early', 21, 25]]);
  });
});

test.describe('the plan checks', () => {
  const blockWith = (plan2) => [{
    orderId: 1, orderNo: 'ORD/1', onShipment: true, totals: { cartons: 0 },
    pos: [{ key: 'A', buyerPoNo: 'PO-A', onShipment: true, rows: [{ id: 'x' }], totals: { cartons: 1 }, plan: plan2 }],
  }];
  const codes = (plan2, phase) => validate({ pl: { sections: [] }, blocks: blockWith(plan2), coveredPos: new Set(['1|A']) }, { phase })
    .findings.map((f) => f.code);

  test('V-17 blocks while planned cartons are not packed; V-18 and V-19 ask for a reason', () => {
    const m = matchPlan([plan('p1', 1, 10), plan('p2', 11, 20)], [packed('a', 1, 10, { colorName: 'Black' }), packed('b', 25, 26)]);
    expect(codes(m, PHASE.SUBMIT)).toEqual(expect.arrayContaining(['V-17', 'V-18', 'V-19']));
    const v17 = validate({ pl: { sections: [] }, blocks: blockWith(m), coveredPos: new Set(['1|A']) }, { phase: PHASE.SUBMIT })
      .findings.find((f) => f.code === 'V-17');
    expect(v17.message).toContain('Pack them, or mark them Not shipping');
  });

  test("a plan for a PO taken off the shipment is flagged for Drop (V-20), not asked to be packed", () => {
    const orphan = [{
      orderId: 1, orderNo: 'ORD/1', onShipment: true, totals: { cartons: 0 },
      pos: [{ key: 'A', buyerPoNo: 'PO-A', onShipment: false, rows: [], totals: { cartons: 0 }, plan: matchPlan([plan('p1', 1, 10)], []) }],
    }];
    const found = validate({ pl: { sections: [] }, blocks: orphan, coveredPos: new Set() }, { phase: PHASE.SUBMIT }).findings;
    expect(found.map((f) => f.code)).toContain('V-20');
    expect(found.map((f) => f.code)).not.toContain('V-17');
    expect(found.find((f) => f.code === 'V-20').message).toContain("the buyer's plan for it is on this list");
  });
});
