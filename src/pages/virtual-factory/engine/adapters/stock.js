import { fabricColour } from '../colours.js';
import { dayOf, first, num, sum, text } from '../util.js';

/** One FabricStockResponse row (/inventory/stock/fabric): an item + colour lot and its rolls. */
export const adaptFabricLot = (raw) => ({
  key: text(first(raw.id, `${raw.itemCode}-${raw.variantCode}-${raw.grnNumber}`)),
  item: text(first(raw.fabricDescription, raw.variantName, raw.itemCode)),
  code: text(raw.itemCode),
  colour: text(raw.color),
  hex: fabricColour(raw.color),
  qty: num(raw.totalQty),
  uom: text(raw.uom),
  rolls: (raw.rolls || []).length,
  shadeLots: [...new Set((raw.rolls || []).map((r) => text(r.shadeLot)).filter(Boolean))],
  orderRef: text(raw.orderRef),
  style: text(raw.style),
  supplier: text(raw.supplier),
  grnNo: text(raw.grnNumber),
  grnDate: dayOf(raw.grnDate),
});

export const adaptFabricStock = (page) => (page?.content || []).map(adaptFabricLot).filter((lot) => lot.qty > 0);

/** One accessories stock row (/inventory/stock/accessories). */
export const adaptTrimLot = (raw) => ({
  key: text(first(raw.id, raw.itemCode)),
  item: text(first(raw.description, raw.itemCode)),
  category: text(raw.category),
  qty: num(raw.totalQty) || sum(raw.variants, (v) => v.qty),
  uom: text(first(raw.uom, raw.variants?.[0]?.uom)),
  orderRef: text(raw.orderRef),
});

export const adaptTrimStock = (page) => (page?.content || []).map(adaptTrimLot).filter((lot) => lot.qty > 0);

/**
 * Stock-by-BOM rows (/production/stock-by-bom/{bomId}) for one order: every row whose available
 * balance falls short of the CAD requirement (shortageSurplus = available − required).
 */
export const adaptShortages = (order, kind, rows) => (rows || [])
  .filter((row) => num(row.shortageSurplus) < 0 && num(row.cadRequired) > 0)
  .map((row) => ({
    key: `${order.orderNo}|${kind}|${text(first(row.key, row.variantCode, row.itemCode))}`,
    orderId: order.id,
    orderNo: text(order.orderNo),
    style: text(order.styleNo),
    due: dayOf(order.deliveryDate),
    kind,
    item: text(first(row.itemName, row.variantName, row.itemCode)),
    colour: text(row.variantName),
    required: num(row.cadRequired),
    available: Math.max(0, num(row.availableBalance)),
    short: -num(row.shortageSurplus),
    uom: text(first(row.stockUom, row.reqUom, row.uom)),
    poNo: text(row.poNumber),
  }));

/** One MaterialIssueResponse row (/material-issues): fabric to cutting or trims to sewing. */
export const adaptIssue = (raw) => ({
  id: raw.id,
  no: text(raw.issueNumber),
  type: text(raw.issueType).toUpperCase() === 'ACCESSORY' ? 'ACCESSORY' : 'FABRIC',
  sourceType: text(raw.sourceType),
  orderNo: text(raw.orderNo),
  style: text(raw.style),
  buyer: text(raw.buyerName),
  date: dayOf(raw.issueDate),
  fabric: text(raw.fabric),
  colour: text(raw.items?.[0]?.color),
  rolls: num(raw.rollsIssued),
  qty: num(first(raw.totalWeight, raw.totalQty)),
  uom: text(raw.uom),
  status: text(raw.status),
  createdAt: text(raw.createdAt),
});

export const adaptIssues = (page) => (page?.content || []).map(adaptIssue)
  .filter((issue) => issue.no && issue.status !== 'CANCELLED' && issue.sourceType !== 'SAMPLE_REQUEST');
