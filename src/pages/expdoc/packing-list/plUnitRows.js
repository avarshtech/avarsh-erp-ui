import { formatRanges } from '../../../utils/expDocCalc';

/**
 * Rows for choosing cartons: one per Carton Packing entry and buyer PO, from what the
 * service offers per order and PO (listBindableForShipment, or a block's offers). Pure.
 */

/** "PO 4500123 · Hamburg DC", or the order itself when it has no PO numbers. */
export const poLabelOf = (po) => (po?.key == null
  ? 'Whole order'
  : ['PO', po.buyerPoNo, po.destination ? `· ${po.destination}` : null].filter(Boolean).join(' '));

export const unitRowsOf = (orders = []) => orders.flatMap((o) => (o.pos || []).flatMap((po) => (po.units || []).map((u) => ({
  ...u,
  key: `${u.packingEntryId}|${u.poKey ?? ''}`,
  orderNo: o.orderNo,
  poLabel: poLabelOf(po),
}))));

/** Cartons Carton Packing has not given a PO, on orders with several: named so they can be fixed there. */
export const unplacedText = (orders = []) => {
  const parts = orders.flatMap((o) => (o.unplaced || []).map((u) => `${u.packingNo} cartons ${
    formatRanges(u.groups.map((g) => ({ from: Number(g.cartonFrom), to: Number(g.cartonTo) })))} (${o.orderNo})`));
  return parts.length
    ? `${parts.join('; ')} name no buyer PO, and their order has several. Pick the PO in Carton Packing to bring them in.`
    : null;
};
