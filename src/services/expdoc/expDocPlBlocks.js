/**
 * A packing list as BLOCKS (owner, 2026-10-09/10): one block per order (style) of its
 * shipment, in the list's own order, and inside each block one group per buyer PO the
 * shipment carries. Cartons come from the REAL Carton Packing entries of the order
 * (expDocPackingMirror); the list never edits them.
 *
 * The unit a list takes is "an entry's cartons for one PO" (entry x PO): one packing day
 * of an order can hold cartons for POs going on different shipments, and each list
 * takes only its own. A unit sits on one live list at a time.
 *
 * A carton range names its PO by number (Carton Packing's PO pick-list), plus the
 * destination when the order has the same PO for two. A range with no PO belongs to the
 * ORDER's only PO (judged from the order, not from what the shipment ticked); on an order
 * with several it cannot be placed until Carton Packing names it.
 */
import { decorateEntry } from '../../utils/packingEntryIssues';
import { poKey, poText } from '../../utils/expDocPoKeys';
import { PL_STATUS } from '../../utils/expDocConstants';

const LIVE = [PL_STATUS.DRAFT, PL_STATUS.FINAL, PL_STATUS.EXPORTED];
/** A range that names a PO this shipment does not carry. */
export const ELSEWHERE = Symbol('elsewhere');

export const unitKeyOf = (entryId, key) => `${entryId}|${key ?? ''}`;

/**
 * The PO groups of one order on the shipment: the POs the shipment ticked; none ticked
 * means every PO of the order (a shipment saved before POs); an order without PO numbers
 * is one whole-order group (key null).
 */
export const poGroupsOf = (shipmentOrder, meta) => {
  const ticked = shipmentOrder?.pos || [];
  const all = meta?.readable ? meta.pos || [] : [];
  const list = ticked.length ? ticked : all;
  if (!list.length) return [{ key: null, buyerPoNo: null, destination: null, dispatchDate: null }];
  return list.map((p) => ({
    key: poKey(p), buyerPoNo: poText(p.buyerPoNo), destination: poText(p.destination), dispatchDate: p.dispatchDate ?? null,
  }));
};

/**
 * Where a range that names no PO goes: the order's only PO when the order (read from the
 * orders API) has exactly one — ELSEWHERE if this shipment does not carry it — else
 * undefined: it cannot be placed.
 */
export const soloKeyOf = (poGroups, meta) => {
  if (poGroups.length === 1 && poGroups[0].key === null) return null;
  const pos = meta?.readable ? meta.pos || [] : null;
  if (!pos || pos.length !== 1) return undefined;
  const key = poKey(pos[0]);
  return poGroups.some((g) => g.key === key) ? key : ELSEWHERE;
};

/** Which PO group a carton range belongs to: its key, undefined (cannot tell), or ELSEWHERE. */
export const attributeRange = (group, poGroups, solo = undefined) => {
  if (poGroups.length === 1 && poGroups[0].key === null) return null;
  const po = poText(group.buyerPoNo);
  if (!po) return solo;
  const sameNo = poGroups.filter((g) => g.buyerPoNo === po);
  const dest = poText(group.destination);
  // The same PO to a destination this shipment did not tick goes on another shipment
  if (sameNo.length === 1) return dest && sameNo[0].destination && dest !== sameNo[0].destination ? ELSEWHERE : sameNo[0].key;
  if (!sameNo.length) return ELSEWHERE;
  const hit = sameNo.find((g) => (g.destination ?? null) === dest);
  return hit ? hit.key : undefined;
};

/** An entry's ranges split by PO group, plus the ranges with no PO it can tell. */
export const unitsOfEntry = (entry, poGroups, solo = undefined) => {
  const units = new Map();
  const unplaced = [];
  (entry.groups || []).forEach((g) => {
    const key = attributeRange(g, poGroups, solo);
    if (key === ELSEWHERE) return;
    if (key === undefined) { unplaced.push(g); return; }
    if (!units.has(key)) units.set(key, []);
    units.get(key).push(g);
  });
  return { units, unplaced };
};

/** The rows one unit puts on a list: copies of its ranges, with a stable id and where they came from. */
export const rowsOfUnit = (entry, key, groups, poGroup, meta) => {
  const seen = new Map();
  return groups.map((g) => {
    const base = `${entry.id}:${key ?? '-'}:${g.sectionKey || 'MAIN'}:${g.cartonFrom}-${g.cartonTo}`;
    const n = (seen.get(base) || 0) + 1;
    seen.set(base, n);
    return {
      ...structuredClone(g),
      // Stable across saves: the API renews group ids every time an entry is saved
      id: n > 1 ? `${base}#${n}` : base,
      ownFrom: g.cartonFrom,
      ownTo: g.cartonTo,
      orderId: entry.orderId,
      orderNo: entry.orderNo ?? meta?.orderNo ?? null,
      poKey: key,
      buyerPoNo: poText(g.buyerPoNo) ?? poGroup?.buyerPoNo ?? null,
      destination: poText(g.destination) ?? poGroup?.destination ?? null,
      styleNo: g.styleNo || entry.styleNo || meta?.styleNo || null,
      garmentName: entry.garmentName ?? meta?.garmentName ?? null,
      compositionText: entry.compositionText ?? meta?.compositionText ?? null,
      sourceEntryId: entry.id,
      sourceEntryNo: entry.packingNo,
      sourceGroupId: g.id,
      packingDate: entry.packingDate ?? null,
    };
  });
};

/** The list's blocks in order: its own order first, then orders added to the shipment since. */
export const blockOrderOf = (pl, shipment) => {
  const onShipment = (shipment?.orders || []).map((o) => o.orderId);
  const bound = (pl.sourceRefs || []).map((r) => r.orderId);
  const out = [];
  [...(pl.blockOrder || []), ...onShipment, ...bound].forEach((id) => {
    if (id != null && !out.includes(id)) out.push(id);
  });
  return out;
};

/** Units (entry x PO) on another live list, by key, with that list's number. */
export const takenBy = (db, exceptPlId) => {
  const out = new Map();
  (db.packingLists || [])
    .filter((p) => p.id !== exceptPlId && LIVE.includes(p.status))
    .forEach((p) => (p.sourceRefs || []).forEach((r) => out.set(unitKeyOf(r.packingEntryId, r.poKey), p.plNo)));
  return out;
};

/**
 * The cartons an order offers a list, per PO group: each unit with whether it can be
 * taken and why not. `boundKeys` are the units already on this list.
 */
export const unitsOffered = (db, orderId, poGroups, {
  boundKeys = new Set(), taken = new Map(), excluded = new Set(), meta = null,
} = {}) => {
  const byGroup = new Map(poGroups.map((g) => [g.key, []]));
  const unplaced = [];
  const solo = soloKeyOf(poGroups, meta);
  (db.packingEntries || []).filter((e) => e.orderId === orderId).forEach((entry) => {
    const dec = decorateEntry(entry);
    const { units, unplaced: loose } = unitsOfEntry(entry, poGroups, solo);
    if (loose.length) unplaced.push({ entryId: entry.id, packingNo: entry.packingNo, groups: loose });
    units.forEach((groups, key) => {
      const unitKey = unitKeyOf(entry.id, key);
      if (boundKeys.has(unitKey) || !byGroup.has(key)) return;
      const decRows = decorateEntry({ ...entry, groups });
      const blockedBy = taken.get(unitKey);
      byGroup.get(key).push({
        packingEntryId: entry.id,
        packingNo: entry.packingNo,
        packingDate: entry.packingDate ?? null,
        status: entry.status,
        orderId,
        poKey: key,
        cartons: decRows.totals.cartons,
        pieces: decRows.totals.pieces,
        rows: groups.length,
        // The entry's own numbers: whether it was packed as per the buyer's plan
        ownRanges: groups.map((g) => ({ from: Number(g.cartonFrom), to: Number(g.cartonTo) })),
        excluded: excluded.has(unitKey),
        onList: blockedBy ?? null,
        bindable: !blockedBy && dec.errorCount === 0,
        bindWarning: entry.status !== 'COMPLETED' ? 'Packing entry is not marked complete.' : null,
        blockedReason: blockedBy ? `On ${blockedBy}.` : (dec.errorCount > 0 ? `${dec.errorCount} structural error(s) to fix in Carton Packing.` : null),
      });
    });
  });
  return { byGroup, unplaced };
};
