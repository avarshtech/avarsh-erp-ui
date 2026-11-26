import { describe, it, expect } from 'vitest';
import { calcRequiredQty, expandSelection, recalcLine } from './cutPanelCalc';

// A Cut Panel Requirement asks for the order's garment quantity plus the allowance. A panel's
// panels-per-garment (Parts master) does not multiply it: a body cut in two panels was asked for
// twice the order (production defect, 2026-11-21).
const order = {
  sizes: ['M', 'L'],
  colors: [{ name: 'Black', qty: 301 }],
  qtyMatrix: { Black: { M: 200, L: 101 } },
};
const fabric = { id: 7, code: 'FAB-1', name: 'Single Jersey', consumption: 1 };
const body = { id: 3, partName: 'Body', panelsPerGarment: 2 };
const printing = { id: 5, processName: 'Panel Printing' };

describe('calcRequiredQty', () => {
  it('is the garment quantity plus the allowance, rounded up', () => {
    expect(calcRequiredQty(100, 10)).toBe(110);
    expect(calcRequiredQty(101, 2.5)).toBe(104); // 103.525
    expect(calcRequiredQty(0, 10)).toBe(0);
  });
});

describe('a panel cut twice per garment', () => {
  const added = expandSelection({
    fabric, colorNames: ['Black'], panels: [body], processes: [printing],
    allowancePct: 0, order, existingLines: [], lastLineNo: 0,
  }).lines[0];

  it('asks for the order quantity, not double it', () => {
    expect(added.sizes.M).toEqual({ baseQty: 200, calculatedQty: 200, requiredQty: 200 });
    expect(added.sizes.L).toEqual({ baseQty: 101, calculatedQty: 101, requiredQty: 101 });
  });

  it('still records the panels per garment from the master', () => {
    expect(added.panelsPerGarment).toBe(2);
  });

  it('recalculates to the order quantity plus the allowance', () => {
    const again = recalcLine({ ...added, allowancePct: 2.5 }, order);
    expect(again.sizes.M.calculatedQty).toBe(205);
    expect(again.sizes.L.calculatedQty).toBe(104);
  });
});
