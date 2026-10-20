// Golden tests: the BOM quantity helpers as they behave today (2026-10-12).
//   npx vitest run src/utils/bomConstants.test.js
import { describe, test, expect } from 'vitest';
import {
  ALLOWANCE_POPUP_PROCESS_TYPES, BOM_STATUS, CONSUMPTION_MODE, EDITABLE_STATUSES, PROCESS_TYPES,
  buildOrderQtyGrid, calcLinePurchaseQty, calcMatrixTotal, calcPurchaseQty, calcPurchaseWidth,
  calcTrimsTotal, calcVariantBreakdown, getStatusLabel,
} from './bomConstants';

describe('status helpers', () => {
  test('labels a known status, spaces out an unknown one, and is blank for none', () => {
    expect(getStatusLabel(BOM_STATUS.DRAFT)).toBe('Draft');
    expect(getStatusLabel(BOM_STATUS.CREATED)).toBe('Created');
    expect(getStatusLabel('PARTLY_ORDERED')).toBe('PARTLY ORDERED');
    expect(getStatusLabel(null)).toBe('');
  });

  test('both statuses are editable; dyeing and printing open the allowance dialog', () => {
    expect(EDITABLE_STATUSES).toEqual(['DRAFT', 'CREATED']);
    expect(ALLOWANCE_POPUP_PROCESS_TYPES).toEqual([PROCESS_TYPES.FABRIC_DYEING, PROCESS_TYPES.FABRIC_PRINTING]);
  });
});

describe('calcPurchaseQty (BR-07): base plus process loss plus rejection, both on the base', () => {
  test('adds each allowance as a share of the base, not compounded', () => {
    expect(calcPurchaseQty(1000, 5, 3)).toBe(1080);
    expect(calcPurchaseQty('200', '10', '2.5')).toBe(225);
  });

  test('allowances default to none; a missing base is zero', () => {
    expect(calcPurchaseQty(250)).toBe(250);
    expect(calcPurchaseQty(null, 5, 5)).toBe(0);
    expect(calcPurchaseQty('abc', 5, 5)).toBe(0);
  });

  test('a percentage that is not a number gives NaN (only the base is guarded; the form sends numbers)', () => {
    expect(calcPurchaseQty(100, 'abc')).toBeNaN();
  });
});

describe('calcLinePurchaseQty: one BOM line, in its consumption UOM', () => {
  const allowances = [
    { processLossPercent: 2, rejectionPercent: 3, shipmentAllowancePercent: 1 },
    { processLossPercent: 1, rejectionPercent: 0, shipmentAllowancePercent: 2 },
  ];

  test('no quantity yet is null; no allowances returns the quantity untouched', () => {
    expect(calcLinePurchaseQty({ processAllowances: allowances }, 0)).toBeNull();
    expect(calcLinePurchaseQty({ processAllowances: allowances }, null)).toBeNull();
    expect(calcLinePurchaseQty({ processAllowances: [] }, 500)).toBe(500);
    expect(calcLinePurchaseQty(undefined, 500)).toBe(500);
  });

  test('simple mode sums every process: loss on the base, rejection and shipment together', () => {
    // loss 3%, rejection 3% + shipment 3% => 1000 + 30 + 60
    expect(calcLinePurchaseQty({ processAllowances: allowances }, 1000)).toBe(1090);
    expect(calcLinePurchaseQty({ consumptionMode: CONSUMPTION_MODE.SIMPLE, processAllowances: allowances }, 1000)).toBe(1090);
  });

  describe('matrix modes work size by size from the consumption matrix and the order grid', () => {
    const consumptionMatrix = { Navy: { S: 1.5, M: 2 }, Black: { S: 1 } };
    const orderQtyGrid = { Navy: { S: 100, M: 50 }, Black: { S: 20, M: 10 } };
    const perSize = [{
      processLossPercent: 10, rejectionPercent: 2, shipmentAllowancePercent: 3,
      sizeAllowances: { M: { rejectionPercent: 5 } },
    }];

    test('a size without its own allowance takes the flat one; a size with one overrides it field by field', () => {
      // S: 1.5 x 100 + 1 x 20 = 170, flat 2% + 3% => 178.5
      // M: 2 x 50 = 100, its own 5% rejection + the flat 3% shipment => 108
      const line = { consumptionMode: CONSUMPTION_MODE.SIZE_WISE, consumptionMatrix, processAllowances: perSize };
      expect(calcLinePurchaseQty(line, 270, orderQtyGrid, ['S', 'M'])).toBeCloseTo(286.5, 10);
    });

    test('process loss is left out, as the allowance dialog\'s matrix summary leaves it out', () => {
      const line = { consumptionMode: CONSUMPTION_MODE.VARIANT_PER_SIZE, consumptionMatrix, processAllowances: perSize };
      expect(calcLinePurchaseQty(line, 270, orderQtyGrid, ['S', 'M'])).toBeCloseTo(286.5, 10);
    });

    test('the quantity passed in only has to be non-zero: the matrix decides the figure', () => {
      const line = { consumptionMode: CONSUMPTION_MODE.SIZE_WISE, consumptionMatrix, processAllowances: perSize };
      expect(calcLinePurchaseQty(line, 1, orderQtyGrid, ['S', 'M'])).toBeCloseTo(286.5, 10);
      // Sizes not walked count for nothing
      expect(calcLinePurchaseQty(line, 1, orderQtyGrid, ['S'])).toBeCloseTo(178.5, 10);
      expect(calcLinePurchaseQty(line, 1, orderQtyGrid)).toBe(0);
    });

    test('a matrix-mode line without a matrix falls back to the simple sum', () => {
      const line = { consumptionMode: CONSUMPTION_MODE.SIZE_WISE, processAllowances: allowances };
      expect(calcLinePurchaseQty(line, 1000, orderQtyGrid, ['S', 'M'])).toBe(1090);
    });
  });
});

describe('width and trims', () => {
  test('calcPurchaseWidth (BR-08) adds the shrinkage in inches', () => {
    expect(calcPurchaseWidth(58, 2)).toBe(60);
    expect(calcPurchaseWidth('56.5', '1.5')).toBe(58);
    expect(calcPurchaseWidth(58)).toBe(58);
    expect(calcPurchaseWidth(null, null)).toBe(0);
  });

  test('calcTrimsTotal is consumption per garment times the order quantity', () => {
    expect(calcTrimsTotal(2, 1200)).toBe(2400);
    expect(calcTrimsTotal('0.5', '300')).toBe(150);
    expect(calcTrimsTotal(undefined, 10)).toBe(0);
  });
});

describe('buildOrderQtyGrid', () => {
  const summary = [
    { buyerPoNo: 'PO-1', colors: [{ name: 'Navy', quantities: { S: 10, M: 20 } }, { name: 'Black', quantities: { S: 5 } }] },
    { buyerPoNo: 'PO-2', colors: [{ name: 'Navy', quantities: { S: 1, L: '4', XL: 'n/a' } }] },
    { buyerPoNo: 'PO-3' },
  ];

  test('sums colour by size across every buyer PO; a quantity that is not a number counts as zero', () => {
    expect(buildOrderQtyGrid(summary)).toEqual({ Navy: { S: 11, M: 20, L: 4, XL: 0 }, Black: { S: 5 } });
  });

  test('one buyer PO when named; an unknown PO gives an empty grid', () => {
    expect(buildOrderQtyGrid(summary, 'PO-2')).toEqual({ Navy: { S: 1, L: 4, XL: 0 } });
    expect(buildOrderQtyGrid(summary, 'PO-X')).toEqual({});
  });
});

describe('calcMatrixTotal', () => {
  const grid = { Navy: { S: 100, M: 50 }, Black: { S: 20 } };

  test('sums consumption x ordered quantity over every cell', () => {
    expect(calcMatrixTotal({ Navy: { S: 1.5, M: 2 }, Black: { S: '1' } }, grid)).toBe(270);
  });

  test('a colour or size the order does not carry adds nothing; a missing input is zero', () => {
    expect(calcMatrixTotal({ Red: { S: 3 }, Navy: { XL: 4 } }, grid)).toBe(0);
    expect(calcMatrixTotal(null, grid)).toBe(0);
    expect(calcMatrixTotal({ Navy: { S: 1 } }, null)).toBe(0);
  });
});

describe('calcVariantBreakdown (no screen calls it today; the API\'s BomVariantBreakdown is what ships)', () => {
  const matrix = { Navy: { S: 1, M: 2 }, Black: { S: 1, M: 1 } };
  const grid = { Navy: { S: 100, M: 100 }, Black: { S: 50, M: 50 } };
  const mapping = { S: 11, M: 12 };

  test('nothing to split without a matrix, a grid or a mapping', () => {
    expect(calcVariantBreakdown(null, grid, mapping, [])).toEqual([]);
    expect(calcVariantBreakdown(matrix, null, mapping, [])).toEqual([]);
    expect(calcVariantBreakdown(matrix, grid, null, [])).toEqual([]);
  });

  test('one share per mapped size: its requirement across colours plus its allowance', () => {
    const process = [{ rejectionPercent: 2, shipmentAllowancePercent: 1, sizeAllowances: { M: { rejectionPercent: 4, shipmentAllowancePercent: 2 } } }];
    expect(calcVariantBreakdown(matrix, grid, mapping, process)).toEqual([
      { variantId: 11, size: 'S', totalReq: 150, allowancePercent: 3, purchaseQty: 154.5 },
      { variantId: 12, size: 'M', totalReq: 250, allowancePercent: 6, purchaseQty: 265 },
    ]);
  });

  test('KNOWN DIVERGENCE: only the first process\'s flat allowance reaches a size', () => {
    // The API's BomVariantBreakdown.allowancePerSize adds every process's flat allowance to each
    // size it does not name, which would make S 3% + 3% = 6% here. This function stops at the first
    // process because a size already in its map skips the flat fallback. Pinned as it is, since no
    // screen calls it; it must be fixed before anything does.
    const twoFlat = [
      { rejectionPercent: 2, shipmentAllowancePercent: 1 },
      { rejectionPercent: 3, shipmentAllowancePercent: 0 },
    ];
    const [s] = calcVariantBreakdown(matrix, grid, { S: 11 }, twoFlat);
    expect(s).toEqual({ variantId: 11, size: 'S', totalReq: 150, allowancePercent: 3, purchaseQty: 154.5 });
  });
});
