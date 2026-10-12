// Golden tests: the cost sheet's per-row formulas and the fields a pick writes onto a row, as
// they behave today (2026-10-12).
//   npx vitest run src/pages/costing/sheet/model/rowFactory.test.js
import { describe, test, expect } from 'vitest';
import { blankRow, hydrateRows, masterRecordPatch, nextKey, recalcRow, variantPatch, variantUomFields } from './rowFactory';

describe('recalcRow: the one place a row\'s amount is derived', () => {
  test('fabric net cost, local trim price and imported trim price (USD)', () => {
    const fabric = recalcRow('fabric', { consumption: 59.33, fabricPrice: 600, allowancePct: 5, wastagePct: 2, uomConversionFactor: 1000 });
    expect(fabric.netCost).toBeCloseTo(0.05933 * 600 * 1.05 * 1.02, 10);
    expect(recalcRow('localTrim', { consumption: 150, cost: 120, uomConversionFactor: 5000 }).price).toBeCloseTo(3.6, 10);
    expect(recalcRow('importedTrim', { consumption: 2, costUsd: 0.25 }).priceUsd).toBe(0.5);
  });

  test('manufacturing and overhead rows carry their cost as typed: the row comes back as it was', () => {
    const row = { cost: 35 };
    expect(recalcRow('manufacturing', row)).toBe(row);
    expect(recalcRow('overhead', row)).toBe(row);
  });
});

describe('rows and their keys', () => {
  test('keys come from a counter with the section prefix, so rows added together never collide', () => {
    const a = nextKey('f');
    const b = nextKey('f');
    expect(a).toMatch(/^f_\d+$/);
    expect(Number(b.slice(2))).toBe(Number(a.slice(2)) + 1);
  });

  test('a blank row has its section\'s defaults, a fresh key and its amount derived', () => {
    const row = blankRow('fabric', { consumption: 1, fabricPrice: 80 });
    expect(row).toMatchObject({ classification: 'Woven', allowancePct: 0, wastagePct: 0, netCost: 80 });
    expect(row.key).toMatch(/^f_\d+$/);
    expect(blankRow('importedTrim').key).toMatch(/^it_\d+$/);
  });

  test('saved rows keep their UOM snapshot, get new keys and are re-derived', () => {
    const [row] = hydrateRows('localTrim', [{ key: 'old', consumption: 10, cost: 2, uomSymbol: 'MTR', primaryUomSymbol: 'CONE', uomConversionFactor: 5 }]);
    expect(row).toMatchObject({ uom: 'MTR', primaryUom: 'CONE', uomConversionFactor: 5, price: 4 });
    expect(row.key).toMatch(/^lt_\d+$/);
    // Manufacturing rows have no UOM fields to restore
    const [m] = hydrateRows('manufacturing', [{ cost: 12, uom: 'X' }]);
    expect(m).toMatchObject({ cost: 12, uom: 'X' });
    expect(hydrateRows('overhead', null)).toEqual([]);
  });
});

describe('what a pick writes onto a row', () => {
  test('a variant bought in KG and consumed in GMS carries both units and the factor', () => {
    expect(variantUomFields({ uomId: 1, uomSymbol: 'KG', secondaryUomId: 2, secondaryUomSymbol: 'GMS', uomConversionFactor: '1000' }))
      .toEqual({ uom: 'GMS', uomId: 2, primaryUom: 'KG', primaryUomId: 1, secondaryUomId: 2, uomConversionFactor: 1000 });
  });

  test('no factor is stored when no conversion applies (no secondary unit, or the same unit)', () => {
    expect(variantUomFields({ uomId: 1, uomSymbol: 'PCS' }))
      .toEqual({ uom: 'PCS', uomId: 1, primaryUom: 'PCS', primaryUomId: 1, secondaryUomId: null, uomConversionFactor: null });
    expect(variantUomFields({ uomId: 1, uomSymbol: 'PCS', secondaryUomId: 1, uomConversionFactor: 12 }).uomConversionFactor).toBeNull();
  });

  test('a fabric pick names the fabric and reads knit or woven off its sub-category', () => {
    const variant = { id: 9, itemId: 3, variantName: 'Single Jersey 180', variantCode: 'SJ-180', subCategoryName: 'Knitted Fabric' };
    expect(variantPatch('fabric', variant, { description: 'kept' })).toMatchObject({
      variantId: 9, itemId: 3, variantCode: 'SJ-180', fabricType: 'Single Jersey 180', description: 'kept', classification: 'Knits',
    });
    expect(variantPatch('localTrim', variant)).toMatchObject({ variantId: 9, item: 'Single Jersey 180', code: 'SJ-180' });
  });

  test('a process or overhead pick fills an empty cost with its default, never a typed one', () => {
    const option = { value: 7, label: 'Stitching', defaultCost: 35 };
    expect(masterRecordPatch('manufacturing', option, {})).toEqual({ processId: 7, process: 'Stitching', cost: 35 });
    expect(masterRecordPatch('manufacturing', option, { cost: 20 })).toEqual({ processId: 7, process: 'Stitching' });
    expect(masterRecordPatch('overhead', { value: 2, label: 'Testing', defaultCost: 0 }, {})).toEqual({ overheadId: 2, description: 'Testing' });
  });
});
