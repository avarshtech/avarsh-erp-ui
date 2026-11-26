// The packing-list print's carton-number cell (F11): the server keeps a carton number it does not have
// as null, and the print shows a dash for it rather than an empty cell that reads as a printing fault.
//   npx vitest run src/utils/expDocHtml.test.js
import { describe, test, expect } from 'vitest';
import { buildPackingListHtml } from './expDocHtml';

const TEMPLATE = {
  docType: 'PACKING_LIST',
  identity: { showLogo: false },
  columns: [
    { key: 'ctn', label: 'CTN NO', binding: 'row.cartonRange' },
    { key: 'po', label: 'PO', binding: 'row.buyerPoNo' },
  ],
  sheets: [{ key: 'MAIN', title: 'PACKING LIST', include: ['MAIN'] }],
};

/** A draft list printing these rows in its main section. */
const listOf = (rows) => ({
  plNo: 'PKL/26-27/0001', status: 'DRAFT', template: TEMPLATE, sizes: [],
  sections: [{ key: 'MAIN', title: 'Main', rows }],
});

/** One printed carton row: its number cell, then its PO cell. */
const printedRow = (cartons, po) => `<tr><td class="v">${cartons}</td><td class="v">${po}</td></tr>`;

describe('the packing-list print: carton numbers', () => {
  test('a numbered row prints its range', () => {
    const html = buildPackingListHtml(listOf([{ cartonFrom: 1, cartonTo: 10, buyerPoNo: 'PO-1' }]));
    expect(html).toContain(printedRow('1–10', 'PO-1'));
  });

  test('a row with no carton numbers prints a dash', () => {
    const html = buildPackingListHtml(listOf([
      { cartonFrom: null, cartonTo: null, buyerPoNo: 'PO-2' },
      { cartonFrom: 5, cartonTo: null, buyerPoNo: 'PO-3' },
    ]));
    expect(html).toContain(printedRow('—', 'PO-2'));
    expect(html).toContain(printedRow('—', 'PO-3'));
  });
});
