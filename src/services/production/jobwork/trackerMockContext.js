/**
 * Builds one job's full picture from the demo store: its documents, stage chain, net plan, share,
 * entries, receipts, pull-backs and the snapshot the tracker shows. Every mock endpoint reads jobs
 * through here, so the rules live in src/utils/jobWorkTracker only.
 */
import { DOC_TYPE, FINISHING_STAGES, PULLBACK_STATUS, RETURN_STATUS, STAGE } from '../../../utils/jobWorkTracker/constants';
import { docPlan, jobColours, jobShare, jobStages, netPlan } from '../../../utils/jobWorkTracker/planRules';
import { computeSnapshot, withdrawnByColour } from '../../../utils/jobWorkTracker/snapshotRules';

const byKey = (db) => Object.fromEntries(db.docs.map((d) => [d.key, d]));

export const jobDocs = (db, job) => {
  const docs = byKey(db);
  return job.docKeys.map((k) => docs[k]).filter(Boolean);
};

/** Due date from the final stage's document type (plan 1a "Dates"). */
export const jobDueDate = (docs, stages) => {
  const final = stages[stages.length - 1];
  const typeFor = (stage) => {
    if (stage === STAGE.CUT) return DOC_TYPE.CUTTING_PO;
    if (stage === STAGE.PANEL_PROCESSED) return DOC_TYPE.CUT_PANEL_PO;
    if (stage === STAGE.GARMENT_PROCESSED) return DOC_TYPE.GARMENT_PROCESS_PO;
    if (stage === STAGE.LOADED || stage === STAGE.STITCHED) return DOC_TYPE.WORK_ORDER;
    return docs.some((d) => d.docType === DOC_TYPE.WORK_ORDER) ? DOC_TYPE.WORK_ORDER : DOC_TYPE.FINISHING_PO;
  };
  const dates = docs.filter((d) => d.docType === typeFor(final))
    .map((d) => d.plannedDelivery || d.plannedEnd || null).filter(Boolean).sort();
  return dates[dates.length - 1] || null;
};

export const jobPlannedStart = (docs) => docs.map((d) => d.plannedStart || d.approvedOn).filter(Boolean).sort()[0] || null;

export const buyerQtyByColour = (order) => Object.fromEntries(
  order.colours.map(({ colour, qty }) => [colour, Object.values(qty).reduce((a, b) => a + b, 0)]),
);

export const jobPullBacks = (db, jobId) => db.pullBacks.filter((p) => p.jobId === jobId);

export const postedReturns = (db, jobId) => db.pullBackReturns
  .filter((r) => r.jobId === jobId && r.status === RETURN_STATUS.POSTED);

export const writeOffs = (db, jobId) => jobPullBacks(db, jobId)
  .filter((p) => p.status === PULLBACK_STATUS.SETTLED)
  .flatMap((p) => p.lines.filter((l) => l.writtenOff > 0).map((l) => ({ colour: l.colour, stage: l.stage, qty: l.writtenOff })));

/** Everything a screen needs about one job, computed for `today`. */
export const jobContext = (db, job, today) => {
  const docs = jobDocs(db, job);
  const order = db.orders.find((o) => o.id === job.orderId);
  const vendor = db.vendors.find((v) => v.id === job.vendorId);
  const branch = db.branches.find((b) => b.id === job.branchId);
  const stages = jobStages(docs, job.finishingScope);
  const gross = docPlan(docs, stages);
  const returns = postedReturns(db, job.id);
  const plan = netPlan(gross, stages, returns.flatMap((r) => r.lines), writeOffs(db, job.id));
  const share = jobShare(docs, stages, buyerQtyByColour(order));
  const entries = db.entries.filter((e) => e.jobId === job.id).sort((a, b) => a.date.localeCompare(b.date));
  const receipts = db.receipts.filter((r) => r.jobId === job.id);
  const pullBacks = jobPullBacks(db, job.id);
  const returnsByPullBack = {};
  returns.forEach((r) => { (returnsByPullBack[r.pullBackId] = returnsByPullBack[r.pullBackId] || []).push(r); });
  const withdrawn = withdrawnByColour(pullBacks, returnsByPullBack);
  const dueDate = jobDueDate(docs, stages);
  const plannedStart = jobPlannedStart(docs);
  const snapshot = computeSnapshot({
    job: { ...job, dueDate, plannedStart }, stages, plan, share, entries, receipts, withdrawn, today,
  });
  return {
    job, docs, order, vendor, branch, stages, gross, plan, share, entries, receipts, pullBacks, returns,
    withdrawn, dueDate, plannedStart, snapshot, colours: jobColours(docs),
  };
};

/** Default finishing scope for a vendor Work Order job (decision 6). */
export const defaultFinishingScope = () => [...FINISHING_STAGES];
