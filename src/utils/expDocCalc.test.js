// Node-only: ordered against packed, as the packing list's quantity rules read it.
//   npx vitest run src/utils/expDocCalc.test.js
import { describe, test, expect } from 'vitest';
import { orderVsPacked } from './expDocCalc';

const row = (from, to, sizeQty) => ({ styleNo: 'NV-IT-2665', colorName: 'Black', cartonFrom: from, cartonTo: to, packingType: 'SOLID', sizeQty });

describe('orderVsPacked', () => {
  test('two buyer POs of the same colour are compared with what both ordered', () => {
    const ordered = [
      { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'L', orderQty: 40, buyerPoNo: 'NV-PO-57045' },
      { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'L', orderQty: 30, buyerPoNo: 'NV-PO-57046' },
    ];
    const rows = orderVsPacked(ordered, [row(1, 2, { L: 20 }), row(3, 3, { L: 30 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ size: 'L', orderQty: 70, shippedQty: 70, variance: 0, withinTolerance: true });
  });

  test('a short size is still short against the total ordered', () => {
    const ordered = [
      { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'M', orderQty: 40 },
      { styleNo: 'NV-IT-2665', colorName: 'Black', size: 'M', orderQty: 30 },
    ];
    const [m] = orderVsPacked(ordered, [row(1, 3, { M: 20 })], { tolerancePercent: 5 });
    expect(m).toMatchObject({ orderQty: 70, shippedQty: 60, status: 'SHORT', withinTolerance: false });
  });
});
