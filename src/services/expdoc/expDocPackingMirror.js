/**
 * The REAL Carton Packing entries (Production, /api/v1/packing/entries), mirrored in
 * memory for the packing lists that still run on the mock — the same arrangement as
 * the shipments (expDocShipmentMirror). loadDb() lays them over `db.packingEntries`
 * and saveDb() strips them, so no entry is ever kept in the browser.
 *
 * - Read per ORDER: a packing list takes the entries of its shipment's orders.
 * - Fresh for 30 s per order; concurrent syncs share one request. A failed read keeps
 *   the last good copy and is not asked again for a few seconds.
 * - Asked only with Carton Packing view: without it the order reads as UNREADABLE and
 *   the screens say so, rather than showing "nothing packed".
 * - The search covers the working branch (or every branch the user works in under "All
 *   branches"), so an entry missing from a read is deleted only when the read covered
 *   its branch (`readBranch`).
 * - A save on the Carton Packing screen puts the entry here at once (putPackingEntry).
 */
import { searchPackingEntries } from '../production/packingService';
import { hasPermission } from '../../utils/permissions';

export const PACKING_READ = { OK: 'OK', UNREADABLE: 'UNREADABLE' };

const TTL_MS = 30 * 1000;
const RETRY_MS = 5 * 1000;
const PAGE_SIZE = 200;
const QUIET = { silent: true, timeout: 10000 };

let orders = new Map(); // orderId -> { at, rows, read, branch }
let pending = new Map(); // orderId -> promise
let epoch = 0;

const workingBranch = () => {
  try {
    return localStorage.getItem('activeBranchId') || 'all';
  } catch {
    return 'all';
  }
};

export const canReadPacking = () => hasPermission('production-packing', 'view');

const readOrder = async (orderId) => {
  const started = epoch;
  const branch = workingBranch();
  const rows = [];
  try {
    for (let page = 0; ; page += 1) {
      const res = await searchPackingEntries({ orderId, page, size: PAGE_SIZE }, QUIET);
      rows.push(...(res.content || []));
      if (res.last !== false || !(res.content || []).length) break;
    }
    if (started === epoch) orders.set(orderId, { at: Date.now(), rows, read: PACKING_READ.OK, branch });
  } catch {
    if (started !== epoch) return;
    const prev = orders.get(orderId);
    orders.set(orderId, prev?.read === PACKING_READ.OK
      ? { ...prev, failedAt: Date.now() }
      : { at: 0, rows: [], read: PACKING_READ.UNREADABLE, branch, failedAt: Date.now() });
  }
};

/** Makes the entries of `orderIds` fresh (`force`: read again now, as Refresh asks). Never throws. */
export const syncPackingMirror = async (orderIds = [], { force = false } = {}) => {
  const wanted = [...new Set(orderIds.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  if (!wanted.length) return;
  if (!canReadPacking()) {
    wanted.forEach((id) => orders.set(id, { at: Date.now(), rows: [], read: PACKING_READ.UNREADABLE, branch: workingBranch() }));
    return;
  }
  const now = Date.now();
  await Promise.all(wanted.map((id) => {
    const held = orders.get(id);
    const fresh = !force && held && held.read === PACKING_READ.OK && now - held.at < TTL_MS
      && held.branch === workingBranch();
    const resting = held?.failedAt && now - held.failedAt < RETRY_MS;
    if (fresh || resting) return null;
    if (!pending.has(id)) pending.set(id, readOrder(id).finally(() => pending.delete(id)));
    return pending.get(id);
  }));
};

/** What loadDb() lays over `db.packingEntries`: copies, so a mock module can never edit the mirror. */
export const mirroredPackingEntries = () => [...orders.values()].flatMap((o) => o.rows.map((r) => structuredClone(r)));

/** How one order's entries were read: OK, UNREADABLE, or null when never asked. */
export const packingReadOf = (orderId) => orders.get(Number(orderId))?.read ?? null;

/** Whether the last read of an order covered `branchId`, so an entry absent from it is really gone. */
export const readCoversBranch = (orderId, branchId) => {
  const held = orders.get(Number(orderId));
  if (!held || held.read !== PACKING_READ.OK) return false;
  return held.branch === 'all' || branchId == null || String(held.branch) === String(branchId);
};

/** An entry the Carton Packing screen just saved. */
export const putPackingEntry = (entry) => {
  if (entry?.id == null || entry.orderId == null) return entry;
  const held = orders.get(Number(entry.orderId));
  if (held) {
    held.rows = [...held.rows.filter((r) => r.id !== entry.id), entry];
  }
  return entry;
};

export const removePackingEntry = (entry) => {
  const held = entry?.orderId != null ? orders.get(Number(entry.orderId)) : null;
  if (held) held.rows = held.rows.filter((r) => r.id !== entry.id);
};

export const clearPackingMirror = () => {
  epoch += 1;
  orders = new Map();
  pending = new Map();
};

if (typeof window !== 'undefined') {
  window.addEventListener('authChange', clearPackingMirror);
  window.addEventListener('erp:branch-reset', clearPackingMirror);
}
