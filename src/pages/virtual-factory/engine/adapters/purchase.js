import { dayOf, first, num, sum, text } from '../util.js';

/**
 * Where a supplier PO sits on its journey, from its status (mirrors POStatus):
 * raised at the office → waiting approval → approved and sent → material arriving → in the store.
 */
export const PO_STAGE = {
  Draft: 'raised', Referred_Back: 'raised', Pending_Approval: 'approval', Sent_To_Supplier: 'sent',
  Partially_Received: 'receiving', Completed: 'received', Rejected: 'closed', Cancelled: 'closed',
};

const colourOf = (line) => {
  const attrs = line.variantAttributes || {};
  const key = Object.keys(attrs).find((k) => /colou?r|shade/i.test(k));
  return text(first(key ? attrs[key] : null, line.variantName));
};

const adaptPoLine = (line) => ({
  item: text(first(line.itemName, line.description, line.itemCode)),
  code: text(line.itemCode),
  category: text(line.categoryName),
  isFabric: /fabric/i.test(line.categoryName || ''),
  qty: num(line.quantity),
  uom: text(first(line.uomSymbol, line.uomName)),
  colour: colourOf(line),
  status: text(line.status),
});

const approvedAt = (activities) => (activities || [])
  .filter((a) => a.status === 'Sent_To_Supplier')
  .map((a) => text(a.createdAt))
  .sort()[0] || null;

/** One PurchaseOrderDTO row from /purchase-orders/search. */
export const adaptPurchaseOrder = (raw) => {
  const lines = (raw.lineItems || []).filter((l) => l.status !== 'Cancelled').map(adaptPoLine);
  const lead = lines.find((l) => l.isFabric) || lines[0] || null;
  return {
    id: raw.id,
    no: text(raw.poNumber),
    status: text(raw.status),
    stage: PO_STAGE[raw.status] || 'raised',
    supplier: text(raw.supplierName),
    poType: text(raw.poType),
    poDate: dayOf(raw.poDate),
    due: dayOf(raw.revisedDeliveryDate) || dayOf(raw.deliveryDate),
    total: num(raw.grandTotal),
    approvedAt: approvedAt(raw.activities),
    lines,
    material: lead ? lead.item : '',
    materialColour: lead ? lead.colour : '',
    isFabric: lines.some((l) => l.isFabric),
    qty: lead ? sum(lines.filter((l) => l.uom === lead.uom), (l) => l.qty) : 0,
    uom: lead ? lead.uom : '',
    orderRefs: (raw.orderReferences || [])
      .map((ref) => ({ orderId: ref.orderId ?? null, orderNo: text(ref.orderNo) }))
      .filter((ref) => ref.orderNo),
  };
};

export const adaptPurchaseOrders = (page) => (page?.content || []).map(adaptPurchaseOrder).filter((po) => po.no);

/** One GRNResponse row from /grns. */
export const adaptGrn = (raw) => ({
  id: raw.id,
  no: text(raw.grnNumber),
  date: dayOf(raw.grnDate),
  type: /trim|access/i.test(text(first(raw.type, raw.grnType))) ? 'Trims' : 'Fabric',
  poNo: text(raw.poNumber),
  supplier: text(raw.supplier),
  buyer: text(raw.buyerName),
  style: text(raw.styleNumber),
  vehicle: text(raw.vehicleNumber),
  transporter: text(raw.transporter),
  status: text(raw.status),
  createdAt: text(raw.createdAt),
});

export const adaptGrns = (page) => (page?.content || []).map(adaptGrn).filter((g) => g.no && g.status !== 'Cancelled');

/** One QCResponse row from /qc (fabric inspection). */
export const adaptQc = (raw) => ({
  id: raw.id,
  no: text(raw.qcNumber),
  grnNo: text(raw.grnNumber),
  status: text(raw.status),
  result: text(raw.overallResult),
  date: dayOf(raw.inspectionDate),
  fabric: text(raw.fabricDescription),
  rolls: num(raw.rollCount),
  rollsPassed: num(raw.rollsPassed),
  rollsFailed: num(raw.rollsFailed),
});

export const adaptQcList = (page) => (page?.content || []).map(adaptQc).filter((q) => q.no);
