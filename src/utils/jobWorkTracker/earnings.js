/**
 * Stage-wise pay for pulled-back, partly-done pieces (decisions 12–14, plan 1e "Stage shares").
 * A CMT vendor's Work Order carries cutting / stitching / finishing shares and its Cutting PO's rate
 * is nominal (not billed); a vendor that did not cut carries stitching / finishing only. Finishing is
 * earned stage by stage over the job's in-scope finishing stages.
 */
import { DEFAULT_STAGE_SHARES, DOC_TYPE, FINISHING_PROCESS_STAGE, NOT_STARTED, STAGE, sortStages, stageSeq } from './constants';

const round1 = (v) => Math.round(v * 10) / 10;

/** Default shares (sum 100) for a Work Order: `cuts` when the same vendor also cuts the job (CMT). */
export const defaultShares = ({ cuts, finishingScope = [] }) => {
  const parts = {
    cut: cuts ? DEFAULT_STAGE_SHARES.cut : 0,
    sew: DEFAULT_STAGE_SHARES.sew,
    fin: finishingScope.length ? DEFAULT_STAGE_SHARES.fin : 0,
  };
  const total = parts.cut + parts.sew + parts.fin;
  const cut = round1((parts.cut * 100) / total);
  const fin = round1((parts.fin * 100) / total);
  return { cut, sew: round1(100 - cut - fin), fin };
};

/** Cumulative fraction of a Work Order's rate earned by a piece that reached `stage`. */
export const workOrderShareAt = ({ stage, shares, finishingScope = [] }) => {
  if (!stage || stage === NOT_STARTED) return 0;
  const seq = stageSeq(stage);
  let pct = 0;
  if (seq >= stageSeq(STAGE.CUT)) pct += Number(shares?.cut) || 0;
  if (seq >= stageSeq(STAGE.STITCHED)) pct += Number(shares?.sew) || 0;
  const scope = sortStages(finishingScope);
  if (scope.length) {
    const done = scope.filter((s) => stageSeq(s) <= seq).length;
    pct += ((Number(shares?.fin) || 0) * done) / scope.length;
  }
  return pct / 100;
};

/**
 * What one good piece pulled back at `stage` earns, with the per-document breakdown.
 * Each piece is paid once: as accepted on a final-stage receipt, or as earned here.
 */
export const earnedPerPiece = ({ stage, docs, finishingScope = [] }) => {
  const hasWorkOrder = docs.some((d) => d.docType === DOC_TYPE.WORK_ORDER);
  const seq = stage === NOT_STARTED ? 0 : stageSeq(stage);
  const breakdown = docs.map((doc) => {
    const rate = Number(doc.rate) || 0;
    let fraction = 0;
    let note = '';
    switch (doc.docType) {
      case DOC_TYPE.WORK_ORDER:
        fraction = workOrderShareAt({ stage, shares: doc.shares, finishingScope });
        break;
      case DOC_TYPE.CUTTING_PO:
        if (hasWorkOrder) note = 'Nominal: cutting is inside the Work Order\'s CMT rate';
        else fraction = seq >= stageSeq(STAGE.CUT) ? 1 : 0;
        break;
      case DOC_TYPE.FINISHING_PO: {
        const procs = (doc.processes || []).map((p) => FINISHING_PROCESS_STAGE[p]).filter(Boolean);
        fraction = procs.length ? procs.filter((s) => stageSeq(s) <= seq).length / procs.length : 0;
        break;
      }
      case DOC_TYPE.CUT_PANEL_PO:
        fraction = seq >= stageSeq(STAGE.PANEL_PROCESSED) ? 1 : 0;
        break;
      case DOC_TYPE.GARMENT_PROCESS_PO:
        fraction = seq >= stageSeq(STAGE.GARMENT_PROCESSED) ? 1 : 0;
        break;
      default:
        break;
    }
    return { docNo: doc.docNo, docType: doc.docType, rate, sharePct: Math.round(fraction * 1000) / 10, amount: rate * fraction, note };
  });
  return { amount: breakdown.reduce((a, b) => a + b.amount, 0), breakdown };
};

/** Σ good pieces × earned per piece over lines [{ stage, qty }]. */
export const earningsForLines = ({ lines, docs, finishingScope }) => lines.reduce(
  (total, l) => total + (Number(l.qty) || 0) * earnedPerPiece({ stage: l.stage, docs, finishingScope }).amount,
  0,
);
