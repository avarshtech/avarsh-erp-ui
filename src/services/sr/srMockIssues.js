/**
 * Sample Request Issue (R2): material issued against a SUBMITTED SR from the
 * inventory Material Issue page — the ONLY trigger for SUBMITTED →
 * IN_PRODUCTION ("production starts when material is issued").
 *
 * Unlike bulk issues (fabric and accessories are separate documents against a
 * Cutting PO), ONE sample issue carries BOTH the fabric and the trim lines of
 * a single SR: a sample is picked and handed over in one go, so splitting it
 * would create two documents that always travel together.
 */
import { loadDb, saveDb, nextSampleIssueNo } from './srMockStore';
import { fail, pushActivity, currentUserName, todayStr } from './srMockApi';
import { stampStatus } from './srMockTransitions';
import { SR_STATUS, SAMPLE_TYPE_LIST } from '../../utils/sampleRequestConstants';
import { computeSampleQtyRequired } from '../../utils/sampleBomMapper';
import { daysRemaining, deadlineRag } from '../../utils/deadlineUtils';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const isFabric = (line) => line.section === 'FABRIC';

/** SR material line → an issue-form line (required qty derived from the BOM). */
const toIssueLine = (m, sr) => ({
  lineNo: m.lineNo,
  section: m.section,
  fabricType: m.fabricType,
  classification: m.classification,
  description: m.description,
  colourDesign: m.colourDesign,
  width: m.width,
  uom: m.uom,
  requiredQty: m.sampleQtyRequired
    || computeSampleQtyRequired(m, sr.sampleQty, sr.sizes || []),
});

/** SR context every issue row carries, so the list needs no second lookup. */
const srContext = (sr) => ({
  sampleTypeId: sr?.sampleTypeId ?? null,
  sampleTypeName: sr?.sampleTypeName || 'Others',
  orderNo: sr?.orderNo || '',
  styleNo: sr?.styleNo || '',
  garmentName: sr?.garmentName || '',
  buyerName: sr?.buyerName || '',
  season: sr?.season || '',
  sampleQty: sr?.sampleQty ?? null,
  sizes: sr?.sizes || [],
  srStatus: sr?.status || null,
  inHandDate: sr?.inHandDate || null,
});

const decorate = (issue, db) => {
  const sr = db.requests.find((r) => r.id === issue.srId);
  const lines = issue.lines || [];
  const fabricLines = lines.filter(isFabric);
  const trimLines = lines.filter((l) => !isFabric(l));
  return {
    ...clone(issue),
    ...srContext(sr),
    fabricLines: clone(fabricLines),
    trimLines: clone(trimLines),
    fabricCount: fabricLines.length,
    trimCount: trimLines.length,
    lineCount: lines.length,
  };
};

/**
 * Every sample issue, newest first, decorated with its SR context. The list
 * screen groups these into the sample-type tabs and filters client-side.
 * `srId` narrows to one SR (the SR view's issue history).
 */
export const listSampleIssues = async ({ srId } = {}) => {
  await delay();
  const db = loadDb();
  const rows = (db.sampleIssues || [])
    .filter((i) => (srId == null ? true : i.srId === Number(srId)))
    .map((i) => decorate(i, db))
    // Newest issue first — by date, since seeded ids follow SR order, not time
    .sort((a, b) => (a.issuedDate === b.issuedDate ? b.id - a.id : (a.issuedDate < b.issuedDate ? 1 : -1)));

  const awaiting = db.requests.filter((sr) => sr.status === SR_STATUS.SUBMITTED);
  return {
    content: rows,
    totalElements: rows.length,
    stats: {
      totalIssues: (db.sampleIssues || []).length,
      awaitingIssue: awaiting.length,
      inProduction: db.requests.filter((sr) => sr.status === SR_STATUS.IN_PRODUCTION).length,
    },
    // Named so the list can say WHICH samples are still waiting on the store,
    // carrying the urgency that decides the order they should be picked in
    awaitingSrs: awaiting
      .map((sr) => ({
        id: sr.id,
        srNo: sr.srNo,
        sampleTypeId: sr.sampleTypeId,
        sampleTypeName: sr.sampleTypeName,
        priority: sr.priority,
        inHandDate: sr.inHandDate,
        inHandDays: daysRemaining(sr.inHandDate),
        inHandRag: deadlineRag(daysRemaining(sr.inHandDate)),
      }))
      .sort((a, b) => (a.inHandDays ?? 999) - (b.inHandDays ?? 999)),
  };
};

export const getSampleIssue = async (id) => {
  await delay(60);
  const db = loadDb();
  const issue = (db.sampleIssues || []).find((i) => i.id === Number(id));
  if (!issue) fail('NOT_FOUND', `Sample issue ${id} not found`);
  return decorate(issue, db);
};

/**
 * SUBMITTED SRs awaiting material issue — the issue form's picker. Each row
 * carries its fabric and trim lines with the BOM-derived required quantity,
 * so the form needs no second call.
 */
export const listIssuableSrs = async () => {
  await delay();
  const db = loadDb();
  return db.requests
    .filter((sr) => sr.status === SR_STATUS.SUBMITTED)
    .map((sr) => {
      const lines = (sr.materials || []).map((m) => toIssueLine(m, sr));
      return {
        id: sr.id,
        srNo: sr.srNo,
        ...srContext(sr),
        // Fixed-list safety: an unknown type id still lands somewhere sensible
        sampleTypeName: SAMPLE_TYPE_LIST.find((t) => t.id === sr.sampleTypeId)?.name
          || sr.sampleTypeName || 'Others',
        priority: sr.priority,
        colourReference: sr.colourReference,
        specialInstructions: sr.specialInstructions,
        dispatchDeadline: sr.dispatchDeadline,
        inHandDays: daysRemaining(sr.inHandDate),
        inHandRag: deadlineRag(daysRemaining(sr.inHandDate)),
        fabricLines: lines.filter(isFabric),
        trimLines: lines.filter((l) => !isFabric(l)),
      };
    })
    .sort((a, b) => (a.inHandDays ?? 999) - (b.inHandDays ?? 999));
};

/**
 * Create the issue and start production: SRI record + SR activity +
 * SUBMITTED → IN_PRODUCTION (the only place this transition happens).
 * Lines with a zero/blank issue quantity are dropped — a sample often ships
 * with trims already in hand, so a partial issue is normal.
 */
export const createSampleIssue = async (srId, { lines, remarks, receivedBy } = {}) => {
  await delay();
  const db = loadDb();
  const sr = db.requests.find((r) => r.id === Number(srId));
  if (!sr) fail('NOT_FOUND', `Sample request ${srId} not found`);
  if (sr.status !== SR_STATUS.SUBMITTED) {
    fail('CONFLICT', `${sr.srNo} is ${sr.status} — material can be issued only against a Submitted SR`);
  }
  const issuable = (lines || []).filter((l) => Number(l.issueQty) > 0);
  if (!issuable.length) fail('VALIDATION', 'Enter an issue quantity for at least one material line');
  // A hand-over records who signed for the goods — same rule as the bulk issues
  const receiver = String(receivedBy || '').trim();
  if (!receiver) fail('VALIDATION', 'Enter who received the materials');

  db.sampleIssues = db.sampleIssues || [];
  const issue = {
    id: Math.max(0, ...db.sampleIssues.map((i) => i.id || 0)) + 1,
    issueNo: nextSampleIssueNo(db),
    srId: sr.id,
    srNo: sr.srNo,
    issuedDate: todayStr(),
    issuedBy: currentUserName(),
    receivedBy: receiver,
    remarks: remarks || '',
    lines: clone(issuable),
  };
  db.sampleIssues.push(issue);

  const fabricCount = issuable.filter(isFabric).length;
  const trimCount = issuable.length - fabricCount;
  pushActivity(sr, `Materials issued via ${issue.issueNo} — production started`, {
    details: `${fabricCount} fabric · ${trimCount} trim line(s) issued`,
  });
  stampStatus(sr, SR_STATUS.IN_PRODUCTION);
  saveDb(db);
  return decorate(issue, db);
};
