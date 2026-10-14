// The PO form's money against the API's own figures (erp-purchase PoAmountsTest, the same cases).
// The API keeps a figure from the form when it is within a paisa (PoAmounts.TOLERANCE), so that is
// the contract; where the form's floating point lands on the other paisa, the exact figure is
// pinned too.
//   npx vitest run src/utils/poAmounts.test.js
import { describe, test, expect } from 'vitest';
import { poLineAmount, poLineTax, poTotals } from './poAmounts';

const PAISA = 0.01;
/** Within the API's tolerance of its own figure. */
const agrees = (form, api) => expect(Math.abs(form - api)).toBeLessThanOrEqual(PAISA + 1e-9);

describe('one line', () => {
  test('a local line splits its GST into CGST and SGST, each rounded to paise (API: localLine)', () => {
    const tax = poLineTax(10 * 125.5, 5, false);
    expect(tax).toEqual({ cgst: 2.5, sgst: 2.5, igst: 0, cgstValue: 31.38, sgstValue: 31.38, igstValue: 0, taxValue: 62.76 });
    expect(poLineAmount(10, 125.5, 5)).toBe(1317.75);
  });

  test('an inter-state line carries IGST alone (API: interStateLine)', () => {
    const tax = poLineTax(100 * 12.345, 18, true);
    expect(tax).toMatchObject({ cgst: 0, sgst: 0, igst: 18, cgstValue: 0, sgstValue: 0, igstValue: 222.21, taxValue: 222.21 });
    agrees(poLineAmount(100, 12.345, 18), 1456.71);
  });

  test('an empty line is all zeros (API: emptyLine)', () => {
    expect(poLineAmount(0, 0, 0)).toBe(0);
    expect(poLineTax(0, 0, false).taxValue).toBe(0);
  });
});

describe('the PO', () => {
  const lines = [{ qty: '10', unitPrice: '125.50', gstPercent: '5' }, { qty: 3.5, unitPrice: 80, gstPercent: 12 }];

  test('subtotal, tax split and grand total agree with the API within a paisa (API: totals)', () => {
    const t = poTotals(lines, false);
    expect(t.subtotal).toBe(1535);
    agrees(t.cgst, 48.18);
    agrees(t.sgst, 48.18);
    agrees(t.grandTotal, 1631.35);
    expect(t.igst).toBe(0);
  });

  test('the form rounds 48.175 in floating point, where the API rounds the exact decimal up', () => {
    // 31.375 + 16.8 is 48.17499999999999... as a double, so toFixed(2) gives 48.17; the API's
    // BigDecimal HALF_UP gives 48.18. Within the paisa the API accepts, so the form's figure stands.
    const t = poTotals(lines, false);
    expect(t.cgst).toBe(48.17);
    expect(t.grandTotal).toBe(1631.35);
  });

  test('an inter-state PO puts all of the tax in IGST', () => {
    expect(poTotals(lines, true)).toEqual({ subtotal: 1535, sgst: 0, cgst: 0, igst: 96.35, grandTotal: 1631.35 });
  });

  test('a line without a number counts as zero; no lines is all zeros', () => {
    expect(poTotals([{ qty: 'x', unitPrice: 5, gstPercent: 5 }, { qty: 2, unitPrice: 50, gstPercent: '' }], false))
      .toEqual({ subtotal: 100, sgst: 0, cgst: 0, igst: 0, grandTotal: 100 });
    expect(poTotals([], false)).toEqual({ subtotal: 0, sgst: 0, cgst: 0, igst: 0, grandTotal: 0 });
  });
});
