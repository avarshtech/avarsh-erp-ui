/**
 * Assembling a packing list from what it binds (expDocPlBlocks): its rows, numbered by
 * the buyer's rule (utils/expDocPlNumbering), in sections; and the blocks the workspace
 * shows. Assembly WRITES (create, refresh, add, remove, move, renumber); the blocks are
 * read-only decoration — opening a list never changes it.
 */
import { clone } from './expDocMockCommon';
import {
  poGroupsOf, unitsOfEntry, rowsOfUnit, blockOrderOf, takenBy, unitsOffered, unitKeyOf, soloKeyOf,
} from './expDocPlBlocks';
import { packingReadOf, PACKING_READ } from './expDocPackingMirror';
import { printedRows, DEFAULT_NUMBERING } from '../../utils/expDocPlNumbering';
import { matchPlan, planChip, subtractRanges } from '../../utils/expDocPlanMatch';
import { planRowsOf, planRangesOf } from './expDocPlPlan';
import { sectionTotals, mergeRanges } from '../../utils/expDocCalc';
import { poRefOf, poText } from '../../utils/expDocPoKeys';
import { SECTION_KEY, SECTION_TITLES, PL_STATUS } from '../../utils/expDocConstants';

const allRows = (pl) => (pl.sections || []).flatMap((s) => s.rows || []);
const shipmentOrderOf = (shipment, orderId) => (shipment?.orders || []).find((o) => o.orderId === orderId) || null;

/** A bound PO the shipment no longer carries still needs a group, so its cartons show (and V-20 flags them). */
const withRefGroups = (groups, refs) => {
  const out = [...groups];
  refs.forEach((r) => {
    if (r.poKey == null || out.some((g) => g.key === r.poKey)) return;
    const ref = poRefOf(r.poKey);
    out.push({ key: r.poKey, buyerPoNo: ref.buyerPoNo, destination: ref.destination, dispatchDate: null, orphan: true });
  });
  return out;
};

/**
 * Each block's PO groups, with the groups of POs the shipment no longer has but the list
 * still binds cartons or holds a buyer's plan for (flagged, never silently dropped).
 */
export const groupsByOrder = (pl, shipment) => {
  const out = new Map();
  blockOrderOf(pl, shipment).forEach((orderId) => {
    const refs = [...(pl.sourceRefs || []).filter((r) => r.orderId === orderId), ...planRowsOf(pl, orderId)];
    out.set(orderId, withRefGroups(poGroupsOf(shipmentOrderOf(shipment, orderId), pl.orderMeta?.[orderId]), refs));
  });
  return out;
};

/** The segments the list numbers through, in print order: blocks, then each block's POs. */
const segmentsOf = (order, groups) => order.flatMap((orderId) => (groups.get(orderId) || [])
  .map((g) => ({ orderId, poKey: g.key, buyerPoNo: g.buyerPoNo })));

/**
 * The rows the list's bound units give now. A unit whose entry this browser could not
 * read keeps the rows the list already holds for it: an unreadable entry is not a gone one.
 */
const boundRows = (pl, db, groups) => (pl.sourceRefs || []).flatMap((ref) => {
  const entry = (db.packingEntries || []).find((e) => e.id === ref.packingEntryId);
  if (!entry) {
    return allRows(pl).filter((r) => r.sourceEntryId === ref.packingEntryId && (r.poKey ?? null) === (ref.poKey ?? null));
  }
  const orderGroups = groups.get(ref.orderId) || [];
  const { units } = unitsOfEntry(entry, orderGroups, soloKeyOf(orderGroups, pl.orderMeta?.[ref.orderId]));
  const poGroup = orderGroups.find((g) => g.key === (ref.poKey ?? null)) || null;
  return rowsOfUnit(entry, ref.poKey ?? null, units.get(ref.poKey ?? null) || [], poGroup, pl.orderMeta?.[ref.orderId]);
});

/** Rows into the MAIN and EXTRA sections, each in print order. */
const sectionsOf = (rows) => [SECTION_KEY.MAIN, SECTION_KEY.EXTRA]
  .map((key, order) => ({
    key, title: SECTION_TITLES[key] || key, order, rows: rows.filter((r) => (r.sectionKey || SECTION_KEY.MAIN) === key),
  }))
  .filter((s) => s.rows.length);

/**
 * Rebuild the list from what it binds: rows, printed numbers, sections, block order,
 * order numbers and sizes. Writes onto `pl`; the caller saves.
 */
export const assemble = (pl, db, shipment) => {
  const order = blockOrderOf(pl, shipment);
  const groups = groupsByOrder(pl, shipment);
  const rows = printedRows(boundRows(pl, db, groups), segmentsOf(order, groups), {
    rule: pl.numbering || DEFAULT_NUMBERING,
    firstCartonNo: pl.firstCartonNo,
    // The buyer's plan, where there is one, gives its numbers
    plans: planRangesOf(pl),
  });
  pl.blockOrder = order;
  pl.sections = sectionsOf(rows);
  pl.orderNos = [...new Set(order.map((id) => shipmentOrderOf(shipment, id)?.orderNo
    ?? pl.orderMeta?.[id]?.orderNo ?? rows.find((r) => r.orderId === id)?.orderNo).filter(Boolean))];
  // Sizes in each order's preset order, then any a carton names beyond them
  const sizes = order.flatMap((id) => pl.orderMeta?.[id]?.sizes || []);
  rows.forEach((r) => Object.keys({ ...(r.sizeQty || {}), ...(r.ratio || {}) }).forEach((s) => sizes.push(s)));
  pl.sizes = [...new Set([...sizes, ...(pl.sizes || [])])];
  return pl;
};

/** The orders a list's numbers and offers depend on: its blocks and its bound units. */
export const ordersOfList = (pl, shipment) => blockOrderOf(pl, shipment);

/** The ordered quantities the list compares with: each order's lines for the POs this shipment carries. */
export const breakdownFor = (pl, shipment) => blockOrderOf(pl, shipment).flatMap((orderId) => {
  const meta = pl.orderMeta?.[orderId];
  if (!meta?.readable) return [];
  const ticked = shipmentOrderOf(shipment, orderId)?.pos || [];
  const keep = (line) => !ticked.length || ticked.some((p) => poText(p.buyerPoNo) === line.buyerPoNo
    && (poText(p.destination) ?? null) === (line.destination ?? null));
  return (meta.orderBreakdown || []).filter(keep).map((l) => ({ ...clone(l), sourceOrderNo: meta.orderNo }));
});

/**
 * The blocks as the workspace shows them: per order, per PO, its rows, its bound units,
 * and (on a draft) what Carton Packing has packed for it that the list could take.
 */
export const blocksOf = (pl, db, shipment) => {
  const groups = groupsByOrder(pl, shipment);
  const rows = allRows(pl);
  const boundKeys = new Set((pl.sourceRefs || []).map((r) => unitKeyOf(r.packingEntryId, r.poKey)));
  const taken = takenBy(db, pl.id);
  const excluded = new Set((pl.excludedUnits || []).map((u) => unitKeyOf(u.packingEntryId, u.poKey)));
  const draft = pl.status === PL_STATUS.DRAFT;
  // A shipment this browser could not read says nothing about what it carries: no block is orphaned for it
  const known = Boolean(shipment);
  return blockOrderOf(pl, shipment).map((orderId) => {
    const shipmentOrder = shipmentOrderOf(shipment, orderId);
    const meta = pl.orderMeta?.[orderId];
    const blockRows = rows.filter((r) => r.orderId === orderId);
    const offered = draft
      ? unitsOffered(db, orderId, groups.get(orderId) || [], { boundKeys, taken, excluded, meta }) : null;
    const planRows = planRowsOf(pl, orderId);
    const pos = (groups.get(orderId) || []).map((g) => {
      const poRows = blockRows.filter((r) => (r.poKey ?? null) === g.key);
      const refs = (pl.sourceRefs || []).filter((r) => r.orderId === orderId && (r.poKey ?? null) === g.key);
      const poPlan = planRows.filter((r) => (r.poKey ?? null) === g.key);
      const plan = poPlan.length ? matchPlan(poPlan, poRows) : null;
      const planned = mergeRanges(poPlan.map((r) => ({ from: Number(r.cartonFrom), to: Number(r.cartonTo) })));
      const asPlanned = (o) => Boolean(plan) && o.ownRanges.length > 0 && !subtractRanges(o.ownRanges, planned).length;
      return {
        plan,
        planChip: plan ? planChip(plan) : null,
        ...g,
        onShipment: !known || (Boolean(shipmentOrder) && !g.orphan),
        rows: poRows,
        totals: sectionTotals(poRows),
        units: refs.map((r) => ({
          packingEntryId: r.packingEntryId, packingNo: r.packingNo, packingDate: r.packingDate ?? null, poKey: r.poKey ?? null,
          cartons: sectionTotals(poRows.filter((x) => x.sourceEntryId === r.packingEntryId)).cartons,
        })),
        // An offer whose cartons fall inside the buyer's plan was packed as per this list
        offers: offered ? (offered.byGroup.get(g.key) || []).filter((o) => !o.excluded)
          .map((o) => ({ ...o, inPlan: asPlanned(o) })) : [],
        removed: offered ? (offered.byGroup.get(g.key) || []).filter((o) => o.excluded) : [],
      };
    });
    return {
      orderId,
      orderNo: shipmentOrder?.orderNo ?? meta?.orderNo ?? blockRows[0]?.orderNo ?? null,
      styleNo: shipmentOrder?.styleNo ?? meta?.styleNo ?? blockRows[0]?.styleNo ?? null,
      garmentName: meta?.garmentName ?? blockRows[0]?.garmentName ?? null,
      onShipment: !known || Boolean(shipmentOrder),
      unreadable: packingReadOf(orderId) === PACKING_READ.UNREADABLE,
      pos,
      unplaced: offered?.unplaced || [],
      totals: sectionTotals(blockRows),
      planRows,
      empty: !blockRows.length && !planRows.length && !pos.some((p) => p.offers.length),
    };
  });
};
