/**
 * Mock of the vendor daily sheet: GET/POST /api/v1/job-work/sheets and DELETE /progress/{id}
 * (plan 1a "Daily sheet"). One save writes every edited job of the vendor or none of them.
 */
import { FLAG, ISSUE_CATEGORY, JOB_STATUS, OPEN_JOB_STATUSES, SOURCE } from '../../../utils/jobWorkTracker/constants';
import { prefillCells, sheetDateProblem, validateJobCells } from '../../../utils/jobWorkTracker/sheetRules';
import {
  clone, latency, loadTrackerDb, mockError, mutateTrackerDb, nextId, todayIso,
} from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';

const sheetJob = (db, job, date, today) => {
  const ctx = jobContext(db, job, today);
  const s = ctx.snapshot;
  const onDate = ctx.entries.find((e) => e.date === date) || null;
  const before = ctx.entries.filter((e) => e.date < date);
  const latest = ctx.entries[ctx.entries.length - 1] || null;
  const base = onDate || before[before.length - 1] || null;
  // The never-down base is the entry before the one this save would replace.
  const prev = before[before.length - 1] || null;
  const readOnlyReason = sheetDateProblem({ date, today, jobStart: job.startDate, latestEntryDate: latest?.date });
  return {
    jobId: job.id,
    jobNo: job.jobNo,
    orderNo: ctx.order.orderNo,
    styleNo: ctx.order.styleNo,
    styleName: ctx.order.styleName,
    buyer: ctx.order.buyer,
    stages: ctx.stages,
    colours: s.colours,
    planByColour: s.planByColour,
    floor: s.floor,
    cells: prefillCells(ctx.stages, s.colours, base?.cells, s.floor),
    prevCells: prev?.cells || null,
    replacing: Boolean(onDate),
    readOnly: Boolean(readOnlyReason),
    readOnlyReason,
    progressSeq: job.progressSeq,
    flag: base?.flag || FLAG.ON_TRACK,
    issueCategory: base?.issueCategory || ISSUE_CATEGORY.NONE,
    remarks: base?.remarks || '',
    source: base?.source || SOURCE.CALL,
    revisedDue: job.revisedDue,
    dueDate: ctx.dueDate,
    risk: s.risk,
    riskReasons: s.riskReasons,
    stale: s.stale,
    lastEntryDate: latest?.date || null,
    lastEnteredBy: latest?.enteredBy || null,
    projectedDate: s.projectedDate,
  };
};

const buildSheet = (db, vendorId, date) => {
  const today = todayIso();
  const vendor = db.vendors.find((v) => v.id === Number(vendorId));
  if (!vendor) throw mockError('Pick a vendor.', { code: 'NOT_FOUND', status: 404 });
  const jobs = db.jobs.filter((j) => j.vendorId === vendor.id && OPEN_JOB_STATUSES.includes(j.status))
    .map((j) => sheetJob(db, j, date, today))
    .sort((a, b) => String(a.revisedDue || a.dueDate || '9999').localeCompare(String(b.revisedDue || b.dueDate || '9999')));
  return { vendor: { id: vendor.id, name: vendor.name, city: vendor.city, phone: vendor.phone, contactPerson: vendor.contactPerson }, date, jobs };
};

export const getVendorSheet = ({ vendorId, date } = {}) => {
  try {
    return latency(clone(buildSheet(loadTrackerDb(), vendorId, date || todayIso())));
  } catch (e) {
    return Promise.reject(e);
  }
};

/**
 * payload = { vendorId, date, source, jobs: [{ jobId, progressSeq, flag, revisedDue, issueCategory, remarks,
 *             source, noMovement, cells }] } — only the jobs the coordinator touched.
 */
export const saveVendorSheet = (payload) => mutateTrackerDb((db) => {
  const today = todayIso();
  const date = payload.date || today;
  const details = [];
  const sent = (payload.jobs || []).filter((j) => j.noMovement || j.cells);
  if (!sent.length) throw mockError('Nothing to save: change a figure or tick "No movement" on a job.');
  const plans = sent.map((p) => {
    const job = db.jobs.find((j) => j.id === p.jobId);
    if (!job || job.vendorId !== Number(payload.vendorId)) { details.push({ jobId: p.jobId, message: 'This job is not on this vendor\'s sheet.' }); return null; }
    if (!OPEN_JOB_STATUSES.includes(job.status)) { details.push({ jobId: job.id, message: 'This job is closed.' }); return null; }
    if (p.progressSeq !== job.progressSeq) {
      const last = db.entries.filter((e) => e.jobId === job.id).sort((a, b) => a.date.localeCompare(b.date)).pop();
      details.push({ jobId: job.id, code: 'SHEET_STALE', message: `Updated by ${last?.enteredBy || 'someone'} since you opened the sheet.` });
      return null;
    }
    const row = sheetJob(db, job, date, today);
    if (row.readOnly) { details.push({ jobId: job.id, message: row.readOnlyReason }); return null; }
    const cells = p.noMovement && !p.cells ? row.cells : p.cells;
    validateJobCells({ stages: row.stages, colours: row.colours, cells, prevCells: row.prevCells, planByColour: row.planByColour, floor: row.floor })
      .forEach((e) => details.push({ jobId: job.id, ...e }));
    return { job, p, row, cells };
  });
  if (details.length) throw mockError('Some jobs could not be saved — nothing was written.', { details });
  plans.forEach(({ job, p, row, cells }) => {
    const existing = db.entries.find((e) => e.jobId === job.id && e.date === date);
    const revisedChanged = (p.revisedDue || null) !== (job.revisedDue || null);
    const entry = existing || { id: nextId(db, 'entry'), jobId: job.id, date, version: -1, revisedDueWas: null };
    Object.assign(entry, {
      cells: Object.fromEntries(row.colours.map((c) => [c, Object.fromEntries(row.stages.map((st) => [st, Number(cells?.[c]?.[st]) || 0]))])),
      flag: p.flag || FLAG.ON_TRACK,
      issueCategory: p.issueCategory || ISSUE_CATEGORY.NONE,
      remarks: p.remarks || '',
      source: p.source || payload.source || SOURCE.CALL,
      enteredBy: 'You',
      version: entry.version + 1,
    });
    if (revisedChanged) {
      // Keep that day's first replaced date, so a delete can put it back.
      if (!entry.revisedTouched) {
        entry.revisedDueWas = job.revisedDue || null;
        entry.revisedTouched = true;
      }
      job.revisedDue = p.revisedDue || null;
      job.events.push({ at: date, by: 'You', text: p.revisedDue ? `Vendor's revised date set to ${p.revisedDue}` : 'Revised date cleared' });
    }
    entry.revisedDue = job.revisedDue || null;
    if (!existing) db.entries.push(entry);
    job.progressSeq += 1;
    if (job.status === JOB_STATUS.OPEN) job.status = JOB_STATUS.IN_PROGRESS;
  });
  return latency(clone(buildSheet(db, payload.vendorId, date)));
});

export const deleteProgress = (entryId, { version } = {}) => mutateTrackerDb((db) => {
  const entry = db.entries.find((e) => e.id === Number(entryId));
  if (!entry) throw mockError('That update no longer exists.', { code: 'NOT_FOUND', status: 404 });
  const jobEntries = db.entries.filter((e) => e.jobId === entry.jobId).sort((a, b) => a.date.localeCompare(b.date));
  if (jobEntries[jobEntries.length - 1].id !== entry.id) throw mockError('Only the latest update can be deleted.', { status: 409, code: 'CONFLICT' });
  if (version !== undefined && version !== entry.version) throw mockError('This update changed since you opened it.', { status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT' });
  const job = db.jobs.find((j) => j.id === entry.jobId);
  const ctx = jobContext(db, job, todayIso());
  const becomesLatest = jobEntries[jobEntries.length - 2];
  if (becomesLatest) {
    const errors = validateJobCells({
      stages: ctx.stages, colours: ctx.snapshot.colours, cells: becomesLatest.cells, prevCells: null,
      planByColour: ctx.snapshot.planByColour, floor: ctx.snapshot.floor,
    }).filter((e) => e.message.startsWith('Below the'));
    if (errors.length) throw mockError('Deleting this update would leave a stage below what has been received.', { status: 409, code: 'CONFLICT', details: errors });
  }
  db.entries = db.entries.filter((e) => e.id !== entry.id);
  // Put the revised date back only if nothing (a later sheet, a pull-back) has changed it since.
  if (entry.revisedTouched && (job.revisedDue || null) === (entry.revisedDue || null)) {
    job.revisedDue = entry.revisedDueWas || null;
    job.events.push({ at: todayIso(), by: 'You', text: entry.revisedDueWas ? `Revised date back to ${entry.revisedDueWas}` : 'Revised date cleared' });
  }
  job.progressSeq += 1;
  job.events.push({ at: todayIso(), by: 'You', text: `Deleted the update of ${entry.date}` });
  return latency({ ok: true });
});
