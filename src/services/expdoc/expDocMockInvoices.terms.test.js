// Node-only: the export invoice's commercial terms (owner, 2026-11-17) — currency and payment terms
// from the orders, the HS code from the style, the CBIC customs rate in force on the invoice date,
// and the discount carried from the buyer's last invoice — against a stubbed store.
//   npx vitest run src/services/expdoc/expDocMockInvoices.terms.test.js
import {
  describe, test, expect, vi, beforeEach,
} from 'vitest';

const store = vi.hoisted(() => ({ db: null, seq: 0 }));
const rates = vi.hoisted(() => ({ inForce: vi.fn() }));

vi.mock('./expDocStore.js', () => ({
  loadDb: () => store.db,
  saveDb: () => {},
  nextInvoiceNo: () => 'EXP/26-27/0001',
  newDocId: () => 1000 + (store.seq += 1),
}));
vi.mock('./customsRateApi.js', () => ({ customsRateInForce: (...a) => rates.inForce(...a) }));
vi.mock('./expDocMockPackingLists.js', () => ({ decoratePl: (pl) => JSON.parse(JSON.stringify(pl)) }));
vi.mock('./expDocMockShipments.js', () => ({ decorate: (s) => s }));
vi.mock('./expDocMockNotifications.js', () => ({ raise: () => {}, EXPDOC_NOTIFICATION: {} }));
vi.mock('./expDocMockCommon.js', async (original) => ({ ...(await original()), delay: () => Promise.resolve() }));
vi.mock('../../utils/permissions.js', () => ({ getCurrentUser: () => ({ name: 'Tester' }), hasPermission: () => true }));

const { createInvoice, updateInvoice, regenerateLines } = await import('./expDocMockInvoices.js');

const row = (id, orderId, styleNo) => ({
  id, orderId, orderNo: `ORD/00${orderId}`, styleNo, colorName: 'NAVY', packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { M: 10 },
});
const pl = (id, rows) => ({
  id, plNo: `PKL/${id}`, status: 'FINAL', shipmentId: 7, buyerId: 4, buyerName: 'JOMO BV', sections: [{ key: 'MAIN', rows }],
});
const terms = [
  { orderId: 11, orderNo: 'ORD/0011', styleNo: 'ST-11', currency: 'EUR', paymentTerms: 'TT 60 DAYS', hsCode: '61091000' },
  { orderId: 12, orderNo: 'ORD/0012', styleNo: 'ST-12', currency: 'EUR', paymentTerms: 'TT 60 DAYS', hsCode: null },
  { orderId: 13, orderNo: 'ORD/0013', styleNo: 'ST-13', currency: 'USD', paymentTerms: 'TT 30 DAYS', hsCode: null },
];
const create = (plIds, extra = {}) => createInvoice({ plIds, orderTerms: terms, invoiceDate: '2026-11-17', ...extra });

beforeEach(() => {
  store.seq = 0;
  store.db = {
    packingLists: [pl(1, [row('a', 11, 'ST-11'), row('b', 12, 'ST-12')]), pl(2, [row('c', 13, 'ST-13')])],
    shipments: [{ id: 7, shipmentNo: 'SHP/0007', incoterm: 'FOB', orders: [] }],
    invoices: [],
    packingEntries: [],
    audit: [],
    masters: { tenantConfig: {}, exporterProfileExtra: {} },
  };
  rates.inForce.mockReset();
  rates.inForce.mockResolvedValue({ exportRate: 96.45, effectiveFrom: '2026-11-06', notificationNo: '78/2026-Cus (N.T.)' });
});

describe('a new export invoice', () => {
  test('takes the orders\' currency and terms, and the customs rate in force on its date', async () => {
    const inv = await create([1]);
    expect(inv.currency).toBe('EUR');
    expect(inv.paymentTerms).toBe('TT 60 DAYS');
    expect(rates.inForce).toHaveBeenCalledWith('EUR', '2026-11-17');
    expect(inv).toMatchObject({ fxRate: 96.45, fxSource: 'CUSTOMS', fxDate: '2026-11-06', fxNotificationNo: '78/2026-Cus (N.T.)' });
  });

  test('gives each line its style\'s HS code, and leaves a style without one blank', async () => {
    const inv = await create([1]);
    const byStyle = Object.fromEntries(inv.lines.map((l) => [l.styleNo, l.hsCode]));
    expect(byStyle).toEqual({ 'ST-11': '61091000', 'ST-12': null });
  });

  test('is refused when its orders are in two currencies', async () => {
    await expect(create([1, 2])).rejects.toThrow('An invoice is in one currency');
  });

  test('has no rate, rather than a made-up one, when no notification is in force', async () => {
    rates.inForce.mockResolvedValue(null);
    const inv = await create([1]);
    expect(inv.fxRate).toBeNull();
    expect(inv.fxSource).toBeNull();
  });

  test('in rupees needs no customs rate', async () => {
    const inr = terms.map((t) => ({ ...t, currency: 'INR' }));
    const inv = await createInvoice({ plIds: [1], orderTerms: inr, invoiceDate: '2026-11-17' });
    expect(inv.fxRate).toBe(1);
    expect(rates.inForce).not.toHaveBeenCalled();
  });

  test('starts with the buyer\'s last invoice\'s discount and says where it came from', async () => {
    store.db.invoices.push({ id: 'old', buyerId: 4, provisionalNo: 'DRAFT-0009', status: 'CANCELLED', charges: { discount: { mode: 'PERCENT', value: 3 } } });
    const inv = await create([1]);
    expect(inv.charges.discount).toMatchObject({ mode: 'PERCENT', value: 3 });
    expect(inv.discountCarriedFrom).toBe('DRAFT-0009');
  });
});

describe('review fixes', () => {
  test('a rate that cannot be read fails the date change instead of blanking the rate', async () => {
    const inv = await create([1]);
    rates.inForce.mockRejectedValue(new Error('The customs exchange rate could not be read just now. Nothing was changed; try again.'));
    await expect(updateInvoice(inv.id, { invoiceDate: '2026-11-21' })).rejects.toThrow('could not be read');
  });

  test('a flat discount is carried only into an invoice in the same currency; a percentage always is', async () => {
    store.db.invoices.push({ id: 'old', buyerId: 4, provisionalNo: 'DRAFT-0009', currency: 'USD', charges: { discount: { mode: 'AMOUNT', value: 250 } } });
    expect((await create([1])).charges.discount.value).toBe(0);

    store.db.invoices.push({ id: 'old2', buyerId: 4, provisionalNo: 'DRAFT-0010', currency: 'EUR', charges: { discount: { mode: 'AMOUNT', value: 250 } } });
    expect((await create([1])).charges.discount).toMatchObject({ mode: 'AMOUNT', value: 250 });
  });

  test('an HS code typed on the lines reaches the annexe lines of the same style, and follows a correction', async () => {
    const templateSnapshot = { docType: 'INVOICE', annexeSheets: [{ key: 'BUYER', title: 'Buyer', grain: { mode: 'PER_SIZE' } }] };
    const inv = await create([1], { templateSnapshot });
    const annexCode = (i) => i.annexes[0].lines.find((l) => l.styleNo === 'ST-12').hsCode;
    expect(annexCode(inv)).toBeNull();

    const typed = await updateInvoice(inv.id, { lines: inv.lines.map((l) => (l.styleNo === 'ST-12' ? { ...l, hsCode: '62034200' } : l)) });
    expect(annexCode(typed)).toBe('62034200');
    const fixed = await updateInvoice(inv.id, { lines: typed.lines.map((l) => (l.styleNo === 'ST-12' ? { ...l, hsCode: '62034300' } : l)) });
    expect(annexCode(fixed)).toBe('62034300');
    expect(fixed.annexes[0].lines.find((l) => l.styleNo === 'ST-11').hsCode).toBe('61091000');
  });
});

describe('editing a draft', () => {
  test('a new invoice date takes the rate in force on it; a hand-set rate is kept', async () => {
    const inv = await create([1]);
    rates.inForce.mockResolvedValue({ exportRate: 97.1, effectiveFrom: '2026-11-20', notificationNo: '80/2026' });
    const moved = await updateInvoice(inv.id, { invoiceDate: '2026-11-21' });
    expect(moved).toMatchObject({ fxRate: 97.1, fxDate: '2026-11-20' });

    await updateInvoice(inv.id, { fxRate: 95, fxOverrideReason: 'Bank-confirmed rate' });
    rates.inForce.mockResolvedValue({ exportRate: 99, effectiveFrom: '2026-12-04', notificationNo: '84/2026' });
    const kept = await updateInvoice(inv.id, { invoiceDate: '2026-12-05' });
    expect(kept).toMatchObject({ fxRate: 95, fxSource: 'MANUAL' });
  });

  test('changing the carried discount makes it the invoice\'s own', async () => {
    store.db.invoices.push({ id: 'old', buyerId: 4, provisionalNo: 'DRAFT-0009', charges: { discount: { mode: 'PERCENT', value: 3 } } });
    const inv = await create([1]);
    const edited = await updateInvoice(inv.id, { charges: { ...inv.charges, discount: { ...inv.charges.discount, value: 0 } } });
    expect(edited.discountCarriedFrom).toBeNull();
  });

  test('regenerating keeps an HS code staff typed where the style has none', async () => {
    const inv = await create([1]);
    const typed = inv.lines.map((l) => (l.styleNo === 'ST-12' ? { ...l, hsCode: '62034200' } : l));
    await updateInvoice(inv.id, { lines: typed });
    const rebuilt = await regenerateLines(inv.id, { orderTerms: terms });
    expect(rebuilt.lines.find((l) => l.styleNo === 'ST-12').hsCode).toBe('62034200');
  });

  test('regenerating a draft whose orders changed currency is refused', async () => {
    const inv = await create([1]);
    const usd = terms.map((t) => ({ ...t, currency: 'USD' }));
    await expect(regenerateLines(inv.id, { orderTerms: usd })).rejects.toThrow('Delete this draft and create the invoice again');
  });
});
