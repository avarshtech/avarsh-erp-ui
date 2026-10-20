/**
 * Mock of the materials a vendor holds: Material Issues sent to a job (fabric, trims, packing),
 * the packing-material issue (1d) and the vendor material return (1e, onto the same lot).
 * At integration these live on the Material Issue page; here they preview inside Job Work.
 */
import {
  DOC_TYPE, MATERIAL_CONDITION, MATERIAL_KIND, OPEN_JOB_STATUSES, STAGE,
} from '../../../utils/jobWorkTracker/constants';
import {
  clone, latency, loadTrackerDb, mockError, mutateTrackerDb, nextDocNo, nextId, todayIso,
} from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';

const returnedFor = (db, materialId) => db.vendorReturns.flatMap((r) => r.lines.filter((l) => l.materialId === materialId))
  .reduce((acc, l) => {
    acc[l.condition] = (acc[l.condition] || 0) + l.qty;
    return acc;
  }, {});

const materialRow = (db, m) => {
  const back = returnedFor(db, m.id);
  const good = back[MATERIAL_CONDITION.GOOD] || 0;
  const damaged = back[MATERIAL_CONDITION.DAMAGED] || 0;
  return { ...m, returnedGood: good, returnedDamaged: damaged, atVendor: Math.max(0, m.qty - good - damaged) };
};

export const getJobMaterials = (jobId) => {
  const db = loadTrackerDb();
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job) return Promise.reject(mockError('Job not found.', { code: 'NOT_FOUND', status: 404 }));
  return latency(clone({
    jobId: job.id,
    jobNo: job.jobNo,
    rows: db.materials.filter((m) => m.jobId === job.id).map((m) => materialRow(db, m)),
    returns: db.vendorReturns.filter((r) => r.jobId === job.id),
  }));
};

/** Open jobs with what was sent, for the Materials tab. */
export const listMaterialJobs = (filters = {}) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const q = (filters.q || '').trim().toLowerCase();
  const rows = db.jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).map((job) => {
    const ctx = jobContext(db, job, today);
    const mats = db.materials.filter((m) => m.jobId === job.id).map((m) => materialRow(db, m));
    const kinds = Object.values(MATERIAL_KIND).map((kind) => ({ kind, items: mats.filter((m) => m.kind === kind).length }));
    return {
      jobId: job.id, jobNo: job.jobNo, vendorId: ctx.vendor.id, vendorName: ctx.vendor.name, orderNo: ctx.order.orderNo,
      styleNo: ctx.order.styleNo, stages: ctx.stages, latestIssue: ctx.snapshot.latestIssue, kinds,
      packs: ctx.stages.includes(STAGE.PACKED),
      atVendorByUom: mats.reduce((acc, m) => { acc[m.uom] = (acc[m.uom] || 0) + m.atVendor; return acc; }, {}),
    };
  }).filter((r) => (!filters.vendorId || r.vendorId === filters.vendorId)
    && (!q || [r.jobNo, r.vendorName, r.orderNo, r.styleNo].some((v) => String(v).toLowerCase().includes(q))));
  return latency(rows);
};

/** Jobs that can take packing material: an outsourced Finishing PO, or a vendor Work Order whose scope includes PACKED. */
export const getPackingTargets = () => {
  const db = loadTrackerDb();
  const today = todayIso();
  return latency(db.jobs.filter((j) => OPEN_JOB_STATUSES.includes(j.status)).map((job) => {
    const ctx = jobContext(db, job, today);
    const target = ctx.docs.find((d) => d.docType === DOC_TYPE.FINISHING_PO && (d.processes || []).includes('PACKING'))
      || (ctx.stages.includes(STAGE.PACKED) ? ctx.docs.find((d) => d.docType === DOC_TYPE.WORK_ORDER) : null);
    return target ? { jobId: job.id, jobNo: job.jobNo, vendorName: ctx.vendor.name, orderNo: ctx.order.orderNo, styleNo: ctx.order.styleNo, docNo: target.docNo, docType: target.docType } : null;
  }).filter(Boolean));
};

export const PACKING_ITEMS = [
  { itemCode: 'PKG-POLY-S', itemName: 'Polybag 30×40', uom: 'pcs' },
  { itemCode: 'PKG-POLY-L', itemName: 'Polybag 40×55', uom: 'pcs' },
  { itemCode: 'PKG-CTN-7P', itemName: 'Carton 7-ply', uom: 'pcs' },
  { itemCode: 'PKG-HTG', itemName: 'Hang tag', uom: 'pcs' },
  { itemCode: 'PKG-STK-BC', itemName: 'Barcode sticker', uom: 'pcs' },
  { itemCode: 'PKG-TAPE', itemName: 'BOPP tape 2"', uom: 'roll' },
];

export const issuePacking = (jobId, { date, lines = [] } = {}) => mutateTrackerDb((db) => {
  const target = db.jobs.find((j) => j.id === Number(jobId));
  if (!target) throw mockError('Job not found.', { code: 'NOT_FOUND', status: 404 });
  const ctx = jobContext(db, target, todayIso());
  const doc = ctx.docs.find((d) => d.docType === DOC_TYPE.FINISHING_PO && (d.processes || []).includes('PACKING'))
    || (ctx.stages.includes(STAGE.PACKED) ? ctx.docs.find((d) => d.docType === DOC_TYPE.WORK_ORDER) : null);
  if (!doc) throw mockError('This job does not pack: no outsourced Finishing PO with Packing, and Packed is not in its scope.', { status: 409, code: 'CONFLICT' });
  const valid = lines.filter((l) => (Number(l.qty) || 0) > 0);
  if (!valid.length) throw mockError('Enter at least one quantity.');
  const misNo = nextDocNo(db, 'MIS');
  valid.forEach((l) => {
    const item = PACKING_ITEMS.find((p) => p.itemCode === l.itemCode) || l;
    db.materials.push({ id: nextId(db, 'material'), misNo, jobId: target.id, docNo: doc.docNo, kind: MATERIAL_KIND.PACKING, itemCode: item.itemCode, itemName: item.itemName, uom: item.uom, qty: Number(l.qty), date: date || todayIso() });
  });
  target.events.push({ at: date || todayIso(), by: 'You', text: `Packing material issued on ${misNo} against ${doc.docNo}` });
  return latency({ misNo });
});

/** lines = [{ materialId, qty, condition }]; GOOD goes back onto the lot, DAMAGED is recorded only. */
export const postVendorReturn = (jobId, { date, vendorDcNo, pullBackId = null, lines = [] } = {}) => mutateTrackerDb((db) => {
  const job = db.jobs.find((j) => j.id === Number(jobId));
  if (!job) throw mockError('Job not found.', { code: 'NOT_FOUND', status: 404 });
  const valid = lines.filter((l) => (Number(l.qty) || 0) > 0);
  if (!valid.length) throw mockError('Enter at least one quantity.');
  if (!(vendorDcNo || '').trim()) throw mockError('Enter the vendor\'s DC number.');
  const details = [];
  const asked = {};
  valid.forEach((l) => { asked[l.materialId] = (asked[l.materialId] || 0) + Number(l.qty); });
  Object.entries(asked).forEach(([materialId, q]) => {
    const m = db.materials.find((x) => x.id === Number(materialId) && x.jobId === job.id);
    if (!m) { details.push({ message: 'That issue line is not on this job.' }); return; }
    const row = materialRow(db, m);
    if (q > row.atVendor) details.push({ message: `${m.itemName}: ${q} ${m.uom} asked back, only ${row.atVendor} are at the vendor.` });
  });
  if (details.length) throw mockError(details[0].message, { details });
  const ret = {
    id: nextId(db, 'vendorReturn'), vmrNo: nextDocNo(db, 'VMR'), jobId: job.id, pullBackId, date: date || todayIso(),
    vendorDcNo: vendorDcNo.trim(), createdBy: 'You',
    lines: valid.map((l) => ({ materialId: Number(l.materialId), qty: Number(l.qty), condition: l.condition || MATERIAL_CONDITION.GOOD })),
  };
  db.vendorReturns.push(ret);
  job.events.push({ at: ret.date, by: 'You', text: `Vendor material return ${ret.vmrNo}` });
  return latency({ id: ret.id, vmrNo: ret.vmrNo });
});
