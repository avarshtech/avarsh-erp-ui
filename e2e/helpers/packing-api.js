/**
 * Carton Packing entries made through the API for the export-docs specs: packing lists
 * bind the REAL entries (on the server), not seeded demo ones.
 *
 * Every entry carries a marker in its composition, so one a failed run left behind on a
 * long-lived stack is found and removed first (purgeMarked), and a spec deletes what it
 * made at the end. The orders must be CONFIRMED or IN_PRODUCTION (PackingEntryService).
 * An entry on a live packing list cannot be deleted, so both take it off its lists first
 * (export-documents-api releaseEntries).
 */
import { releaseEntries } from './export-documents-api.js';

export const E2E_PACKING_MARK = 'E2E packing fixture';

const today = () => new Date().toISOString().slice(0, 10);

/** One carton range, filled so the entry has no structural error. */
export const range = (over = {}) => ({
  sectionKey: 'MAIN', packingType: 'SOLID', cartonFrom: 1, cartonTo: 1, sizeQty: { M: 10 },
  netWeightKg: 10, grossWeightKg: 11, lengthCm: 60, breadthCm: 40, heightCm: 35, ...over,
});

export const orderIdOf = async (api, orderNo) => {
  const { data } = await api.get('/orders/search', { search: orderNo, page: 0, size: 10 });
  const hit = (data?.content || []).find((o) => o.orderNo === orderNo);
  if (!hit) throw new Error(`order ${orderNo} not found`);
  return hit.id;
};

/** Create (and by default complete) an entry; `packingDate` defaults to today. */
export const createEntry = async (api, {
  orderId, groups, sizes = ['M', 'L', 'XL', 'XXL'], packingDate = today(), complete = true,
}) => {
  const res = await api.post('/packing/entries', {
    orderId, packingDate, compositionText: E2E_PACKING_MARK, sizes, orderBreakdown: [], groups,
  });
  if (res.status >= 300) throw new Error(`packing entry failed: ${res.status} ${JSON.stringify(res.data)}`);
  if (!complete) return res.data;
  const done = await api.post(`/packing/entries/${res.data.id}/complete`, { version: res.data.version });
  if (done.status >= 300) throw new Error(`packing entry complete failed: ${done.status} ${JSON.stringify(done.data)}`);
  return done.data;
};

/** Delete an entry a spec made, taken off the packing lists holding it first. */
export const deleteEntry = async (api, id) => {
  await releaseEntries(api, [id]);
  return api.delete(`/packing/entries/${id}`);
};

/** Remove the marked entries of an order a previous run left behind, and the packing lists holding them. */
export const purgeMarked = async (api, orderId) => {
  const { data } = await api.get('/packing/entries', { orderId, page: 0, size: 200 });
  const marked = (data?.content || []).filter((x) => x.compositionText === E2E_PACKING_MARK);
  if (marked.length) await releaseEntries(api, marked.map((e) => e.id));
  for (const e of marked) await api.delete(`/packing/entries/${e.id}`);
};

/** The old demo entry's cartons (1–61, every packing type), as a real entry carries them: no EANs. */
export const referenceRanges = () => [
  range({
    cartonFrom: 1, cartonTo: 47, danNo: 'DAN-4471', buyerPoNo: 'PO-884213', destination: 'Rotterdam', colorName: 'Navy',
    sizeQty: { M: 10, L: 20, XL: 30 }, netWeightKg: 12.48, grossWeightKg: 13.5,
  }),
  range({
    packingType: 'RATIO', cartonFrom: 48, cartonTo: 57, danNo: 'DAN-4472', buyerPoNo: 'PO-884213', destination: 'Rotterdam',
    colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: null, ratio: { M: 1, L: 2, XL: 2, XXL: 1 }, assortmentsPerCarton: 4,
    netWeightKg: 9.2, grossWeightKg: 10, heightCm: 30,
  }),
  range({
    packingType: 'MIXED', cartonFrom: 58, cartonTo: 60, danNo: 'DAN-4473', buyerPoNo: 'PO-884213', destination: 'Rotterdam',
    sizeQty: null, mixedRows: [{ colorName: 'Navy', sizeQty: { M: 5, L: 5 } }, { colorName: 'Flame Scarlet 18-1662 TCX', sizeQty: { M: 3, L: 2 } }],
    netWeightKg: 7, grossWeightKg: 7.8, lengthCm: 50, breadthCm: 30, heightCm: 25,
  }),
  range({
    sectionKey: 'EXTRA', packingType: 'EXTRA', cartonFrom: 61, cartonTo: 61, danNo: 'DAN-4474', buyerPoNo: 'PO-884213',
    destination: 'Rotterdam', colorName: 'Navy', sizeQty: { M: 3, L: 4 }, netWeightKg: 2.005, grossWeightKg: 2.5,
    lengthCm: 40, breadthCm: 30, heightCm: 20,
  }),
];
