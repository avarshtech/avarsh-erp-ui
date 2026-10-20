/**
 * The GRN print's tax: the HTML the print window receives, for a GRN against a PO as the API returns it
 * (PurchaseOrderDTO has no IGST flag; each PO line carries sgst/cgst/igst percentages). No browser: the
 * print window is a stub that keeps what is written to it.
 *   npx vitest run src/utils/grnPdfGenerator.test.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateGRNPdf } from './grnPdfGenerator';

let written;
beforeEach(() => {
  written = '';
  vi.useFakeTimers();
  vi.stubGlobal('window', { open: () => ({ document: { write: (h) => { written += h; }, close() {} }, print() {} }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const grn = { grnNumber: 'GRN/1', grnType: 'Trims', poId: 7, lineItems: [{ poLineItemId: 11, receivingQty: 10, rate: 100, uom: 'PCS', description: 'Zip' }] };
const print = (tax) => generateGRNPdf(grn, {
  organisation: { name: 'Org' },
  supplier: { name: 'Supplier' },
  po: { id: 7, poNumber: 'PO/1', lineItems: [{ id: 11, unitPrice: 100, ...tax }] },
}).then(() => written.replace(/\s+/g, ' '));

describe('GRN print tax', () => {
  // Same defect as the PO print (U121): IGST lines printed under CGST / SGST at 0%.
  test('a GRN against an inter-state PO prints IGST columns, rate and breakup', async () => {
    const html = await print({ sgst: 0, cgst: 0, igst: 5 });
    expect(html).toContain('<th>IGST %</th><th>IGST Amt</th>');
    expect(html).toContain('<td class="num">5.00%</td> <td class="num">50.00</td>');
    expect(html).toContain('<td>IGST @ 5%</td>');
    expect(html).not.toContain('<th>CGST %</th>');
  });

  test('a GRN against an intra-state PO still prints CGST and SGST', async () => {
    const html = await print({ sgst: 2.5, cgst: 2.5, igst: 0 });
    expect(html).toContain('<th>CGST %</th><th>CGST Amt</th><th>SGST %</th><th>SGST Amt</th>');
    expect(html).toContain('<td>GST @ 5%</td>');
    expect(html).not.toContain('IGST');
  });
});
