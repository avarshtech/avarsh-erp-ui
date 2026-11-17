import { describe, test, expect } from 'vitest';
import {
  ordersOfPls, resolveInvoiceTerms, termsByOrder, hsCodeOfOrder, latestOfBuyer,
} from './expDocInvoiceTerms';

const pl = (...rows) => ({ sections: [{ rows }] });
const terms = [
  { orderId: 11, orderNo: 'ORD/0011', currency: 'eur', paymentTerms: 'TT 60 DAYS', hsCode: '61091000' },
  { orderId: 12, orderNo: 'ORD/0012', currency: 'EUR', paymentTerms: 'TT 60 DAYS', hsCode: null },
  { orderId: 13, orderNo: 'ORD/0013', currency: 'USD', paymentTerms: 'TT 30 DAYS', hsCode: '62034200' },
  { orderId: 14, orderNo: 'ORD/0014', currency: ' ', paymentTerms: null, hsCode: null },
];

describe('export invoice terms (owner, 2026-11-17)', () => {
  test('the orders are read off the packing-list rows, once each, first seen first', () => {
    const orders = ordersOfPls([pl({ orderId: 12, orderNo: 'ORD/0012' }, { orderId: 11, orderNo: 'ORD/0011' }), pl({ orderId: 12 })]);
    expect(orders).toEqual([{ orderId: 12, orderNo: 'ORD/0012' }, { orderId: 11, orderNo: 'ORD/0011' }]);
  });

  test('one currency across the orders is the invoice currency, upper-cased; the payment terms are the orders\'', () => {
    const out = resolveInvoiceTerms([{ orderId: 11 }, { orderId: 12 }], terms);
    expect(out).toEqual({ currency: 'EUR', paymentTerms: 'TT 60 DAYS' });
  });

  test('orders in two currencies are refused, naming each order', () => {
    const out = resolveInvoiceTerms([{ orderId: 11 }, { orderId: 13 }], terms);
    expect(out.error).toContain('EUR on ORD/0011, USD on ORD/0013');
  });

  test('an order without a currency is refused rather than defaulted to USD', () => {
    expect(resolveInvoiceTerms([{ orderId: 14 }], terms).error).toContain('Order ORD/0014 has no currency');
  });

  test('an order the shipment no longer carries is refused', () => {
    expect(resolveInvoiceTerms([{ orderId: 99, orderNo: 'ORD/0099' }], terms).error).toContain('ORD/0099 is no longer on this shipment');
  });

  test('a line takes its style\'s HS code, and a style without one leaves it blank, never a category default', () => {
    const byOrder = termsByOrder(terms);
    expect(hsCodeOfOrder(byOrder, 11)).toBe('61091000');
    expect(hsCodeOfOrder(byOrder, 12)).toBeNull();
    expect(hsCodeOfOrder(byOrder, 99)).toBeNull();
  });

  test('the buyer\'s latest document is the last one held, by buyer id, else by name', () => {
    const docs = [
      { id: 'a', buyerId: 4, buyerName: 'JOMO BV' },
      { id: 'b', buyerId: 5, buyerName: 'VGT' },
      { id: 'c', buyerId: 4, buyerName: 'JOMO BV' },
    ];
    expect(latestOfBuyer(docs, { buyerId: 4 }).id).toBe('c');
    expect(latestOfBuyer(docs, { buyerId: 4 }, 'c').id).toBe('a');
    expect(latestOfBuyer(docs, { buyerName: 'vgt' }).id).toBe('b');
    expect(latestOfBuyer(docs, { buyerId: 9 })).toBeNull();
  });
});
