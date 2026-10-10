/**
 * The API's shipments, mirrored in memory for the export documents that still run on
 * the mock.
 *
 * Packing lists, invoices, stickers, reports, the dashboard and the notifications are
 * mock modules that read `db.shipments` synchronously. loadDb() lays this mirror over
 * the stored db and saveDb() strips it again (expDocMockStore), so no shipment is ever
 * kept in the browser: the API holds the only record. The facade syncs the mirror
 * before each mock call that reads shipments.
 *
 * - It holds the OPEN shipments of the working branch, plus every shipment a document
 *   in this browser names (any status, any of the user's branches).
 * - It is fresh for 30 s, and concurrent syncs share one request. A failed refresh
 *   keeps the last good copy.
 * - Saves, closes, reopens and deletes write it at once, so a document never waits
 *   for the next refresh.
 * - A shipment the API no longer returns is simply absent, and every reader already
 *   treats a missing shipment as "none".
 * - A new session or working branch starts it empty.
 */
import { searchApiShipments } from './shipmentApi';
import { buyerCodeOf } from './expDocMockData';
import { EXPDOC_MODULE, SHIPMENT_STATUS } from '../../utils/expDocConstants';
import { hasPermission } from '../../utils/permissions';

/** The keys the API lets read a shipment; someone holding none never asks. */
const READ_KEYS = [EXPDOC_MODULE.SHIPMENTS, EXPDOC_MODULE.PACKING_LIST, EXPDOC_MODULE.INVOICE, EXPDOC_MODULE.STICKERS];

const TTL_MS = 30 * 1000;
const RETRY_MS = 5 * 1000;
const PAGE_SIZE = 200;
// Every document read waits on a sync, so a hung API is given up on quickly
const QUIET = { silent: true, timeout: 10000 };

const empty = () => ({ at: 0, branch: null, rows: new Map(), missing: new Set(), failedAt: 0 });
let state = empty();
let pending = null;
// Bumped by every clear, so a refresh that started before a logout cannot put its rows back
let epoch = 0;

/** The working branch, as axiosInstance sends it: a refresh is per branch. */
const workingBranch = () => {
  try {
    return localStorage.getItem('activeBranchId') || 'all';
  } catch {
    return 'all';
  }
};

/** A row as the mock modules read it: the API record, plus the buyer code their commercial lookups take. */
const shaped = (s) => ({ ...s, buyerCode: s.buyerCode ?? buyerCodeOf(s.buyerName) });

const fetchByIds = async (ids) => {
  if (!ids.length) return [];
  const found = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const page = await searchApiShipments({ ids: ids.slice(i, i + PAGE_SIZE), size: PAGE_SIZE }, QUIET);
    found.push(...page.content);
  }
  return found;
};

const refresh = async (ids) => {
  const started = epoch;
  const branch = workingBranch();
  const open = await searchApiShipments({ status: SHIPMENT_STATUS.OPEN, size: PAGE_SIZE }, QUIET);
  const rows = new Map(open.content.map((s) => [s.id, shaped(s)]));
  const named = await fetchByIds(ids.filter((id) => !rows.has(id)));
  named.forEach((s) => rows.set(s.id, shaped(s)));
  if (started !== epoch) return;
  state = { at: Date.now(), branch, rows, missing: new Set(ids.filter((id) => !rows.has(id))), failedAt: 0 };
};

const addNamed = async (ids) => {
  const started = epoch;
  const named = await fetchByIds(ids);
  if (started !== epoch) return;
  named.forEach((s) => state.rows.set(s.id, shaped(s)));
  ids.filter((id) => !state.rows.has(id)).forEach((id) => state.missing.add(id));
};

/**
 * Makes the mirror fresh, and sure to hold every shipment in `ids` that still exists.
 * Never throws: when the API cannot be reached the mock modules read the last good
 * copy, and nobody asks again for a few seconds.
 */
export const syncShipmentMirror = async (ids = []) => {
  if (!READ_KEYS.some((key) => hasPermission(key, 'view'))) return;
  const wanted = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  // One request at a time; whoever waited checks again once it lands
  while (pending) await pending;
  if (Date.now() - state.failedAt < RETRY_MS) return;
  const stale = Date.now() - state.at >= TTL_MS || state.branch !== workingBranch();
  const unknown = wanted.filter((id) => !state.rows.has(id) && !state.missing.has(id));
  if (!stale && !unknown.length) return;
  pending = (stale ? refresh(wanted) : addNamed(unknown))
    .catch(() => { state.failedAt = Date.now(); })
    .finally(() => { pending = null; });
  await pending;
};

/** What loadDb() lays over `db.shipments`: copies, so a mock module can never edit the mirror. */
export const mirroredShipments = () => [...state.rows.values()].map((s) => structuredClone(s));

/** One mirrored shipment, or null. */
export const mirroredShipment = (id) => {
  const row = state.rows.get(Number(id));
  return row ? structuredClone(row) : null;
};

/** A shipment the API just returned — saved, closed or reopened. */
export const mirrorPut = (shipment) => {
  if (shipment?.id != null) {
    state.rows.set(shipment.id, shaped(shipment));
    state.missing.delete(shipment.id);
  }
  return shipment;
};

export const mirrorRemove = (id) => {
  state.rows.delete(Number(id));
};

export const clearShipmentMirror = () => {
  epoch += 1;
  state = empty();
};

// A new session, or the server refusing the working branch, starts the mirror empty.
if (typeof window !== 'undefined') {
  window.addEventListener('authChange', clearShipmentMirror);
  window.addEventListener('erp:branch-reset', clearShipmentMirror);
}
