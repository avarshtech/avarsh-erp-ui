/**
 * Mock master-data endpoints for the SR module (future /sample-requests/masters/*).
 * Sample types are user-maintainable through the creatable combobox (PRD §8.2 B);
 * the rest are read-only lists in this phase.
 */
import { loadDb } from './srMockStore';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

export const listSampleTypes = async () => {
  await delay();
  return clone(loadDb().masters.sampleTypes.filter((t) => t.active !== false));
};

export const listCouriers = async () => {
  await delay();
  return clone(loadDb().masters.couriers);
};

export const listBuyingOffices = async () => {
  await delay();
  return clone(loadDb().masters.buyingOffices);
};

export const listRejectionReasons = async () => {
  await delay();
  return clone(loadDb().masters.rejectionReasonCodes);
};

/** Per-buyer label set when configured, else the global default (PRD §8.5). */
export const getFeedbackCategoryLabels = async (buyerName) => {
  await delay();
  const sets = loadDb().masters.feedbackCategories;
  const match = sets.find((s) => s.buyerName && buyerName && s.buyerName.toLowerCase() === buyerName.toLowerCase());
  return clone((match || sets.find((s) => !s.buyerName) || sets[0]).labels);
};

export const listHsnCodes = async () => {
  await delay();
  return clone(loadDb().masters.hsnCodes);
};

export const getHsnDefault = async (category) => {
  const codes = await listHsnCodes();
  const hit = codes.find((c) => category && c.category.toLowerCase() === String(category).toLowerCase());
  return (hit || codes.find((c) => c.category === 'Default') || {}).code || '';
};

/** IEC / SWIFT / declaration / signatory — the fields organisation-info lacks. */
export const getCompanyProfileExtra = async () => {
  await delay();
  return clone(loadDb().masters.companyProfileExtra);
};

/**
 * Deterministic indicative stock status (enhancement #1 — PRD keeps live stock
 * out of v1; "indicative only"). Hash of the description keeps the demo stable
 * across reloads. Swap point → real inventory availability endpoint.
 */
export const getStockStatus = (materialLine, requiredQty = 0) => {
  const key = `${materialLine?.description || ''}|${materialLine?.classification || ''}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) % 997;
  const available = (h % 40) * 5; // 0..195 in steps of 5
  if (available <= 0) return { status: 'OUT_OF_STOCK', available };
  if (requiredQty && available < requiredQty) return { status: 'SHORTFALL', available };
  return { status: 'IN_STOCK', available };
};
