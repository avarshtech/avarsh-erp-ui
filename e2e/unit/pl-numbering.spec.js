// Node-only: the carton numbers a packing list prints (owner, 2026-10-09/10).
//   npx playwright test --project=unit e2e/unit/pl-numbering.spec.js
import { test, expect } from '@playwright/test';
import {
  NUMBERING, printedRows, rangeLabelOf, distinctCartonsOf, groupsCollide,
} from '../../src/utils/expDocPlNumbering.js';
import { validate } from '../../src/utils/expDocValidation.js';
import { PHASE } from '../../src/utils/expDocConstants.js';

// A row as a packing list holds it: the entry's own numbers, its order and buyer PO
const row = (id, orderId, poKey, buyerPoNo, from, to, entryId, packingDate) => ({
  id, orderId, poKey, buyerPoNo, cartonFrom: from, cartonTo: to, sourceEntryId: entryId, packingDate,
  packingType: 'SOLID', sizeQty: { M: 10 },
});
const printed = (rows) => rows.map((r) => [r.id, r.cartonFrom, r.cartonTo]);

const SEGMENTS = [
  { orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' },
  { orderId: 1, poKey: 'B', buyerPoNo: 'PO-B' },
  { orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' },
];

test.describe('a packing list numbers its cartons', () => {
  test('continue across the shipment: one series, segment after segment', () => {
    const rows = [
      row('a1', 1, 'A', 'PO-A', 1, 40, 10, '2026-10-01'),
      row('b1', 1, 'B', 'PO-B', 41, 70, 10, '2026-10-01'),
      row('c1', 2, 'C', 'PO-C', 1, 20, 20, '2026-10-02'),
    ];
    expect(printed(printedRows(rows, SEGMENTS, { rule: NUMBERING.CONTINUE }))).toEqual([
      ['a1', 1, 40], ['b1', 41, 70], ['c1', 71, 90],
    ]);
  });

  test('a continuing list starts at its first carton number (a second list on the shipment)', () => {
    const rows = [row('a1', 1, 'A', 'PO-A', 1, 10, 10, '2026-10-01')];
    expect(printed(printedRows(rows, SEGMENTS, { rule: NUMBERING.CONTINUE, firstCartonNo: 91 }))).toEqual([['a1', 91, 100]]);
  });

  test('entries that all start at carton 1 are stacked in packing-date order', () => {
    const rows = [
      row('day2', 1, 'A', 'PO-A', 1, 30, 11, '2026-10-02'),
      row('day1', 1, 'A', 'PO-A', 1, 40, 10, '2026-10-01'),
    ];
    const out = printedRows(rows, SEGMENTS, { rule: NUMBERING.CONTINUE });
    expect(printed(out)).toEqual([['day1', 1, 40], ['day2', 41, 70]]);
    // The packers' own numbers stay with the row
    expect(out.find((r) => r.id === 'day2')).toMatchObject({ ownFrom: 1, ownTo: 30 });
  });

  test('the packers own numbers are kept, gaps and all, while they do not clash', () => {
    const rows = [
      row('x', 1, 'A', 'PO-A', 1, 10, 10, '2026-10-01'),
      row('y', 1, 'A', 'PO-A', 14, 20, 11, '2026-10-02'),
    ];
    expect(printed(printedRows(rows, SEGMENTS, { rule: NUMBERING.PER_PO }))).toEqual([['x', 1, 10], ['y', 14, 20]]);
  });

  test('restart for each buyer PO: every PO from 1, and a PO across two styles continues', () => {
    const segments = [
      { orderId: 1, poKey: 'A', buyerPoNo: 'PO-A' },
      { orderId: 2, poKey: 'A2', buyerPoNo: 'PO-A' },
      { orderId: 2, poKey: 'C', buyerPoNo: 'PO-C' },
    ];
    const rows = [
      row('s1', 1, 'A', 'PO-A', 1, 40, 10, '2026-10-01'),
      row('s2', 2, 'A2', 'PO-A', 1, 30, 20, '2026-10-01'),
      row('c', 2, 'C', 'PO-C', 1, 25, 20, '2026-10-01'),
    ];
    const out = printedRows(rows, segments, { rule: NUMBERING.PER_PO });
    expect(printed(out)).toEqual([['s1', 1, 40], ['s2', 41, 70], ['c', 1, 25]]);
    expect(rangeLabelOf(out, NUMBERING.PER_PO)).toBe('PO PO-A: 1–70 · PO PO-C: 1–25');
    expect(distinctCartonsOf(out)).toBe(95);
  });

  test('restart for each style: every order from 1, whatever its POs', () => {
    const rows = [
      row('a', 1, 'A', 'PO-A', 1, 40, 10, '2026-10-01'),
      row('b', 1, 'B', 'PO-B', 1, 30, 10, '2026-10-01'),
      row('c', 2, 'C', 'PO-C', 1, 20, 20, '2026-10-01'),
    ];
    expect(printed(printedRows(rows, SEGMENTS, { rule: NUMBERING.PER_STYLE }))).toEqual([['a', 1, 40], ['b', 41, 70], ['c', 1, 20]]);
  });

  test('a PO split across shipments restarts at 1 on each list (owner, 2026-10-10)', () => {
    // The second shipment's part of PO-A: the packers numbered it 61-100
    const rows = [row('rest', 1, 'A', 'PO-A', 61, 100, 30, '2026-10-20')];
    expect(printed(printedRows(rows, SEGMENTS, { rule: NUMBERING.PER_PO }))).toEqual([['rest', 1, 40]]);
  });

  test('two restarting groups may share numbers; a continuing list collides with everything', () => {
    expect(groupsCollide('po:PO-A', 'po:PO-B')).toBe(false);
    expect(groupsCollide('po:PO-A', 'po:PO-A')).toBe(true);
    expect(groupsCollide('list', 'po:PO-B')).toBe(true);
    // Two lists on different restart rules may both print carton 1: compared, not waved through
    expect(groupsCollide('po:PO-A', 'order:7')).toBe(true);
  });
});

test.describe('the carton-number rules run per numbering group', () => {
  const pl = (rows) => ({ id: 1, plNo: 'PKL/1', sections: [{ key: 'MAIN', rows }] });

  test('V-02: two POs that both start at 1 do not overlap; two rows of one PO do', () => {
    const rows = printedRows([
      row('a', 1, 'A', 'PO-A', 1, 10, 10, '2026-10-01'),
      row('b', 1, 'B', 'PO-B', 1, 10, 11, '2026-10-01'),
    ], SEGMENTS, { rule: NUMBERING.PER_PO });
    expect(validate({ pl: pl(rows) }, { phase: PHASE.SAVE }).findings.filter((f) => f.code === 'V-02')).toHaveLength(0);
    // Carton Packing's own check of one entry (no groups) still sees a clash
    const entryRows = [row('x', 1, null, null, 1, 10, 10), row('y', 1, null, null, 5, 12, 10)];
    expect(validate({ pl: pl(entryRows) }, { phase: PHASE.SAVE }).findings.filter((f) => f.code === 'V-02')).toHaveLength(1);
  });

  test('V-01: another list of the shipment printing the same PO numbers clashes; another PO does not', () => {
    const mine = printedRows([row('a', 1, 'A', 'PO-A', 1, 10, 10, '2026-10-01')], SEGMENTS, { rule: NUMBERING.PER_PO });
    const samePo = { id: 2, plNo: 'PKL/2', status: 'DRAFT', sections: [{ key: 'MAIN', rows: mine }] };
    const otherPo = {
      id: 3, plNo: 'PKL/3', status: 'DRAFT',
      sections: [{ key: 'MAIN', rows: printedRows([row('b', 1, 'B', 'PO-B', 1, 10, 11, '2026-10-01')], SEGMENTS, { rule: NUMBERING.PER_PO }) }],
    };
    const v01 = (others) => validate({ pl: pl(mine), plsInShipment: others }, { phase: PHASE.SAVE })
      .findings.filter((f) => f.code === 'V-01');
    expect(v01([otherPo])).toHaveLength(0);
    expect(v01([samePo])).toHaveLength(1);
  });

  test('V-20 flags cartons of a PO the shipment no longer carries; V-21 a shipment PO with none', () => {
    const blocks = [{
      orderId: 1, orderNo: 'ORD/1', onShipment: true, totals: { cartons: 10 },
      pos: [
        { key: 'A', buyerPoNo: 'PO-A', onShipment: false, rows: [{ id: 'a' }], totals: { cartons: 10 } },
        { key: 'B', buyerPoNo: 'PO-B', onShipment: true, rows: [], totals: { cartons: 0 } },
      ],
    }];
    const run = (phase, coveredPos) => validate({ pl: pl([]), blocks, coveredPos }, { phase }).findings;
    expect(run(PHASE.SAVE).map((f) => f.code)).toContain('V-20');
    expect(run(PHASE.SUBMIT).filter((f) => f.code === 'V-21')).toHaveLength(1);
    // Covered by another live list of the shipment: nothing to say
    expect(run(PHASE.SUBMIT, new Set(['1|B'])).filter((f) => f.code === 'V-21')).toHaveLength(0);
  });
});
