// The cost-sheet print is written into a same-origin window, so nothing a user typed may reach it as
// markup (U076), while normal values print exactly as they always have.
//   npx vitest run src/utils/costingPdfGenerator.test.js
import { describe, test, expect, vi } from 'vitest';
import { buildCostingHtml } from './costingPdfGenerator';

vi.mock('../services/admin/organisationService', () => ({ getCachedOrganisation: () => null, fetchAndCacheOrganisation: async () => null }));

const XSS = '<img src=x onerror=alert(1)>';
const ESCAPED = '&lt;img src=x onerror=alert(1)&gt;';

const org = (over = {}) => ({
  organisationName: 'Sristi Apparels', addressLine1: 'No. 12, Mill Road', addressLine2: 'Ganapathy', city: 'Tiruppur',
  state: 'Tamil Nadu', pincode: '641604', phone: '+91 421 2345678', email: 'accounts@sristi.example',
  gstin: '33ABCDE1234F1Z5', pan: 'ABCDE1234F', cin: 'U18101TZ2010PTC012345', ...over,
});

const fabric = (over = {}) => ({
  sizes: '', fabricType: 'Single Jersey 180', classification: 'Knits', description: 'Combed cotton\nbio-washed',
  consumption: 0.2513, uomSymbol: 'MTR', fabricPrice: 420, primaryUomSymbol: 'KG', fabricWidthStd: '58"',
  fabricWidthVendor: '', vendorName: 'KPR Mills', allowancePct: 0, netCost: 108.72, ...over,
});

const sheet = (over = {}) => ({
  costingId: 'CST/26-27/1042', status: 'Final', date: '2026-10-12', buyerName: 'Zara (Inditex)', styleNo: 'ST-2201',
  garmentName: 'Crew neck tee', season: 'AW26', sizes: ['S', 'M'], currency: 'INR', quoteCurrency: 'EUR',
  actualRate: 90.5, todaysRate: 91.2, usdToInrRate: 83.8, fabricRows: [fabric()],
  manufacturingRows: [{ sizes: '', process: 'Stitching', cost: 35, comments: 'Line 4\nsecond shift' }],
  ...over,
});

describe('markup typed into the sheet or the organisation prints as text', () => {
  test.each([
    ['a fabric width', () => buildCostingHtml(sheet({ fabricRows: [fabric({ fabricWidthStd: XSS })] }), org())],
    ['a vendor width', () => buildCostingHtml(sheet({ fabricRows: [fabric({ fabricWidthVendor: XSS })] }), org())],
    ['a size in the header', () => buildCostingHtml(sheet({ sizes: ['S', XSS] }), org())],
    ['a consumption unit', () => buildCostingHtml(sheet({ fabricRows: [fabric({ uomSymbol: XSS.toUpperCase() })] }), org())],
    ['the costing number', () => buildCostingHtml(sheet({ costingId: XSS }), org())],
    ['a rate', () => buildCostingHtml(sheet({ actualRate: XSS }), org())],
    ['the organisation address', () => buildCostingHtml(sheet(), org({ addressLine1: XSS }))],
    ['the organisation GSTIN', () => buildCostingHtml(sheet(), org({ gstin: XSS }))],
    ['the organisation email', () => buildCostingHtml(sheet(), org({ email: XSS }))],
  ])('%s', (_, render) => {
    const html = render();
    expect(html).not.toMatch(/<img src=x/i);
    expect(html.toUpperCase()).toContain(ESCAPED.toUpperCase());
  });
});

describe('normal values print as before', () => {
  const html = buildCostingHtml(sheet(), org());

  test('a multi-line note stays one run of text, with no <br/> added', () => {
    expect(html).toContain('<td>Combed cotton\nbio-washed</td>');
    expect(html).toContain('<td>Line 4\nsecond shift</td>');
  });

  test('inch marks print as typed; an empty width or a zero allowance keeps its old mark', () => {
    expect(html).toContain('<td class="center">58"</td>');
    expect(html).toContain('<td class="center">-</td>');
    expect(html).toContain('<td class="num">0%</td>');
  });

  test('the header carries the organisation and the sheet', () => {
    expect(html).toContain('<title>Cost Sheet CST/26-27/1042 - Zara (Inditex) - ST-2201</title>');
    expect(html).toContain('Tiruppur, Tamil Nadu - 641604<br>');
    expect(html).toContain('GSTIN: 33ABCDE1234F1Z5 | PAN: ABCDE1234F | CIN: U18101TZ2010PTC012345');
    expect(html).toContain('<div class="value">S, M</div>');
    expect(html).toContain('<div class="value">90.5</div>');
  });
});
