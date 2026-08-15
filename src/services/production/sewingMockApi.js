/**
 * In-memory mock API for the Sewing module (design phase). Computes the PRD
 * KPI math (efficiency, target/hour, DHU, incentives) so screens show live,
 * consistent figures without a backend.
 */
import dayjs from 'dayjs';
import { HOURS, INCENTIVE_CONFIG, DHU_THRESHOLD_PCT, trafficLight } from '../../utils/sewingConstants';
import * as seed from './sewingMockData';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
const docNo = (prefix, rows) => `${prefix}-${dayjs().format('YYYYMMDD')}-${String(rows.length + 1).padStart(3, '0')}`;

const db = {
  orders: clone(seed.seedOrders),
  operators: clone(seed.seedOperators),
  samValues: clone(seed.seedSamValues),
  plans: clone(seed.seedPlans),
  cutReceipts: clone(seed.seedCutReceipts),
  garmentIssues: clone(seed.seedGarmentIssues),
  hourly: clone(seed.seedHourly),
  trimCards: clone(seed.seedTrimCards),
  measurements: clone(seed.seedMeasurements),
  topse: clone(seed.seedTopse),
  replacements: clone(seed.seedReplacements),
};

const order = (id) => db.orders.find((o) => o.id === Number(id));

export const rowTotal = (row) => HOURS.reduce((s, h) => s + (row[h] || 0), 0) + (row.ot || 0);

/** Line efficiency % = (Output x SAM) / (Operators x Work Minutes) x 100. */
export const efficiencyPct = (output, sam, operators, workedHours = 8) => {
  const denom = operators * workedHours * 60;
  return denom > 0 ? Math.round(((output * sam) / denom) * 1000) / 10 : 0;
};

/** Target/hour = (Operators x 60) / SAM x Target Efficiency %. */
export const targetPerHour = (operators, sam, targetEffPct) => (sam > 0
  ? Math.round(((operators * 60) / sam) * (targetEffPct / 100)) : 0);

// ── Lookups ─────────────────────────────────────────────────────────────────
export const getOrders = async () => { await delay(); return clone(db.orders); };
export const getOperators = async () => { await delay(); return clone(db.operators); };
export const getSamValues = async () => { await delay(); return clone(db.samValues); };
export const saveOperator = async (payload) => {
  await delay();
  const existing = payload.id && db.operators.find((o) => o.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.operators), status: 'ACTIVE', grades: {}, ...payload };
  db.operators.push(row);
  return clone(row);
};

// ── 4.1 Production Plan ─────────────────────────────────────────────────────
export const listPlans = async () => { await delay(); return clone(db.plans); };
export const getPlan = async (id) => { await delay(); return clone(db.plans.find((p) => p.id === Number(id))); };
export const savePlan = async (payload) => {
  await delay();
  const existing = payload.id && db.plans.find((p) => p.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.plans), planNo: `SPL-${dayjs().format('YYYY')}-${String(db.plans.length + 1).padStart(4, '0')}`, status: 'DRAFT', ...payload };
  db.plans.push(row);
  return clone(row);
};
export const setPlanStatus = async (id, status) => {
  await delay();
  const row = db.plans.find((p) => p.id === Number(id));
  row.status = status;
  return clone(row);
};

// ── 4.2 Cut Parts Receipt ───────────────────────────────────────────────────
export const listCutReceipts = async () => { await delay(); return clone(db.cutReceipts); };
export const saveCutReceipt = async (payload) => {
  await delay();
  const row = { id: nextId(db.cutReceipts), receiptNo: docNo('SCR', db.cutReceipts), ...payload };
  db.cutReceipts.push(row);
  return clone(row);
};

// ── 4.4 Garment Issue ───────────────────────────────────────────────────────
export const listGarmentIssues = async () => { await delay(); return clone(db.garmentIssues); };
/** Cumulative issued per size for an order (feeds Prev Issued + Balance). */
export const issuedBySize = async (orderId) => {
  await delay(60);
  const totals = {};
  db.garmentIssues.filter((g) => g.orderId === Number(orderId))
    .forEach((g) => g.lines.forEach((l) => { totals[l.size] = (totals[l.size] || 0) + l.currentQty; }));
  return totals;
};
export const saveGarmentIssue = async (payload) => {
  await delay();
  const row = { id: nextId(db.garmentIssues), issueNo: docNo('GIS', db.garmentIssues), status: 'ISSUED', ...payload };
  db.garmentIssues.push(row);
  return clone(row);
};

// ── 4.3 Hourly Production ───────────────────────────────────────────────────
export const listHourly = async () => { await delay(); return clone(db.hourly); };
export const getHourlySheet = async ({ planId, date, shift }) => {
  await delay();
  const found = db.hourly.find((h) => h.planId === Number(planId) && h.date === date && h.shift === shift);
  if (found) return clone(found);
  const plan = db.plans.find((p) => p.id === Number(planId));
  return clone({
    id: null, planId: Number(planId), orderId: plan?.orderId, line: plan?.line, date, shift,
    plannedOperators: plan?.operators ?? 0, presentOperators: plan?.operators ?? 0, status: 'IN_PROGRESS',
    rows: (plan?.operations || []).slice(0, 6).map((op) => ({
      operatorId: op.operatorId, part: op.operation,
      hr1: null, hr2: null, hr3: null, hr4: null, hr5: null, hr6: null, hr7: null, hr8: null, ot: null,
    })),
  });
};
export const saveHourlySheet = async (payload) => {
  await delay();
  const existing = payload.id && db.hourly.find((h) => h.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { ...payload, id: nextId(db.hourly) };
  db.hourly.push(row);
  return clone(row);
};

// ── 4.5 Trim Verification ───────────────────────────────────────────────────
export const listTrimCards = async () => { await delay(); return clone(db.trimCards); };
export const saveTrimCard = async (payload) => {
  await delay();
  const existing = payload.id && db.trimCards.find((c) => c.id === payload.id);
  const hasMissing = Object.values({ ...payload.materials, ...payload.approvals }).includes('MISSING');
  const openIssues = (payload.issues || []).some((i) => i.status === 'OPEN');
  const status = hasMissing || openIssues ? 'ISSUES_FOUND' : 'ALL_CLEAR';
  if (existing) { Object.assign(existing, payload, { status }); return clone(existing); }
  const row = { id: nextId(db.trimCards), cardNo: docNo('TVC', db.trimCards), status, ...payload };
  db.trimCards.push(row);
  return clone(row);
};

// ── 4.6 Measurement Reports ─────────────────────────────────────────────────
export const listMeasurements = async () => { await delay(); return clone(db.measurements); };
export const getMeasurement = async (id) => { await delay(); return clone(db.measurements.find((m) => m.id === Number(id))); };
export const saveMeasurement = async (payload) => {
  await delay();
  const existing = payload.id && db.measurements.find((m) => m.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.measurements), reportNo: docNo('SMR', db.measurements), ...payload };
  db.measurements.push(row);
  return clone(row);
};
/** Spec sheet per style — mock "Tech Pack" auto-population (BR 4.6.3). */
export const specPoints = (styleNo, size) => {
  const base = styleNo === 'HM-TS-2601'
    ? [['Chest round', 104, 1], ['Center back length', 72, 1], ['Sleeve length', 23.5, 0.5], ['Neck width', 18.5, 0.5], ['Bottom hem width', 100, 1]]
    : [['Waist', 82, 1], ['Inseam', 78, 1], ['Front rise', 26, 0.5], ['Thigh round', 58, 1]];
  const sizeShift = { S: -4, M: 0, L: 4, XL: 8, 30: -4, 32: 0, 34: 4, 36: 8 }[size] ?? 0;
  return base.map(([point, spec, tol]) => ({ point, spec: spec + (point.includes('length') || point.includes('rise') ? sizeShift / 2 : sizeShift), tol, actual: null, remarks: '' }));
};

// ── 4.7 TOPSE ───────────────────────────────────────────────────────────────
export const listTopse = async () => { await delay(); return clone(db.topse); };
export const getTopse = async (id) => { await delay(); return clone(db.topse.find((t) => t.id === Number(id))); };
export const saveTopse = async (payload) => {
  await delay();
  const existing = payload.id && db.topse.find((t) => t.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.topse), reportNo: docNo('TOPSE', db.topse), ...payload };
  db.topse.push(row);
  return clone(row);
};

// ── 4.8 Replacements ────────────────────────────────────────────────────────
export const listReplacements = async () => { await delay(); return clone(db.replacements); };
export const saveReplacement = async (payload) => {
  await delay();
  const existing = payload.id && db.replacements.find((r) => r.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.replacements), requestNo: docNo('CPR', db.replacements), status: 'REQUESTED', ...payload };
  db.replacements.push(row);
  return clone(row);
};

// ── 5.3 Incentives ──────────────────────────────────────────────────────────
export const getIncentives = async (date) => {
  await delay();
  const sheets = db.hourly.filter((h) => !date || h.date === date);
  const out = [];
  sheets.forEach((sheet) => {
    const plan = db.plans.find((p) => p.id === sheet.planId);
    const dhu = latestDhuForLine(sheet.line);
    sheet.rows.forEach((row) => {
      const op = db.operators.find((o) => o.id === row.operatorId);
      const output = rowTotal(row);
      // Operator efficiency uses their own operation SAM against an 8h shift.
      const opSam = plan?.operations.find((x) => x.operatorId === row.operatorId)?.sam
        ?? (plan?.sam || 0) / (plan?.operations.length || 1);
      const eff = efficiencyPct(output, opSam, 1, 8);
      const slab = INCENTIVE_CONFIG.slabs.find((s) => eff >= s.from && eff < s.to);
      let amount = slab ? slab.amount : 0;
      let deduction = 0;
      if (amount && dhu > DHU_THRESHOLD_PCT) { deduction = Math.round(amount * (INCENTIVE_CONFIG.dhuDeductionPct / 100)); amount -= deduction; }
      out.push({
        date: sheet.date, line: sheet.line, operatorId: row.operatorId, operator: op?.name || '—',
        output, effPct: eff, slab: slab ? `${slab.from}-${slab.to === 999 ? '+' : slab.to}%` : 'Below base',
        gross: slab ? slab.amount : 0, dhuDeduction: deduction, net: amount,
      });
    });
  });
  return clone(out);
};

const latestDhuForLine = (line) => {
  const reports = db.topse.filter((t) => t.line === line);
  if (!reports.length) return 0;
  const t = reports[reports.length - 1];
  const defects = t.defects.reduce((s, d) => s + d.count, 0);
  return t.totalInspected ? Math.round((defects / t.totalInspected) * 1000) / 10 : 0;
};

// ── 6.1 Floor dashboard ─────────────────────────────────────────────────────
export const getFloorDashboard = async () => {
  await delay();
  const today = dayjs().format('YYYY-MM-DD');
  const lines = db.plans.filter((p) => p.status === 'IN_PROGRESS').map((plan) => {
    const sheet = db.hourly.find((h) => h.planId === plan.id && h.date === today);
    const output = sheet ? sheet.rows.reduce((s, r) => s + rowTotal(r), 0) : 0;
    // Line output = bottleneck-ish: use last-operation operator total as garments completed.
    const lastRow = sheet?.rows[sheet.rows.length - 1];
    const completed = lastRow ? rowTotal(lastRow) : 0;
    const operators = sheet?.presentOperators ?? plan.operators;
    const workedHours = sheet ? HOURS.filter((h) => sheet.rows.some((r) => r[h] != null)).length : 0;
    const eff = efficiencyPct(completed, plan.sam, operators, workedHours || 8);
    const tph = targetPerHour(plan.operators, plan.sam, plan.targetEfficiencyPct);
    const lastHourKey = [...HOURS].reverse().find((h) => sheet?.rows.some((r) => r[h] != null));
    const lastHourOut = lastHourKey && lastRow ? (lastRow[lastHourKey] || 0) : 0;
    const dhu = latestDhuForLine(plan.line);
    const o = order(plan.orderId);
    return {
      line: plan.line, planNo: plan.planNo, orderNo: o?.orderNo, styleNo: o?.styleNo,
      operatorsPlanned: plan.operators, operatorsPresent: operators,
      absenteeismPct: plan.operators ? Math.round(((plan.operators - operators) / plan.operators) * 100) : 0,
      output, completed, targetPerHourVal: tph, targetPerDay: tph * plan.workingHours,
      lastHourOut, effPct: eff, light: trafficLight(eff), dhu, wip: Math.max(0, 134 - completed),
    };
  });
  const alerts = [];
  lines.forEach((l) => {
    if (l.light === 'red') alerts.push({ type: 'error', text: `${l.line}: efficiency ${l.effPct}% — immediate intervention needed` });
    else if (l.light === 'yellow') alerts.push({ type: 'warning', text: `${l.line}: efficiency ${l.effPct}% — monitor closely` });
    if (l.absenteeismPct > 10) alerts.push({ type: 'warning', text: `${l.line}: absenteeism ${l.absenteeismPct}% is hurting target` });
    if (l.dhu > DHU_THRESHOLD_PCT) alerts.push({ type: 'error', text: `${l.line}: DHU ${l.dhu}% above ${DHU_THRESHOLD_PCT}% threshold` });
  });
  db.replacements.filter((r) => r.status !== 'CLOSED' && r.status !== 'DELIVERED')
    .forEach((r) => alerts.push({ type: 'info', text: `${r.requestNo}: parts replacement pending with cutting` }));
  return clone({ lines, alerts });
};
