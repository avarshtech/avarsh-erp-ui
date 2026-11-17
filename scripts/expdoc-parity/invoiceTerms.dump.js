// Parity fixtures for src/utils/expDocInvoiceTerms.js -> erp-purchase InvoiceTerms (README.md).
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
//
// The order terms are the shipment's GET /export-docs/shipments/{id}/order-terms rows (OrderTermsDTO); the packing
// lists are the sections and rows an invoice is raised from; the documents are a buyer's packing lists and
// invoices, held oldest first as the store loads them.
import { test, expect } from 'vitest';
import * as terms from '../../src/utils/expDocInvoiceTerms.js';
import { writeFixtures } from './writeFixtures.js';

const {
  termsByOrder, ordersOfPls, resolveInvoiceTerms, latestOfBuyer,
} = terms;

// hsCodeOfOrder takes the Map termsByOrder makes, keyed by numbers; JSON has no Map, so a fixture passes the order
// terms and this adapter makes the Map with the real termsByOrder first, as the invoice service does. The Java test
// does the same. The constant CUSTOMS_RATE_STALE_DAYS is recorded through an adapter of its own name.
const hsCodeOfOrder = function hsCodeOfOrder(orderTerms, orderId) {
  return terms.hsCodeOfOrder(termsByOrder(orderTerms), orderId);
};
const CUSTOMS_RATE_STALE_DAYS = function CUSTOMS_RATE_STALE_DAYS() {
  return terms.CUSTOMS_RATE_STALE_DAYS;
};
const API = { ...terms, hsCodeOfOrder, CUSTOMS_RATE_STALE_DAYS };

const NOT_PORTED = {
  invoiceFxStatus: 'screen wording (tag, colour, tooltip, warning) for the exchange rate; the server returns the rate fields and the screen words them',
};

const TERMS = [
  { orderId: 1042, orderNo: 'SG/26-27/1042', styleNo: 'ST-2026-0441', currency: 'eur', paymentTerms: 'TT 60 DAYS', hsCode: '61051000' },
  { orderId: 1043, orderNo: 'SG/26-27/1043', styleNo: 'ST-2026-0442', currency: 'EUR', paymentTerms: ' TT 60 DAYS ', hsCode: null },
  { orderId: 1055, orderNo: 'SG/26-27/1055', styleNo: 'ST-2026-0512', currency: 'USD', paymentTerms: 'TT 30 DAYS', hsCode: '61091000' },
  { orderId: 1061, orderNo: 'SG/26-27/1061', styleNo: 'ST-2026-0588', currency: ' EUR ', paymentTerms: 'LC AT SIGHT', hsCode: ' 61112000 ' },
  { orderId: 1070, orderNo: 'SG/26-27/1070', styleNo: 'ST-2026-0601', currency: ' ', paymentTerms: null, hsCode: '   ' },
  { orderId: 1071, orderNo: null, styleNo: 'ST-2026-0602', currency: null, paymentTerms: '', hsCode: null },
  { orderId: 1080, orderNo: 'SG/26-27/1080', styleNo: 'ST-2026-0700', currency: 'eur', paymentTerms: null, hsCode: '62034200' },
];
const ref = (orderId, orderNo) => ({ orderId, orderNo });

// ─── Packing lists ────────────────────────────────────────────────────────────────
const plRow = (id, orderId, orderNo, extra = {}) => ({
  id, orderId, orderNo, styleNo: 'ST', packingType: 'SOLID', cartonFrom: 1, cartonTo: 2, sizeQty: { M: 10 }, ...extra,
});
const pl = (...sections) => ({ id: 1, plNo: 'PKL/26-27/0007', status: 'FINAL', sections });
const section = (key, ...rows) => ({ key, title: key === 'EXTRA' ? 'Extra Cartons' : 'Packing List', rows });

const PL_JOMO = pl(
  section('MAIN', plRow('a', 1042, 'SG/26-27/1042'), plRow('b', 1043, 'SG/26-27/1043'), plRow('c', 1042, 'SG/26-27/1042')),
  section('EXTRA', plRow('d', 1043, 'SG/26-27/1043-X')),
);
const PL_VGT = pl(section('MAIN', plRow('e', 1055, 'SG/26-27/1055'), plRow('f', 1042, 'SG/26-27/1042 (again)')));

// ─── A buyer's documents, oldest first ────────────────────────────────────────────
const DOCS = [
  { id: 'a', buyerId: 4, buyerName: 'JOMO BV', provisionalNo: 'DRAFT-0001' },
  { id: 'b', buyerId: 5, buyerName: 'VGT', provisionalNo: 'DRAFT-0002' },
  { id: 'c', buyerId: 4, buyerName: 'JOMO BV', provisionalNo: 'DRAFT-0003', charges: { discount: { mode: 'PERCENT', value: 3 } } },
  { id: 'd', buyerId: null, buyerName: ' vgt ', provisionalNo: 'DRAFT-0004' },
];
const NUMBERED = [
  { id: 1, buyerId: 4, buyerName: 'JOMO BV' },
  { id: 2, buyerId: '4', buyerName: 'JOMO BV' },
  { id: 3, buyerId: 4, buyerName: 'JOMO BV' },
];

const CASES = [
  ...[
    ['shipment-terms', [TERMS]],
    ['later-row-replaces-in-place', [[TERMS[0], TERMS[2], { ...TERMS[0], currency: 'GBP' }]]],
    // An id typed as text keys as its number; the row is echoed as given, and the server cannot tell "1042" from
    // 1042 (README.md), so hsCodeOfOrder/terms-ids-as-text proves the keying instead
    ['null-id-is-zero', [[{ ...TERMS[0], orderId: null }, TERMS[2]]]],
    ['empty', [[]]],
    ['null', [null]],
  ].map(([id, args]) => ({ id: `termsByOrder/${id}`, fn: termsByOrder, args })),
  { id: 'termsByOrder/null-row-throws', fn: termsByOrder, args: [[TERMS[0], null]], throws: true },

  ...[
    ['one-list-first-seen-first', [[PL_JOMO]]],
    ['two-lists', [[PL_JOMO, PL_VGT]]],
    ['two-lists-other-way', [[PL_VGT, PL_JOMO]]],
    ['rows-without-an-order', [[pl(section('MAIN',
      plRow('z', 0, 'ZERO'), plRow('n', -5, 'NEGATIVE'), plRow('x', null, 'NONE'), { id: 'bare' }, plRow('ok', 1061, null), plRow('t', '1080', 'SG/26-27/1080')))]]],
    ['order-number-missing', [[pl(section('MAIN', { id: 'm', orderId: 1055 }))]]],
    ['lists-without-sections', [[{ id: 2, sections: null }, { id: 3 }, pl(section('MAIN'))]]],
    ['sections-without-rows', [[pl({ key: 'MAIN', rows: null }, { key: 'EXTRA' })]]],
    ['empty', [[]]],
  ].map(([id, args]) => ({ id: `ordersOfPls/${id}`, fn: ordersOfPls, args })),
  { id: 'ordersOfPls/null-lists-throws', fn: ordersOfPls, args: [null], throws: true },
  { id: 'ordersOfPls/null-list-throws', fn: ordersOfPls, args: [[PL_JOMO, null]], throws: true },
  { id: 'ordersOfPls/null-section-throws', fn: ordersOfPls, args: [[pl(null)]], throws: true },
  { id: 'ordersOfPls/null-row-throws', fn: ordersOfPls, args: [[pl(section('MAIN', null))]], throws: true },

  ...[
    ['one-currency-upper-cased', [[ref(1042), ref(1043)], TERMS]],
    ['padded-currency', [[ref(1061), ref(1042)], TERMS]],
    ['payment-terms-joined-once', [[ref(1042), ref(1043), ref(1061), ref(1080)], TERMS]],
    ['no-payment-terms', [[ref(1080)], TERMS]],
    ['two-currencies-named', [[ref(1042), ref(1055)], TERMS]],
    ['three-orders-two-currencies', [[ref(1043), ref(1061), ref(1055)], TERMS]],
    ['currency-blank', [[ref(1042), ref(1070)], TERMS]],
    ['currency-missing-order-number-from-the-list', [[ref(1071, 'SG/26-27/1071')], TERMS]],
    ['currency-missing-no-order-number', [[ref(1071, null)], TERMS]],
    ['order-left-the-shipment', [[ref(1042), ref(9999, 'SG/26-27/9999')], TERMS]],
    ['order-left-the-shipment-named-by-id', [[ref(9999, '')], TERMS]],
    ['order-without-id', [[ref(null, null)], TERMS]],
    ['first-refusal-wins', [[ref(9999, 'GONE'), ref(1070)], TERMS]],
    ['mismatch-names-a-missing-order-number', [[ref(1042), { orderId: 1071 }], [TERMS[0], { ...TERMS[5], currency: 'usd' }]]],
    ['no-orders', [[], TERMS]],
    ['from-the-packing-lists', [ordersOfPls([PL_JOMO]), TERMS]],
    ['null-terms', [[ref(1042)], null]],
  ].map(([id, args]) => ({ id: `resolveInvoiceTerms/${id}`, fn: resolveInvoiceTerms, args })),
  { id: 'resolveInvoiceTerms/null-orders-throws', fn: resolveInvoiceTerms, args: [null, TERMS], throws: true },
  { id: 'resolveInvoiceTerms/null-order-throws', fn: resolveInvoiceTerms, args: [[ref(1042), null], TERMS], throws: true },

  ...[
    ['style-code', [TERMS, 1042]],
    ['trimmed', [TERMS, 1061]],
    ['style-without-code', [TERMS, 1043]],
    ['blank-code', [TERMS, 1070]],
    ['order-not-on-shipment', [TERMS, 9999]],
    ['id-as-text', [TERMS, '1055']],
    ['terms-ids-as-text', [[{ ...TERMS[0], orderId: '1042' }, { ...TERMS[2], orderId: '1055' }], 1055]],
    ['null-id-reads-zero', [[{ ...TERMS[0], orderId: null, hsCode: '61099090' }], null]],
    ['null-id-no-zero-row', [TERMS, null]],
    ['code-as-number', [[{ ...TERMS[0], hsCode: 61051000 }], 1042]],
    ['no-terms', [[], 1042]],
  ].map(([id, args]) => ({ id: `hsCodeOfOrder/${id}`, fn: hsCodeOfOrder, args })),

  ...[
    ['by-id', [DOCS, { buyerId: 4 }]],
    ['by-id-except', [DOCS, { buyerId: 4 }, 'c']],
    ['by-id-except-all', [[DOCS[0]], { buyerId: 4 }, 'a']],
    ['by-name-any-case-trimmed', [DOCS, { buyerName: ' VGT ' }]],
    ['by-name-skips-except', [DOCS, { buyerName: 'vgt' }, 'd']],
    ['id-wins-over-name', [DOCS, { buyerId: 9, buyerName: 'VGT' }]],
    ['unknown-id', [DOCS, { buyerId: 9 }]],
    ['id-as-text', [DOCS, { buyerId: '5' }]],
    ['document-id-as-text', [NUMBERED, { buyerId: 4 }, 3]],
    ['except-text-is-not-a-number', [NUMBERED, { buyerId: 4 }, '3']],
    ['no-buyer-named', [DOCS, {}]],
    ['blank-name', [DOCS, { buyerName: '  ' }]],
    ['no-documents', [[], { buyerId: 4 }]],
    ['holes-skipped-without-a-buyer', [[null, DOCS[1]], {}]],
  ].map(([id, args]) => ({ id: `latestOfBuyer/${id}`, fn: latestOfBuyer, args })),
  { id: 'latestOfBuyer/null-documents-throws', fn: latestOfBuyer, args: [null, { buyerId: 4 }], throws: true },
  { id: 'latestOfBuyer/null-buyer-throws', fn: latestOfBuyer, args: [DOCS, null], throws: true },
  { id: 'latestOfBuyer/null-document-throws', fn: latestOfBuyer, args: [[DOCS[0], null], { buyerId: 4 }], throws: true },

  { id: 'CUSTOMS_RATE_STALE_DAYS/constant', fn: CUSTOMS_RATE_STALE_DAYS, args: [] },
];

test('expDocInvoiceTerms parity fixtures', () => {
  const { count } = writeFixtures('expDocInvoiceTerms', CASES, { api: API, notPorted: NOT_PORTED });
  expect(count).toBe(CASES.length);
});
