/**
 * In-memory mock API for the Cutting module (design phase). State persists for
 * the browser session so the whole chain is clickable: receipt → relaxation →
 * planning → lay → TMB → report → bundling → issue / external process → re-cut
 * → reconciliation. Derived figures are computed, not stored.
 */
import dayjs from 'dayjs';
import { FABRIC_TYPES, THRESHOLDS } from '../../utils/cuttingConstants';
import * as seed from './cuttingMockData';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
const docNo = (prefix, rows) => `${prefix}-${dayjs().format('YYYYMMDD')}-${String(rows.length + 1).padStart(3, '0')}`;
const round3 = (n) => Math.round(n * 1000) / 1000;

const db = {
  cutPos: clone(seed.seedCutPos),
  receipts: clone(seed.seedFabricReceipts),
  relaxations: clone(seed.seedRelaxations),
  markers: clone(seed.seedMarkers),
  cops: clone(seed.seedCops),
  layAudits: clone(seed.seedLayAudits),
  tmbChecks: clone(seed.seedTmbChecks),
  reportLays: clone(seed.seedReportLays),
  bundlings: clone(seed.seedBundlings),
  bundles: clone(seed.seedBundles),
  bundleIssues: clone(seed.seedBundleIssues),
  panelIssues: clone(seed.seedPanelIssues),
  panelChecks: clone(seed.seedPanelChecks),
  processReturns: clone(seed.seedProcessReturns),
  reCutEntries: clone(seed.seedReCutEntries),
  endBits: clone(seed.seedEndBits),
  reCutFabricKg: clone(seed.seedReCutFabricKg),
};

const cutPo = (id) => db.cutPos.find((p) => p.id === Number(id));

// ── Cut POs / lookups ───────────────────────────────────────────────────────
export const getCutPos = async () => { await delay(); return clone(db.cutPos); };

/** Rolls of a Cut PO with received/relaxed flags (relaxed ⇒ selectable in Lay Audit). */
export const getRolls = async (cutPoId) => {
  await delay();
  const receipts = db.receipts.filter((r) => r.cutPoId === Number(cutPoId));
  return receipts.flatMap((rc) => {
    const relax = db.relaxations.find((x) => x.receiptId === rc.id);
    const relaxed = relax && relax.status !== 'IN_PROGRESS';
    return rc.rolls.filter((roll) => roll.received)
      .map((roll) => ({ ...roll, receiptNo: rc.receiptNo, relaxed: Boolean(relaxed) }));
  });
};

// ── FR-01 Fabric Receipt ────────────────────────────────────────────────────
export const listReceipts = async () => { await delay(); return clone(db.receipts); };
export const createReceipt = async (payload) => {
  await delay();
  const row = { id: nextId(db.receipts), receiptNo: docNo('FR', db.receipts), status: payload.rolls.every((r) => r.received) ? 'RECEIVED' : 'PARTIALLY_RECEIVED', ...payload };
  db.receipts.push(row);
  return clone(row);
};

// ── FR-02 Fabric Relaxation ─────────────────────────────────────────────────
export const listRelaxations = async () => { await delay(); return clone(db.relaxations); };
export const saveRelaxation = async (payload) => {
  await delay();
  const existing = payload.id && db.relaxations.find((r) => r.id === payload.id);
  const status = payload.endTime ? 'COMPLETED' : 'IN_PROGRESS';
  if (existing) { Object.assign(existing, payload, { status: existing.status === 'REPORT_GENERATED' && payload.endTime ? 'REPORT_GENERATED' : status }); return clone(existing); }
  const row = { id: nextId(db.relaxations), relaxNo: docNo('RLX', db.relaxations), status, ...payload };
  db.relaxations.push(row);
  return clone(row);
};
export const generateRelaxationReport = async (id) => {
  await delay();
  const row = db.relaxations.find((r) => r.id === id);
  if (row) row.status = 'REPORT_GENERATED';
  return clone(row);
};
export const minRelaxHours = (fabricType) => FABRIC_TYPES.find((f) => f.value === fabricType)?.minRelaxHrs ?? 24;

// ── ENH-01 Marker / ENH-02 COP ──────────────────────────────────────────────
export const listMarkers = async () => { await delay(); return clone(db.markers); };
export const saveMarker = async (payload) => {
  await delay();
  const existing = payload.id && db.markers.find((m) => m.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.markers), markerNo: docNo('MKR', db.markers), status: 'DRAFT', ...payload };
  db.markers.push(row);
  return clone(row);
};
export const listCops = async () => { await delay(); return clone(db.cops); };
export const getCop = async (id) => { await delay(); return clone(db.cops.find((c) => c.id === Number(id))); };
export const saveCop = async (payload) => {
  await delay();
  const existing = payload.id && db.cops.find((c) => c.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.cops), copNo: docNo('COP', db.cops), status: 'DRAFT', sizeSetStatus: 'PENDING', ...payload };
  db.cops.push(row);
  return clone(row);
};
export const setCopStatus = async (id, patch) => {
  await delay();
  const row = db.cops.find((c) => c.id === Number(id));
  Object.assign(row, patch);
  if (patch.sizeSetStatus) { const po = cutPo(row.cutPoId); if (po) po.sizeSetStatus = patch.sizeSetStatus; }
  return clone(row);
};

// ── FR-03 Lay Audit ─────────────────────────────────────────────────────────
const withLayTotals = (lay) => ({
  ...lay,
  rolls: lay.rolls.map((r) => {
    const total = round3((r.numLays || 0) * (r.weightPerLay || 0));
    return { ...r, total, variance: round3(total - (r.weight || 0)) };
  }),
});
export const listLayAudits = async () => { await delay(); return clone(db.layAudits.map(withLayTotals)); };
export const getLayAudit = async (id) => { await delay(); const row = db.layAudits.find((l) => l.id === Number(id)); return row ? clone(withLayTotals(row)) : null; };
export const saveLayAudit = async (payload) => {
  await delay();
  const existing = payload.id && db.layAudits.find((l) => l.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(withLayTotals(existing)); }
  const row = { id: nextId(db.layAudits), status: 'AUDITED', ...payload };
  db.layAudits.push(row);
  return clone(withLayTotals(row));
};

// ── FR-04 TMB Check ─────────────────────────────────────────────────────────
export const listTmbChecks = async () => { await delay(); return clone(db.tmbChecks); };
export const getTmbCheck = async (id) => { await delay(); return clone(db.tmbChecks.find((t) => t.id === Number(id))); };
export const saveTmbCheck = async (payload) => {
  await delay();
  const existing = payload.id && db.tmbChecks.find((t) => t.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.tmbChecks), ...payload };
  db.tmbChecks.push(row);
  return clone(row);
};

// ── FR-05 Cutting Report ────────────────────────────────────────────────────
export const getCuttingReport = async (cutPoId) => {
  await delay();
  const po = cutPo(cutPoId);
  if (!po) return null;
  const lays = db.reportLays.filter((l) => l.cutPoId === po.id);
  const received = db.receipts.filter((r) => r.cutPoId === po.id)
    .flatMap((r) => r.rolls).filter((r) => r.received).reduce((s, r) => s + r.weight, 0);
  const cutBySize = {}; const balance = {};
  po.sizes.forEach((sz) => {
    cutBySize[sz] = lays.reduce((s, l) => s + (l.sizeQty[sz] || 0), 0);
    balance[sz] = (po.sizeQty[sz] || 0) - cutBySize[sz];
  });
  return clone({
    cutPo: po, lays, cutBySize, balance,
    fabricRequired: round3(po.consumption * po.orderQty),
    fabricReceived: round3(received),
    totalCut: Object.values(cutBySize).reduce((s, v) => s + v, 0),
  });
};
export const addReportLay = async (payload) => {
  await delay();
  const row = { id: nextId(db.reportLays), ...payload };
  db.reportLays.push(row);
  return clone(row);
};

// ── FR-06/07 Bundling & Issue ───────────────────────────────────────────────
export const listBundlings = async () => { await delay(); return clone(db.bundlings); };
export const listBundles = async (cutPoId) => { await delay(); return clone(db.bundles.filter((b) => !cutPoId || b.cutPoId === Number(cutPoId))); };
export const generateBundles = async ({ cutPoId, bundleSize, cutBySize }) => {
  await delay();
  let bundleNo = db.bundles.filter((b) => b.cutPoId === Number(cutPoId)).reduce((m, b) => Math.max(m, b.bundleNo), 0);
  const created = [];
  Object.entries(cutBySize).forEach(([size, qty]) => {
    let done = 0;
    while (done < qty) {
      const pcs = Math.min(bundleSize, qty - done);
      bundleNo += 1;
      created.push({ id: nextId(db.bundles) + created.length, cutPoId: Number(cutPoId), bundleNo, size, qty: pcs, range: `${done + 1}-${done + pcs}`, status: 'BUNDLED' });
      done += pcs;
    }
  });
  db.bundles.push(...created);
  db.bundlings.push({ id: nextId(db.bundlings), cutPoId: Number(cutPoId), bundleSize, date: dayjs().format('YYYY-MM-DD'), status: 'BUNDLED', bundleIds: created.map((b) => b.id) });
  return clone(created);
};
export const listBundleIssues = async () => { await delay(); return clone(db.bundleIssues); };
export const issueBundles = async ({ cutPoId, workOrderNo, bundleIds }) => {
  await delay();
  const rows = db.bundles.filter((b) => bundleIds.includes(b.id));
  rows.forEach((b) => { b.status = 'ISSUED_SEWING'; });
  const issue = {
    id: nextId(db.bundleIssues), issueNo: docNo('BIS', db.bundleIssues), workOrderNo,
    cutPoId: Number(cutPoId), date: dayjs().format('YYYY-MM-DD'), bundleIds,
    totalPcs: rows.reduce((s, b) => s + b.qty, 0), issuedBy: 'Cutting Master',
  };
  db.bundleIssues.push(issue);
  return clone(issue);
};

// ── FR-08/09/10 External process ────────────────────────────────────────────
export const listPanelIssues = async () => { await delay(); return clone(db.panelIssues); };
export const savePanelIssue = async (payload) => {
  await delay();
  const row = { id: nextId(db.panelIssues), panelPoNo: payload.panelPoNo || docNo('PPO', db.panelIssues), status: 'ISSUED', ...payload };
  db.panelIssues.push(row);
  return clone(row);
};
export const listPanelChecks = async () => { await delay(); return clone(db.panelChecks); };
export const savePanelCheck = async (payload) => {
  await delay();
  const existing = payload.id && db.panelChecks.find((c) => c.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.panelChecks), ...payload };
  db.panelChecks.push(row);
  return clone(row);
};
export const listProcessReturns = async () => { await delay(); return clone(db.processReturns); };
export const saveProcessReturn = async (payload) => {
  await delay();
  const row = { id: nextId(db.processReturns), returnDcNo: docNo('RDC', db.processReturns), status: 'RETURNED', ...payload };
  db.processReturns.push(row);
  const issue = db.panelIssues.find((p) => p.id === payload.panelIssueId);
  if (issue) {
    const returned = db.processReturns.filter((r) => r.panelIssueId === issue.id)
      .flatMap((r) => r.lines).reduce((s, l) => s + l.returnQty, 0);
    const issued = issue.lines.reduce((s, l) => s + l.issueQty, 0);
    issue.status = returned >= issued ? 'FULLY_RETURNED' : 'PARTIALLY_RETURNED';
  }
  return clone(row);
};

// ── FR-11 Re-Cut Register ───────────────────────────────────────────────────
export const listReCutEntries = async () => { await delay(); return clone(db.reCutEntries); };
export const addReCutEntry = async (payload) => {
  await delay();
  const row = { id: nextId(db.reCutEntries), ...payload };
  db.reCutEntries.push(row);
  db.reCutFabricKg[payload.cutPoId] = round3((db.reCutFabricKg[payload.cutPoId] || 0) + (payload.qty || 0) * (cutPo(payload.cutPoId)?.consumption || 0));
  return clone(row);
};

// ── ENH-03 Reconciliation ───────────────────────────────────────────────────
export const getReconciliation = async (cutPoId) => {
  await delay();
  const po = cutPo(cutPoId);
  if (!po) return null;
  const receivedRolls = db.receipts.filter((r) => r.cutPoId === po.id).flatMap((r) => r.rolls).filter((r) => r.received);
  const usedByRoll = {};
  db.layAudits.filter((l) => l.cutPoId === po.id).forEach((l) => l.rolls.forEach((r) => {
    usedByRoll[r.rollNo] = round3((usedByRoll[r.rollNo] || 0) + (r.numLays || 0) * (r.weightPerLay || 0));
  }));
  const endBits = db.endBits[po.id] || {};
  const rows = receivedRolls.map((r) => {
    const used = usedByRoll[r.rollNo] || 0;
    const endBit = endBits[r.rollNo]?.weight || 0;
    return {
      rollNo: r.rollNo, received: r.weight, used, endBit,
      reusable: Boolean(endBits[r.rollNo]?.reusable),
      variance: round3(r.weight - used - endBit),
      status: used > 0 ? 'USED' : 'IN_STOCK',
    };
  });
  const received = round3(receivedRolls.reduce((s, r) => s + r.weight, 0));
  const used = round3(Object.values(usedByRoll).reduce((s, v) => s + v, 0));
  const endBitTotal = round3(rows.reduce((s, r) => s + r.endBit, 0));
  const reCutKg = db.reCutFabricKg[po.id] || 0;
  const inStock = round3(rows.filter((r) => r.status === 'IN_STOCK').reduce((s, r) => s + r.received, 0));
  const waste = round3(received - used - endBitTotal - reCutKg - inStock);
  const utilizationPct = received - inStock > 0 ? Math.round(((used + reCutKg) / (received - inStock)) * 1000) / 10 : 0;
  return clone({ cutPo: po, rows, received, used, endBitTotal, reCutKg, inStock, waste, utilizationPct });
};
export const saveEndBit = async (cutPoId, rollNo, patch) => {
  await delay(60);
  db.endBits[cutPoId] = db.endBits[cutPoId] || {};
  db.endBits[cutPoId][rollNo] = { ...db.endBits[cutPoId][rollNo], ...patch };
  return getReconciliation(cutPoId);
};

// ── ENH-04 Dashboard ────────────────────────────────────────────────────────
export const getDashboard = async () => {
  await delay();
  const today = dayjs().format('YYYY-MM-DD');
  const todayOutput = db.reportLays.filter((l) => l.date === today)
    .reduce((s, l) => s + Object.values(l.sizeQty).reduce((a, b) => a + b, 0), 0);
  const totalCut = db.reportLays.reduce((s, l) => s + Object.values(l.sizeQty).reduce((a, b) => a + b, 0), 0);
  const reCutQty = db.reCutEntries.reduce((s, e) => s + e.qty, 0);
  const tmbRows = db.tmbChecks.flatMap((t) => t.rows);
  const tmbPass = tmbRows.filter((r) => r.comment === 'OK').length;
  const bundleStatus = db.bundles.reduce((acc, b) => { acc[b.status] = (acc[b.status] || 0) + 1; return acc; }, {});
  const pendingRelaxations = db.relaxations.filter((r) => r.status === 'IN_PROGRESS').map((r) => {
    const minHrs = minRelaxHours(r.fabricType);
    const readyAt = dayjs(r.startTime).add(minHrs, 'hour');
    return { ...r, minHrs, readyAt: readyAt.format('DD-MMM HH:mm'), remainingHrs: Math.max(0, Math.round(readyAt.diff(dayjs(), 'minute') / 6) / 10), overdue: false };
  });
  const progress = db.cutPos.map((po) => {
    const cut = db.reportLays.filter((l) => l.cutPoId === po.id)
      .reduce((s, l) => s + Object.values(l.sizeQty).reduce((a, b) => a + b, 0), 0);
    return { cutPoNo: po.cutPoNo, styleNo: po.styleNo, color: po.color, orderQty: po.orderQty, cut, pct: Math.round((cut / po.orderQty) * 100) };
  });
  const alerts = [];
  db.cutPos.filter((p) => p.sizeSetStatus !== 'APPROVED').forEach((p) => alerts.push({ type: 'warning', text: `${p.cutPoNo}: Size-set cut approval pending — bulk lay is blocked` }));
  db.tmbChecks.filter((t) => t.status === 'PENDING').forEach((t) => alerts.push({ type: 'error', text: `Lay ${t.layNo} (${cutPo(t.cutPoId)?.cutPoNo}): TMB check pending sign-off with out-of-tolerance rows` }));
  db.panelIssues.filter((p) => p.status === 'PARTIALLY_RETURNED').forEach((p) => alerts.push({ type: 'info', text: `${p.panelPoNo}: ${p.process} panels partially returned — balance outstanding` }));
  const reCutPct = totalCut ? Math.round((reCutQty / totalCut) * 1000) / 10 : 0;
  if (reCutPct > THRESHOLDS.reCutAlertPct) alerts.push({ type: 'error', text: `Re-cut rate ${reCutPct}% exceeds ${THRESHOLDS.reCutAlertPct}% threshold` });
  return clone({
    todayOutput, totalCut, reCutQty, reCutPct,
    tmbPassPct: tmbRows.length ? Math.round((tmbPass / tmbRows.length) * 1000) / 10 : 100,
    bundleStatus, pendingRelaxations, progress, alerts,
  });
};
