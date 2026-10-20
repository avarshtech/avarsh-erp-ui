/**
 * The job's stages and per-stage plan, built from its linked vendor documents (the backend's
 * JobPlanBuilder, plan "Stages and plan"). Quantities come from the documents' colour × size
 * lines; a Finishing PO's process rows only decide which finishing stages exist.
 *
 *   doc  = { docType, docNo, allowancePct, processes?, lines: [{ colour, size, plannedQty }] }
 *   plan = { [stage]: { [colour]: { [size]: qty } } }
 */
import {
  DOC_TYPE, FINISHING_PROCESS_STAGE, FINISHING_STAGES, NOT_STARTED, STAGE, STAGE_SEQ, sortStages, stageSeq,
} from './constants';

const STAGES_BY_DOC = {
  [DOC_TYPE.CUTTING_PO]: () => [STAGE.CUT],
  [DOC_TYPE.CUT_PANEL_PO]: () => [STAGE.PANEL_PROCESSED],
  [DOC_TYPE.GARMENT_PROCESS_PO]: () => [STAGE.GARMENT_PROCESSED],
  [DOC_TYPE.WORK_ORDER]: (doc, scope) => [STAGE.LOADED, STAGE.STITCHED, ...(scope || [])],
  [DOC_TYPE.FINISHING_PO]: (doc) => (doc.processes || []).map((p) => FINISHING_PROCESS_STAGE[p]).filter(Boolean),
};

/** The job's stage chain, in order. `finishingScope` applies to a vendor Work Order (decision 6). */
export const jobStages = (docs, finishingScope) => sortStages(
  docs.flatMap((doc) => STAGES_BY_DOC[doc.docType]?.(doc, finishingScope) || []),
);

const addLines = (target, lines) => {
  lines.forEach(({ colour, size, plannedQty }) => {
    const c = colour || '-';
    const s = size || '-';
    target[c] = target[c] || {};
    target[c][s] = (target[c][s] || 0) + (Number(plannedQty) || 0);
  });
  return target;
};

const sumDocs = (docs) => docs.reduce((acc, doc) => addLines(acc, doc.lines || []), {});

const ofType = (docs, type) => docs.filter((d) => d.docType === type);

/** Gross per-stage plan, before pull-backs. */
export const docPlan = (docs, stages) => {
  const workOrders = ofType(docs, DOC_TYPE.WORK_ORDER);
  const plan = {};
  stages.forEach((stage) => {
    if (stage === STAGE.CUT) plan[stage] = sumDocs(ofType(docs, DOC_TYPE.CUTTING_PO));
    else if (stage === STAGE.PANEL_PROCESSED) plan[stage] = sumDocs(ofType(docs, DOC_TYPE.CUT_PANEL_PO));
    else if (stage === STAGE.GARMENT_PROCESSED) plan[stage] = sumDocs(ofType(docs, DOC_TYPE.GARMENT_PROCESS_PO));
    else if (stage === STAGE.LOADED || stage === STAGE.STITCHED) plan[stage] = sumDocs(workOrders);
    else if (FINISHING_STAGES.includes(stage)) {
      // With a Work Order on the job, every finishing stage plans the STITCHED quantity.
      plan[stage] = workOrders.length
        ? sumDocs(workOrders)
        : sumDocs(ofType(docs, DOC_TYPE.FINISHING_PO).filter((d) => STAGES_BY_DOC[d.docType](d).includes(stage)));
    }
  });
  return plan;
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const spreadOff = (sizes, qty) => {
  // Take `qty` off a colour's sizes, largest first, never below zero.
  let left = qty;
  Object.keys(sizes).sort((a, b) => sizes[b] - sizes[a]).forEach((size) => {
    const take = Math.min(left, sizes[size]);
    sizes[size] -= take;
    left -= take;
  });
};

/**
 * Net plan (1e): plan at stage s = document plan − pull-back returns that reached a stage below s
 * − write-offs below s. `returns` = [{ colour, size, stage, good, damaged }],
 * `writeOffs` = [{ colour, stage, qty }].
 */
export const netPlan = (plan, stages, returns = [], writeOffs = []) => {
  const net = clone(plan);
  stages.forEach((stage) => {
    const seq = STAGE_SEQ[stage];
    returns.filter((r) => stageSeq(r.stage) < seq).forEach((r) => {
      const sizes = net[stage]?.[r.colour];
      if (!sizes) return;
      const qty = (Number(r.good) || 0) + (Number(r.damaged) || 0);
      if (sizes[r.size] !== undefined) sizes[r.size] = Math.max(0, sizes[r.size] - qty);
      else spreadOff(sizes, qty);
    });
    writeOffs.filter((w) => stageSeq(w.stage) < seq).forEach((w) => {
      const sizes = net[stage]?.[w.colour];
      if (sizes) spreadOff(sizes, Number(w.qty) || 0);
    });
  });
  return net;
};

export const colourTotals = (stagePlan = {}) => Object.fromEntries(
  Object.entries(stagePlan).map(([colour, sizes]) => [colour, Object.values(sizes).reduce((a, b) => a + b, 0)]),
);

export const stageTotal = (stagePlan = {}) => Object.values(colourTotals(stagePlan)).reduce((a, b) => a + b, 0);

/** Colours on the job, in the order the documents list them. */
export const jobColours = (docs) => [...new Set(docs.flatMap((d) => (d.lines || []).map((l) => l.colour || '-')))];

/** Documents whose lines define the final stage (a finishing stage on a Work Order job uses the Work Order). */
const finalStageDocs = (docs, finalStage) => {
  if (FINISHING_STAGES.includes(finalStage) && ofType(docs, DOC_TYPE.WORK_ORDER).length) return ofType(docs, DOC_TYPE.WORK_ORDER);
  return docs.filter((d) => (STAGES_BY_DOC[d.docType]?.(d, FINISHING_STAGES) || []).includes(finalStage));
};

/**
 * Job share per colour (1a "Job share"): Σ over the final-stage plan rows (before pull-backs) of
 * ⌊planned ÷ (1 + allowance %)⌋, capped at the order's qty for that colour. PO order_qty is never used.
 * `buyerQty` = { [colour]: qty }.
 */
export const jobShare = (docs, stages, buyerQty = {}) => {
  const finalStage = stages[stages.length - 1];
  const share = {};
  finalStageDocs(docs, finalStage).forEach((doc) => {
    const factor = 1 + (Number(doc.allowancePct) || 0) / 100;
    (doc.lines || []).forEach(({ colour, plannedQty }) => {
      const c = colour || '-';
      share[c] = (share[c] || 0) + Math.floor(((Number(plannedQty) || 0) / factor) + 1e-9);
    });
  });
  Object.keys(share).forEach((c) => {
    if (buyerQty[c] !== undefined) share[c] = Math.min(share[c], buyerQty[c]);
  });
  return share;
};

/** A pulled-back piece's position for the stage-order rules. */
export const isBelow = (stage, other) => stageSeq(stage) < stageSeq(other);
export { NOT_STARTED };
