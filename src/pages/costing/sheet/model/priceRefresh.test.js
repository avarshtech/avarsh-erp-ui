// Golden tests: re-pricing template or copied rows from the last PO / costing prices, as it
// behaves today (2026-10-12).
//   npx vitest run src/pages/costing/sheet/model/priceRefresh.test.js
import { describe, test, expect } from 'vitest';
import { applyLastPrices, variantIdsOf } from './priceRefresh';

const fabric = (over = {}) => ({ key: 'f_1', variantId: 10, consumption: 1, fabricPrice: 500, allowancePct: 0, wastagePct: 0, primaryUom: 'KG', netCost: 500, ...over });

describe('applyLastPrices', () => {
  test('a rupee PO price in the row\'s unit wins, and the row is re-derived', () => {
    const { sections, updated } = applyLastPrices({ fabric: [fabric()] }, [{ variantId: 10, poPrice: 550, poUomSymbol: 'Kilogram', costingPrice: 520, costingCurrency: 'INR' }], 'INR');
    expect(updated).toBe(1);
    expect(sections.fabric[0]).toMatchObject({ fabricPrice: 550, netCost: 550 });
  });

  test('a PO price in another unit is skipped for the last costing\'s rate in the same currency', () => {
    const { sections } = applyLastPrices({ fabric: [fabric()] }, [{ variantId: 10, poPrice: 9, poUomSymbol: 'MTR', costingPrice: 520, costingCurrency: 'INR' }], 'INR');
    expect(sections.fabric[0].fabricPrice).toBe(520);
  });

  test('nothing is converted: a USD sheet ignores rupee PO prices, imported trims only take USD rates', () => {
    const prices = [
      { variantId: 10, poPrice: 550, costingPrice: 6.5, costingCurrency: 'USD' },
      { variantId: 20, poPrice: 2, costingPrice: 0.3, costingCurrency: 'INR' },
    ];
    const { sections, updated } = applyLastPrices({
      fabric: [fabric()],
      importedTrim: [{ key: 'it_1', variantId: 20, consumption: 2, costUsd: 0.25, priceUsd: 0.5 }],
    }, prices, 'USD');
    expect(updated).toBe(1);
    expect(sections.fabric[0].fabricPrice).toBe(6.5);
    expect(sections.importedTrim[0].costUsd).toBe(0.25);
  });

  test('a row whose rate is unchanged, or that has no price, is kept as the same object', () => {
    const same = fabric({ fabricPrice: 550 });
    const none = fabric({ key: 'f_2', variantId: 11 });
    const { sections, updated } = applyLastPrices({ fabric: [same, none] }, [{ variantId: 10, poPrice: 550 }], 'INR');
    expect(updated).toBe(0);
    expect(sections.fabric[0]).toBe(same);
    expect(sections.fabric[1]).toBe(none);
  });

  test('manufacturing and overhead rows are never re-priced', () => {
    const manufacturing = [{ key: 'm_1', variantId: 10, cost: 5 }];
    const { sections } = applyLastPrices({ manufacturing }, [{ variantId: 10, poPrice: 9 }], 'INR');
    expect(sections.manufacturing).toBe(manufacturing);
  });
});

test('variantIdsOf lists the variants of the fabric and trim rows', () => {
  expect(variantIdsOf({
    fabric: [{ variantId: 10 }, { variantId: null }],
    localTrim: [{ variantId: 30 }],
    manufacturing: [{ variantId: 99 }],
  })).toEqual([10, 30]);
});
