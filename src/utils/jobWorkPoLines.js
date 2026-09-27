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
    poQty: Math.max(0, required - prevPoQty), uom, rate: null, excess: null, receivedQty: 0,
  };
};
