/**
 * The Supplier PO print's tax: the HTML the print window receives, built from a PO as the API returns it
 * (PurchaseOrderDTO has no IGST flag; each line carries sgst/cgst/igst percentages). No browser: the print
 * window is a stub that keeps what is written to it.
 *   npx vitest run src/utils/poPdfGenerator.test.js
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { generatePOPdf } from './poPdfGenerator';

let written;
beforeEach(() => {
  written = '';
  vi.stubGlobal('window', { open: () => ({ document: { write: (h) => { written += h; }, close() {} }, focus() {}, print() {} }) });
});
afterEach(() => vi.unstubAllGlobals());

const line = (tax) => ({ id: 1, itemCode: 'ZIP-001', description: 'Zip', quantity: 10, unitPrice: 100, uom: 'PCS', ...tax });
const print = (po) => generatePOPdf(
  { poNumber: 'PO/1', poDate: '2026-10-14', ...po },
  { organisation: { name: 'Org' }, supplier: { name: 'Supplier' }, termsContent: '' },
).then(() => written.replace(/\s+/g, ' '));

describe('Supplier PO print tax', () => {
  // U121: IGST lines (cgst = sgst = 0, igst = 5) printed 0% under "CGST + SGST".
  test('an inter-state PO prints IGST: the tax type, the line rate and amount, and the total', async () => {
    const html = await print({ grandTotal: 1050, lineItems: [line({ sgst: 0, cgst: 0, igst: 5, igstValue: 50 })] });
    expect(html).toContain('<div class="label">Tax Type</div> <div class="value">IGST</div>');
    expect(html).toContain('<th style="width:35px;">IGST%</th>');
    expect(html).toContain('<td class="num">5%</td><td class="num">50.00</td>');
    expect(html).toContain('<span class="label">IGST (5%)</span>');
    expect(html).not.toContain('CGST + SGST');
  });

  test('an intra-state PO still prints CGST + SGST, split in halves', async () => {
    const html = await print({ grandTotal: 1050, lineItems: [line({ sgst: 2.5, cgst: 2.5, igst: 0 })] });
    expect(html).toContain('<div class="value">CGST + SGST</div>');
    expect(html).toContain('<td class="num">2.5%</td><td class="num">2.5%</td><td class="num">25.00</td><td class="num">25.00</td>');
    expect(html).not.toContain('IGST%');
  });
});
