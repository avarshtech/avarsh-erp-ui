/**
 * The API's packing lists, mirrored in memory for the export rules that still run in the browser and
 * read `db.packingLists` synchronously: invoices, sticker runs, reports, the dashboard, the
 * notifications and the shipments' document counts. expDocStore lays the mirror over every load and
 * never saves it, so no list is kept in the browser: the server holds the only record and every
 * packing-list action goes to it (expDocService), its answer landing here at once (mirrorPutPl).
 *
 * - It holds every list at the user's branches (GET /export-docs/packing-lists/mirror), without
 *   blocks or revisions, under the names the browser's own record carried: the server's list, plus
 *   `buyerCode` (the commercial lookups' key) and `templateSnapshot` (the layout, the server's
 *   `template`).
 * - Fresh for 30 s; concurrent syncs share one request; a forced sync reloads now. A failed refresh
 *   keeps the last good copy and is not asked again for a few seconds. Never throws.
 * - A refresh never puts back an older copy of a list an action answered with meanwhile.
 * - Asked only by a user holding a view right the endpoint accepts. A new session or working branch
 *   starts it empty.
 */
import { getApiPlMirror } from './packingListApi';
import { buyerCodeOf } from './expDocMockData';
import { EXPDOC_MODULE } from '../../utils/expDocConstants';
import { hasPermission } from '../../utils/permissions';

/** The keys the API lets read the mirror; someone holding none never asks. */
const READ_KEYS = [EXPDOC_MODULE.SHIPMENTS, EXPDOC_MODULE.PACKING_LIST, EXPDOC_MODULE.INVOICE, EXPDOC_MODULE.STICKERS];

const TTL_MS = 30 * 1000;
const RETRY_MS = 5 * 1000;
// Every document read waits on a sync, so a hung API is given up on quickly
const QUIET = { silent: true, timeout: 10000 };

const empty = () => ({ at: 0, branch: null, rows: new Map(), failedAt: 0 });
let state = empty();
let pending = null;
// Bumped by every clear, so a refresh that started before a logout cannot put its rows back
let epoch = 0;
// The lists an action put or removed while a refresh was in flight: what it answered is newer
let touched = null;

/** The working branch, as axiosInstance sends it: a refresh is per branch. */
const workingBranch = () => {
  try {
    return localStorage.getItem('activeBranchId') || 'all';
  } catch {
    return 'all';
  }
};

/** A list as the browser modules read it: the old record's names on the server's list, its blocks left out. */
const shaped = (pl) => {
  const out = { ...pl, buyerCode: pl.buyerCode ?? buyerCodeOf(pl.buyerName), templateSnapshot: pl.template ?? null };
  delete out.blocks;
  delete out.revisions;
  return out;
};

const refresh = async () => {
  const started = epoch;
  const branch = workingBranch();
  touched = new Set();
  try {
    const lists = await getApiPlMirror(QUIET);
    if (started !== epoch) return;
    const rows = new Map(lists.map((pl) => [pl.id, shaped(pl)]));
    // An action that answered meanwhile holds the newer copy, or deleted the list
    touched.forEach((id) => {
      const held = state.rows.get(id);
      const fetched = rows.get(id);
      if (!held) rows.delete(id);
      else if (!fetched || Number(held.version) >= Number(fetched.version)) rows.set(id, held);
    });
    state = { at: Date.now(), branch, rows, failedAt: 0 };
  } finally {
    touched = null;
  }
};

/**
 * Makes the mirror fresh: within 30 s, or now when `force`d (after an action that changed lists the
 * answer does not hold). Never throws: when the API cannot be reached the modules read the last good copy.
 */
export const syncPlMirror = async ({ force = false } = {}) => {
  if (!READ_KEYS.some((key) => hasPermission(key, 'view'))) return;
  // One request at a time; whoever waited checks again once it lands
  while (pending) await pending;
  if (!force && Date.now() - state.failedAt < RETRY_MS) return;
  const stale = force || Date.now() - state.at >= TTL_MS || state.branch !== workingBranch();
  if (!stale) return;
  pending = refresh()
    .catch(() => { state.failedAt = Date.now(); })
    .finally(() => { pending = null; });
  await pending;
};

/** What loadDb() lays over `db.packingLists`, oldest first: copies, so a module can never edit the mirror. */
export const mirroredPackingLists = () => [...state.rows.values()].map((pl) => structuredClone(pl));

/** A list the API just answered with (any command, read or lifecycle action); returned as given. */
export const mirrorPutPl = (pl) => {
  if (pl?.id != null) {
    state.rows.set(pl.id, shaped(pl));
    touched?.add(pl.id);
  }
  return pl;
};

/** A list the API deleted. */
export const mirrorRemovePl = (id) => {
  state.rows.delete(Number(id));
  touched?.add(Number(id));
};

export const clearPlMirror = () => {
  epoch += 1;
  state = empty();
};

// A new session, or the server refusing the working branch, starts the mirror empty.
if (typeof window !== 'undefined') {
  window.addEventListener('authChange', clearPlMirror);
  window.addEventListener('erp:branch-reset', clearPlMirror);
}
