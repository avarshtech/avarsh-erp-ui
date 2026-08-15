/**
 * In-memory mock API for the Finishing module (design phase). Computes the PRD
 * quality math (AQL 2.5 sampling, DHU, RFT%, alteration rate, WIP aging) so
 * screens show live, consistent figures without a backend.
 */
import dayjs from 'dayjs';
import {
  HOURS, AQL_25_TABLE, DHU_ALERT_PCT, ALTERATION_ALERT_PCT,
  RECEIVING_SHORTAGE_PCT, WIP_AGING_DAYS, REALTER_CYCLE_ALERT,
} from '../../utils/finishingConstants';
import * as seed from './finishingMockData';
import { seedOrders } from './sewingMockData';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
const docNo = (prefix, rows) => `${prefix}-${dayjs().format('YYYYMMDD')}-${String(rows.length + 1).padStart(3, '0')}`;

const db = {
  orders: clone(seedOrders),
  employees: clone(seed.seedEmployees),
  receivings: clone(seed.seedReceivings),
  hourlySheets: clone(seed.seedHourlySheets),
  spotWash: clone(seed.seedSpotWash),
  checkings: clone(seed.seedCheckings),
  measurements: clone(seed.seedMeasurements),
  alterations: clone(seed.seedAlterations),
  metalDetection: clone(seed.seedMetalDetection),
  needleLog: clone(seed.seedNeedleLog),
  shadeGroups: clone(seed.seedShadeGroups),
};

export const rowTotal = (row) => HOURS.reduce((s, h) => s + (row[h] || 0), 0) + (row.ot || 0);

/** AQL 2.5 lookup: lot size → { sample, accept, reject } (PRD §17.2). */
export const aqlSample = (lotSize) => {
  const hit = AQL_25_TABLE.find(([min, max]) => lotSize >= min && lotSize <= max);
  if (!hit) return null;
  const [, , sample, accept, reject] = hit;
  return { sample: Math.min(sample, lotSize), accept, reject };
};

export const dhuPct = (defects, checked) => (checked
  ? Math.round((defects / checked) * 1000) / 10 : 0);

// ── Lookups ─────────────────────────────────────────────────────────────────
export const getOrders = async () => { await delay(); return clone(db.orders); };
export const getEmployees = async (station) => {
  await delay();
  return clone(station ? db.employees.filter((e) => e.station === station) : db.employees);
};

// ── Module 1: Receiving ─────────────────────────────────────────────────────
export const listReceivings = async () => { await delay(); return clone(db.receivings); };
export const saveReceiving = async (payload) => {
  await delay();
  const prev = db.receivings
    .filter((r) => r.orderId === payload.orderId && r.size === payload.size && r.color === payload.color)
    .reduce((s, r) => s + r.receivingQty, 0);
  const cumulativeQty = prev + (payload.receivingQty || 0);
  const status = (cumulativeQty / payload.orderQty) * 100 < RECEIVING_SHORTAGE_PCT ? 'SHORTAGE' : 'RECEIVED';
  const row = { id: nextId(db.receivings), receivingNo: docNo('FRN', db.receivings), cumulativeQty, status, ...payload };
  db.receivings.push(row);
  return clone(row);
};

// ── Modules 2/3/6: Hourly stations ──────────────────────────────────────────
export const getHourlySheet = async ({ station, date }) => {
  await delay();
  const found = db.hourlySheets.find((h) => h.station === station && h.date === date);
  if (found) return clone(found);
  return clone({
    id: null, station, orderId: db.orders[0]?.id, color: 'Navy Blue', date, target: 200,
    ...(station === 'IRONING' ? { ratePerPiece: 1.5, ironTemp: '150°C', ironMethod: 'Steam' } : {}),
    rows: db.employees.filter((e) => e.station === station).map((e) => ({
      employeeId: e.id, hr1: null, hr2: null, hr3: null, hr4: null, hr5: null, hr6: null, hr7: null, hr8: null, ot: null,
    })),
  });
};
export const saveHourlySheet = async (payload) => {
  await delay();
  const existing = payload.id && db.hourlySheets.find((h) => h.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { ...payload, id: nextId(db.hourlySheets) };
  db.hourlySheets.push(row);
  return clone(row);
};

// ── Module 4: Spot wash ─────────────────────────────────────────────────────
export const listSpotWash = async () => { await delay(); return clone(db.spotWash); };
export const saveSpotWash = async (payload) => {
  await delay();
  const existing = payload.id && db.spotWash.find((s) => s.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.spotWash), ...payload };
  db.spotWash.push(row);
  return clone(row);
};

// ── Module 5: Checking (auto-creates alterations per BR 8.3) ────────────────
export const listCheckings = async () => { await delay(); return clone(db.checkings); };
export const getChecking = async (id) => { await delay(); return clone(db.checkings.find((c) => c.id === Number(id))); };
export const saveChecking = async (payload) => {
  await delay();
  const existing = payload.id && db.checkings.find((c) => c.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.checkings), checkNo: docNo('FCK', db.checkings), status: 'COMPLETED', ...payload };
  db.checkings.push(row);
  if (row.alterQty > 0) {
    db.alterations.push({
      id: nextId(db.alterations), alterNo: docNo('ALT', db.alterations),
      orderId: row.orderId, color: row.color, size: row.size || '—', date: row.date,
      alterPcs: row.alterQty, defectCode: row.defects?.[0]?.code || 'M-01', source: 'FINISHING',
      doneById: null, recheckResult: 'PENDING', cycles: 1,
      remarks: `Auto-created from ${row.checkNo}`, status: 'IN_PROGRESS',
    });
  }
  return clone(row);
};

// ── Module 7: Measurement ───────────────────────────────────────────────────
export const listFinishingMeasurements = async () => { await delay(); return clone(db.measurements); };
export const getFinishingMeasurement = async (id) => { await delay(); return clone(db.measurements.find((m) => m.id === Number(id))); };
export const saveFinishingMeasurement = async (payload) => {
  await delay();
  const existing = payload.id && db.measurements.find((m) => m.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.measurements), reportNo: docNo('FMR', db.measurements), ...payload };
  db.measurements.push(row);
  return clone(row);
};

// ── Module 8: Alterations ───────────────────────────────────────────────────
export const listAlterations = async () => { await delay(); return clone(db.alterations); };
export const saveAlteration = async (payload) => {
  await delay();
  const existing = payload.id && db.alterations.find((a) => a.id === payload.id);
  if (existing) {
    if (payload.recheckResult === 'RE_ALTER' && existing.recheckResult !== 'RE_ALTER') payload.cycles = (existing.cycles || 1) + 1;
    if (payload.recheckResult === 'PASS') payload.status = 'CLOSED';
    Object.assign(existing, payload);
    return clone(existing);
  }
  const row = { id: nextId(db.alterations), alterNo: docNo('ALT', db.alterations), cycles: 1, status: 'IN_PROGRESS', ...payload };
  db.alterations.push(row);
  return clone(row);
};

// ── Module 9: Metal detection + needle log ──────────────────────────────────
export const listMetalDetection = async () => { await delay(); return clone(db.metalDetection); };
export const saveMetalDetection = async (payload) => {
  await delay();
  const existing = payload.id && db.metalDetection.find((m) => m.id === payload.id);
  if (existing) { Object.assign(existing, payload); return clone(existing); }
  const row = { id: nextId(db.metalDetection), ...payload };
  db.metalDetection.push(row);
  return clone(row);
};
export const listNeedleLog = async () => { await delay(); return clone(db.needleLog); };

// ── Module 10: Shade segregation ────────────────────────────────────────────
export const listShadeGroups = async () => { await delay(); return clone(db.shadeGroups); };
export const saveShadeGroup = async (payload) => {
  await delay();
  const row = { id: nextId(db.shadeGroups), status: 'SEGREGATED', ...payload };
  db.shadeGroups.push(row);
  return clone(row);
};

// ── Dashboard aggregates ────────────────────────────────────────────────────
const checkedTotals = (rowsFilter) => {
  const sheets = db.checkings.filter(rowsFilter);
  const checked = sheets.reduce((s, c) => s + (c.passQty + c.alterQty + c.rejectQty), 0);
  const defects = sheets.reduce((s, c) => s + (c.defects || []).reduce((x, d) => x + d.count, 0), 0);
  const altered = sheets.reduce((s, c) => s + c.alterQty, 0);
  return { checked, defects, altered };
};

export const getFinishingDashboard = async () => {
  await delay();
  const t = dayjs().format('YYYY-MM-DD');
  const { checked, defects, altered } = checkedTotals((c) => c.date === t);
  const dhu = dhuPct(defects, checked);
  const rft = checked ? Math.round(((checked - altered) / checked) * 1000) / 10 : 0;
  const alterationRate = checked ? Math.round((altered / checked) * 1000) / 10 : 0;

  const received = db.receivings.reduce((s, r) => s + r.receivingQty, 0);
  const trimmed = db.hourlySheets.filter((h) => h.station === 'THREAD_TRIM').reduce((s, h) => s + h.rows.reduce((x, r) => x + rowTotal(r), 0), 0);
  const kaja = db.hourlySheets.filter((h) => h.station === 'KAJA_BUTTON').reduce((s, h) => s + h.rows.reduce((x, r) => x + rowTotal(r), 0), 0);
  const checkedAll = checkedTotals(() => true).checked;
  const ironed = db.hourlySheets.filter((h) => h.station === 'IRONING').reduce((s, h) => s + h.rows.reduce((x, r) => x + rowTotal(r), 0), 0);
  const detected = db.metalDetection.reduce((s, m) => s + m.pass, 0);
  const segregated = db.shadeGroups.reduce((s, g) => s + g.qty, 0);
  const funnel = [
    { stage: 'Received', qty: received }, { stage: 'Thread trimmed', qty: trimmed },
    { stage: 'Kaja / Button', qty: kaja }, { stage: 'Checked', qty: checkedAll },
    { stage: 'Ironed', qty: ironed }, { stage: 'Metal detected', qty: detected },
    { stage: 'Shade segregated', qty: segregated },
  ];

  const oldestReceiving = db.receivings.reduce((m, r) => Math.max(m, dayjs(t).diff(dayjs(r.date), 'day')), 0);
  const wip = Math.max(0, received - segregated);

  const alerts = [];
  db.receivings.filter((r) => r.status === 'SHORTAGE').forEach((r) => alerts.push({
    type: 'warning', text: `${r.receivingNo}: cumulative received below ${RECEIVING_SHORTAGE_PCT}% of order qty (${r.size} · ${r.cumulativeQty}/${r.orderQty})`,
  }));
  if (dhu > DHU_ALERT_PCT) alerts.push({ type: 'error', text: `DHU ${dhu}% today exceeds ${DHU_ALERT_PCT}% threshold` });
  if (alterationRate > ALTERATION_ALERT_PCT) alerts.push({ type: 'error', text: `Alteration rate ${alterationRate}% exceeds ${ALTERATION_ALERT_PCT}% threshold` });
  db.measurements.filter((m) => m.lotStatus === 'HOLD').forEach((m) => alerts.push({
    type: 'error', text: `${m.reportNo}: lot on HOLD — measurement out of tolerance after ironing`,
  }));
  db.metalDetection.filter((m) => !m.calibrationOk).forEach((m) => alerts.push({
    type: 'error', text: `${m.machineNo}: metal-detector calibration overdue — scanning blocked`,
  }));
  db.alterations.filter((a) => a.cycles >= REALTER_CYCLE_ALERT && a.status !== 'CLOSED').forEach((a) => alerts.push({
    type: 'warning', text: `${a.alterNo}: ${a.cycles} re-alter cycles — supervisor review needed`,
  }));
  if (oldestReceiving > WIP_AGING_DAYS) alerts.push({ type: 'warning', text: `WIP aging: oldest batch in finishing for ${oldestReceiving} days (limit ${WIP_AGING_DAYS})` });
  db.needleLog.filter((n) => !n.allPiecesFound).forEach((n) => alerts.push({
    type: 'error', text: `Needle log ${n.date}: broken needle pieces NOT fully recovered — lot must be 100% scanned`,
  }));

  return clone({ dhu, rft, alterationRate, wip, oldestReceiving, funnel, alerts });
};
