/**
 * Bill Passing configuration masters (PRD FR-BP-1201). Mirrors:
 *   GET/POST/PUT/DELETE /inventory/bill-passing/masters/{debit-types|charge-types|issue-types}
 *   GET/PUT             /inventory/bill-passing/masters/tolerance
 *
 * A type that is already referenced by a bill is deactivated rather than
 * deleted, so historical bills keep rendering the name they were passed under.
 */
import { loadDb, saveDb } from './billPassingMockStore';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };

const COLLECTIONS = {
  debitType: { key: 'debitTypes', label: 'Debit type', usedBy: (db, code) => db.bills.some((b) => (b.debits || []).some((d) => d.debitTypeCode === code)) },
  chargeType: { key: 'chargeTypes', label: 'Charge type', usedBy: (db, code) => db.bills.some((b) => (b.charges || []).some((c) => c.chargeTypeCode === code)) },
  issueType: { key: 'issueTypes', label: 'Issue type', usedBy: (db, code) => db.bills.some((b) => (b.issues || []).some((i) => i.issueTypeCode === code)) },
};

const nextId = (arr) => Math.max(0, ...arr.map((r) => r.id || 0)) + 1;

const list = async (kind, { includeInactive = true } = {}) => {
  await delay(60);
  const db = loadDb();
  const rows = db[COLLECTIONS[kind].key] || [];
  return clone(includeInactive ? rows : rows.filter((r) => r.active));
};

const save = async (kind, row) => {
  await delay();
  const db = loadDb();
  const { key, label } = COLLECTIONS[kind];
  const rows = db[key];
  if (!row.code) fail('VALIDATION', `${label} code is required.`);
  if (!row.name) fail('VALIDATION', `${label} name is required.`);

  const clash = rows.find((r) => r.id !== row.id && r.code.toLowerCase() === String(row.code).toLowerCase());
  if (clash) fail('CONFLICT', `${label} code ${row.code} already exists.`);

  const existing = rows.find((r) => r.id === row.id);
  if (existing) {
    Object.assign(existing, row);
  } else {
    rows.push({ id: nextId(rows), active: true, sortOrder: (rows.length + 1) * 10, ...row });
  }
  saveDb(db);
  return clone(existing || rows[rows.length - 1]);
};

const remove = async (kind, id) => {
  await delay();
  const db = loadDb();
  const { key, label, usedBy } = COLLECTIONS[kind];
  const row = (db[key] || []).find((r) => r.id === Number(id));
  if (!row) fail('NOT_FOUND', `${label} not found`);
  if (usedBy(db, row.code)) {
    fail('CONFLICT', `${row.name} is used on existing bills. Deactivate it instead so past bills keep their history.`);
  }
  db[key] = db[key].filter((r) => r.id !== row.id);
  saveDb(db);
  return { id: row.id };
};

export const listDebitTypes = (opts) => list('debitType', opts);
export const saveDebitType = (row) => save('debitType', row);
export const deleteDebitType = (id) => remove('debitType', id);

export const listChargeTypes = (opts) => list('chargeType', opts);
export const saveChargeType = (row) => save('chargeType', row);
export const deleteChargeType = (id) => remove('chargeType', id);

export const listIssueTypes = (opts) => list('issueType', opts);
export const saveIssueType = (row) => save('issueType', row);
export const deleteIssueType = (id) => remove('issueType', id);

export const getTolerance = async () => {
  await delay(60);
  return clone(loadDb().tolerance);
};

export const saveTolerance = async (values) => {
  await delay();
  const db = loadDb();
  const numeric = ['qtyPercent', 'ratePercent', 'valueAmount', 'taxVarianceAmount', 'invoiceAgeDays', 'debitPercentThreshold', 'holdEscalationDays'];
  numeric.forEach((f) => {
    if (values[f] != null && (Number.isNaN(Number(values[f])) || Number(values[f]) < 0)) {
      fail('VALIDATION', `${f} must be zero or a positive number.`);
    }
  });
  db.tolerance = { ...db.tolerance, ...values, id: 1 };
  saveDb(db);
  return clone(db.tolerance);
};
