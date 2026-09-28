/**
 * Job-work PO lines built from requirement cells — the one place a PO line takes its
 * shape, shared by the mock seed and by Add to Grid (Cut Panel PO) / Add selected
 * (Garment Process PO).
 *
 * Requirement fields are copied as read-only snapshots (CPP BR-02, GPO V8); `snapshot`
 * keeps the required qty and sequence as fetched, so a later requirement change can be
 * detected (CPP VR-20). `prevPoQty` is the allocation at fetch, for display.
 */
import { processLabel, sequenceGroupKey } from './cutPanelCalc';
import { gprLineLabel } from './garmentProcessCalc';

/** "Step n of m": how many process steps the line's fabric + colour + panel carries. */
export const cprStepCount = (cpr, line) => cpr.lines.filter((l) => sequenceGroupKey(l) === sequenceGroupKey(line)).length;

/** Cut Panel PO line (PRD §10.2): one CPR line × size; PO qty defaults to the balance (FR-13). */
export const cppLineFromCpr = ({ key, cpr, line, size, order, prevPoQty = 0, uom = 'PIECE' }) => {
  const required = Number(line.sizes?.[size]?.requiredQty) || 0;
  return {
    key, cprId: cpr.id, cprNo: cpr.cprNo, cprLineKey: line.key, size,
    orderId: cpr.orderId, orderNo: cpr.orderNo, buyer: cpr.buyer, styleNo: cpr.styleNo,
    garment: order?.garmentDescription ?? null, fabricName: line.fabricName,
    colorName: line.colorName, colorHex: line.colorHex, panelName: line.panelName,
    processLabel: processLabel(line), sequenceNo: line.sequenceNo, stepCount: cprStepCount(cpr, line),
    required, prevPoQty, snapshot: { required, sequenceNo: line.sequenceNo },
    poQty: Math.max(0, required - prevPoQty), uom, billingQty: null,
    rate: null, rateReasonCode: null, rateRemark: '', receivedQty: 0,
  };
};

/** Garment Process PO line (PRD §8.2): one GPR line × colour × size; PO qty defaults to the balance. */
export const gpoLineFromGpr = ({ key, gpr, line, color, size, order, prevPoQty = 0, uom = 'PIECE' }) => {
  const required = Number(line.qty?.[color]?.[size]) || 0;
  return {
    key, gprId: gpr.id, gprNo: gpr.requirementNo, gprLineKey: line.key, color, size,
    colorHex: order?.colors?.find((c) => c.name === color)?.hex ?? null,
    orderId: gpr.orderId, orderNo: gpr.orderNo, buyer: gpr.buyer, styleNo: gpr.styleNo,
    processLabel: gprLineLabel(line), seqNo: line.seqNo,
    required, prevPoQty, snapshot: { required, seqNo: line.seqNo },
    poQty: Math.max(0, required - prevPoQty), uom, billingQty: null, rate: null, excess: null, receivedQty: 0,
  };
};

/**
 * The PO's process as it is snapshotted on the PO (CPP §11.2 tax code / rate, FR-16 UOM,
 * FR-22 instructions): the live master row matched by name within the category, or the
 * job-work defaults when the master is not readable. `option` = { label, processName, otherName }.
 */
export const processSnapshot = (option, masterProcesses, category) => {
  const m = (masterProcesses || []).find((p) => p.processName === option.processName);
  return {
    id: m?.id ?? null, name: option.processName, label: option.label, otherName: option.otherName ?? null, category,
    sacCode: m?.sacCode ?? '998821', gstRatePercent: m?.gstRatePercent ?? 5, defaultUom: m?.defaultUom ?? 'PIECE',
    artworkRequired: Boolean(m?.artworkRequired), defaultInstructions: m?.defaultInstructions ?? '', fromMaster: Boolean(m),
  };
};

/** The PO with its vendor snapshot re-taken from the live supplier, when the screen has one (FR-20). */
export const withLiveVendor = (doc, liveVendor) => (liveVendor ? { ...doc, vendor: vendorSnapshot(liveVendor) } : doc);

/** The live supplier no longer matches the PO's snapshot (approval renewed, processes changed…). */
export const vendorChanged = (doc, liveVendor) => Boolean(liveVendor) && JSON.stringify(vendorSnapshot(liveVendor)) !== JSON.stringify(doc.vendor);

/** The snapshot a PO keeps of its supplier (CPP FR-20), refreshed on every save until approval. */
export const vendorSnapshot = (v) => ({
  id: v.id, name: v.name, gstin: v.gstin, stateCode: v.stateCode, igstApplicable: Boolean(v.igstApplicable),
  address: v.address, city: v.city, state: v.state, pincode: v.pincode, contactPerson: v.contactPerson,
  phone: v.phone, email: v.email, paymentTerms: v.paymentTerms, jobWorker: v.jobWorker, active: v.active !== false,
  processIds: v.processIds || [], jobWorkApprovedUntil: v.jobWorkApprovedUntil || null,
});
