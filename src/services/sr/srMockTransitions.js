/**
 * Status machine + feedback actions for Sample Requests (R2 flow).
 * SUBMITTED → IN_PRODUCTION happens ONLY via Sample Request Issue (material
 * issued, srMockIssues); IN_PRODUCTION → DISPATCHED ONLY via the dispatch
 * entity (srMockDispatches). changeStatus rejects both here so no screen can
 * bypass the gates. Feedback decisions are terminal — no auto Round-2 (R2).
 */
import { loadDb, saveDb } from './srMockStore';
import {
  decorate, fail, pushActivity, currentUserName, todayStr,
} from './srMockApi';
import {
  SR_STATUS, SR_TRANSITIONS, FEEDBACK_DECISIONS, DECISION_TO_STATUS,
} from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const findSr = (db, id) => {
  const sr = db.requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  return sr;
};

/** Shared status stamper — also used by srMockIssues / srMockDispatches. */
export const stampStatus = (sr, target) => {
  sr.status = target;
  sr.statusHistory = sr.statusHistory || [];
  sr.statusHistory.push({ status: target, date: todayStr(), user: currentUserName() });
  pushActivity(sr, `Status changed to ${target.replace(/_/g, ' ')}`);
  sr.version = (sr.version || 0) + 1;
};

/** Consignee country ≠ exporter country → commercial invoice required. */
export const isOverseas = (sr, db = loadDb()) => {
  const exporterCountry = db.masters.companyProfileExtra.exporterCountryFallback || 'India';
  return Boolean(sr.buyerCountry) && sr.buyerCountry.toLowerCase() !== exporterCountry.toLowerCase();
};

const validateSubmitGate = (sr) => {
  const missing = [];
  if (!sr.sampleTypeName) missing.push('Sample Type');
  if (!sr.sampleQty) missing.push('Sample Quantity');
  if (!sr.sizes?.length) missing.push('Sizes');
  if (!sr.inHandDate) missing.push('Sample In-Hand Date');
  if (!sr.dispatchDeadline) missing.push('Dispatch Deadline');
  if (!sr.buyerApprovalDeadline) missing.push('Buyer Approval Deadline');
  if (missing.length) fail('VALIDATION', `Cannot submit — missing: ${missing.join(', ')}`);
  if (sr.inHandDate > sr.dispatchDeadline || sr.dispatchDeadline > sr.buyerApprovalDeadline) {
    fail('VALIDATION', 'Deadline sequence invalid: In-Hand ≤ Dispatch ≤ Buyer Approval');
  }
};

export const changeStatus = async (id, target) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  const allowed = SR_TRANSITIONS[sr.status] || [];
  if (!allowed.includes(target)) {
    fail('CONFLICT', `Transition ${sr.status} → ${target} is not permitted`);
  }
  if (target === SR_STATUS.SUBMITTED) validateSubmitGate(sr);
  if (target === SR_STATUS.IN_PRODUCTION) {
    fail('CONFLICT', 'Production starts when material is issued — Inventory → Material Issue → Sample Request Issue');
  }
  if (target === SR_STATUS.DISPATCHED) {
    fail('CONFLICT', 'Dispatching happens on the Dispatches screen — add this SR to a dispatch');
  }
  stampStatus(sr, target);
  saveDb(db);
  return decorate(sr);
};

/** "Save as Draft" on Customer Comments — persists the record, status unchanged. */
export const saveFeedbackDraft = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  if (![SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status)) {
    fail('CONFLICT', 'Customer comments can only be logged for a Dispatched SR');
  }
  sr.feedback = clone(dto);
  pushActivity(sr, 'Customer comments saved as draft (status unchanged)');
  saveDb(db);
  return decorate(sr);
};

/**
 * Customer comments (R2). Dispatched → Feedback Received (may rest awaiting a
 * decision) → decision routes to APPROVED / REJECTED / REVISION_REQUIRED —
 * all TERMINAL. No next round is auto-created; the buyer's spec sheet means
 * ~95% of samples are never redone.
 */
export const recordFeedback = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  if (![SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status)) {
    fail('CONFLICT', 'Customer comments can only be logged for a Dispatched SR');
  }
  const missing = [];
  if (!dto.date) missing.push('Feedback Received Date');
  if (!dto.from) missing.push('Feedback From');
  if (!dto.decision) missing.push('Overall Decision');
  if (missing.length) fail('VALIDATION', `Customer comments incomplete — missing: ${missing.join(', ')}`);
  if (!Object.values(FEEDBACK_DECISIONS).includes(dto.decision)) {
    fail('VALIDATION', `Unknown decision: ${dto.decision}`);
  }

  sr.feedback = clone(dto);
  if (sr.status === SR_STATUS.DISPATCHED) stampStatus(sr, SR_STATUS.FEEDBACK_RECEIVED);
  if (dto.importSource) {
    pushActivity(sr, `Customer comments recorded — set by import from ${dto.importSource}`);
  } else {
    pushActivity(sr, 'Customer comments recorded');
  }
  // Unmapped extracted values are never silently dropped
  (dto.unmappedValues || []).forEach((u) => {
    pushActivity(sr, `Unmapped value retained from ${dto.importSource || 'import'}`, {
      details: `${u.label}: ${u.value} (${u.sourceRef})`,
    });
  });

  stampStatus(sr, DECISION_TO_STATUS[dto.decision]);
  saveDb(db);
  return decorate(sr);
};
