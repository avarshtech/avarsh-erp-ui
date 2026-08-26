/**
 * Status machine + workflow actions for Sample Requests (PRD v3 §14, §8.4, §8.5).
 * Gates are enforced here — the screens only reflect them (disabled-with-reason).
 */
import { loadDb, saveDb, nextSrNo } from './srMockStore';
import {
  decorate, fail, pushActivity, currentUserName, todayStr,
} from './srMockApi';
import {
  SR_STATUS, SR_TRANSITIONS, DELIVERY_METHODS, FEEDBACK_DECISIONS, DECISION_TO_STATUS,
  SAMPLE_INVOICE_STATUS,
} from '../../utils/sampleRequestConstants';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));

const findSr = (db, id) => {
  const sr = db.requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  return sr;
};

const applyStatus = (sr, target) => {
  sr.status = target;
  sr.statusHistory = sr.statusHistory || [];
  sr.statusHistory.push({ status: target, date: todayStr(), user: currentUserName() });
  pushActivity(sr, `Status changed to ${target.replace(/_/g, ' ')}`);
  sr.version = (sr.version || 0) + 1;
};

/** Consignee country ≠ exporter country → commercial invoice required (PRD §8.4). */
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
  if (target === SR_STATUS.DISPATCHED) {
    fail('CONFLICT', 'Use the Dispatch Update panel — dispatch fields are required to mark as Dispatched');
  }
  applyStatus(sr, target);
  saveDb(db);
  return decorate(sr);
};

const validateDispatch = (sr, dto, db) => {
  const isLocal = dto.deliveryMethod === DELIVERY_METHODS.LOCAL_HAND;
  const missing = [];
  if (!dto.dispatchedDate) missing.push('Dispatched Date');
  if (!dto.courierId && !dto.courierName) missing.push('Courier / Carrier');
  if (!dto.dispatchMode) missing.push('Dispatch Mode');
  if (!isLocal && !dto.trackingNo) missing.push('Tracking Number');
  if (isLocal && !dto.buyingOffice) missing.push('Buying Office / Location');
  if (isLocal && !dto.handedOverTo) missing.push('Handed Over To');
  if (missing.length) fail('VALIDATION', `Dispatch incomplete — missing: ${missing.join(', ')}`);

  if (isOverseas(sr, db)) {
    const inv = sr.invoiceRef ? db.invoices.find((i) => i.id === sr.invoiceRef.invoiceId) : null;
    const issued = inv && [SAMPLE_INVOICE_STATUS.ISSUED, SAMPLE_INVOICE_STATUS.DISPATCHED].includes(inv.status);
    if (!issued) {
      fail('INVOICE_REQUIRED',
        `Overseas consignee (${sr.buyerCountry}) — a commercial invoice must be issued and linked before Mark as Dispatched`);
    }
  }
};

/** "Save without dispatching" — persists fields, status unchanged, stays editable. */
export const saveDispatchDraft = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  if (sr.status !== SR_STATUS.IN_PRODUCTION) {
    fail('CONFLICT', 'Dispatch details can only be recorded while the SR is In Production');
  }
  sr.dispatch = { ...clone(dto), dispatchedBy: currentUserName() };
  pushActivity(sr, 'Dispatch details saved (not yet dispatched)');
  saveDb(db);
  return decorate(sr);
};

/** Mark as Dispatched — irreversible; locks all dispatch fields (PRD §8.4). */
export const recordDispatch = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  if (sr.status !== SR_STATUS.IN_PRODUCTION) {
    fail('CONFLICT', 'Only an In Production SR can be marked as Dispatched');
  }
  validateDispatch(sr, dto, db);
  sr.dispatch = { ...clone(dto), dispatchedBy: currentUserName() };
  applyStatus(sr, SR_STATUS.DISPATCHED);
  pushActivity(sr, 'Marked as Dispatched — dispatch fields locked for audit integrity');

  // Invoice flips Issued → Dispatched once ALL its linked SRs have shipped.
  if (sr.invoiceRef) {
    const inv = db.invoices.find((i) => i.id === sr.invoiceRef.invoiceId);
    if (inv && inv.status === SAMPLE_INVOICE_STATUS.ISSUED) {
      const allShipped = inv.srIds.every((sid) => {
        const linked = db.requests.find((r) => r.id === sid);
        return linked && (sid === sr.id || linked.status === SR_STATUS.DISPATCHED
          || ['FEEDBACK_RECEIVED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'].includes(linked.status));
      });
      if (allShipped) {
        inv.status = SAMPLE_INVOICE_STATUS.DISPATCHED;
        inv.activity = inv.activity || [];
        inv.activity.unshift({
          id: (inv.activity[0]?.id || 0) + 1,
          timestamp: `${todayStr()} 00:00`,
          user: currentUserName(),
          action: 'All linked SRs dispatched — invoice marked Dispatched',
        });
      }
    }
  }

  saveDb(db);
  return decorate(sr);
};

/** "Save as Draft" on Buyer Comments — persists the record, status unchanged. */
export const saveFeedbackDraft = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  if (![SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status)) {
    fail('CONFLICT', 'Buyer comments can only be logged for a Dispatched SR');
  }
  sr.feedback = clone(dto);
  pushActivity(sr, 'Buyer comments saved as draft (status unchanged)');
  saveDb(db);
  return decorate(sr);
};

/**
 * Buyer comments (PRD §8.5). Sets FEEDBACK_RECEIVED then routes on decision.
 * REVISION_REQUIRED auto-creates the next round in the same sample-type chain:
 * copied header + materials + substitution override, deadlines nulled,
 * prior round's comments carried as read-only reference.
 */
export const recordFeedback = async (id, dto) => {
  await delay();
  const db = loadDb();
  const sr = findSr(db, id);
  // PRD §14: Dispatched → Feedback Received, and Feedback Received → outcome
  // are separate transitions — an SR CAN rest at Feedback Received while the
  // buyer's decision is still pending, then be routed from there.
  if (![SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED].includes(sr.status)) {
    fail('CONFLICT', 'Buyer comments can only be logged for a Dispatched SR');
  }
  const missing = [];
  if (!dto.date) missing.push('Feedback Received Date');
  if (!dto.from) missing.push('Feedback From');
  if (!dto.decision) missing.push('Overall Decision');
  if (missing.length) fail('VALIDATION', `Buyer comments incomplete — missing: ${missing.join(', ')}`);

  sr.feedback = clone(dto);
  if (sr.status === SR_STATUS.DISPATCHED) applyStatus(sr, SR_STATUS.FEEDBACK_RECEIVED);
  if (dto.importSource) {
    pushActivity(sr, `Buyer comments recorded — set by import from ${dto.importSource}`);
  } else {
    pushActivity(sr, 'Buyer comments recorded');
  }
  // Unmapped extracted values are never silently dropped (PRD §8.5)
  (dto.unmappedValues || []).forEach((u) => {
    pushActivity(sr, `Unmapped value retained from ${dto.importSource || 'import'}`, {
      details: `${u.label}: ${u.value} (${u.sourceRef})`,
    });
  });

  const outcome = DECISION_TO_STATUS[dto.decision];
  applyStatus(sr, outcome);

  let revisionSr = null;
  if (dto.decision === FEEDBACK_DECISIONS.REVISION_REQUIRED) {
    const nextId = Math.max(0, ...db.requests.map((r) => r.id)) + 1;
    revisionSr = {
      ...clone(sr),
      id: nextId,
      srNo: nextSrNo(db),
      round: (sr.round || 1) + 1,
      parentSrId: sr.id,
      childSrId: null,
      status: SR_STATUS.DRAFT,
      inHandDate: null,
      dispatchDeadline: null,
      buyerApprovalDeadline: null,
      dispatch: null,
      feedback: null,
      invoiceRef: null,
      priorFeedbackRef: {
        srNo: sr.srNo,
        round: sr.round || 1,
        decision: dto.decision,
        date: dto.date,
        from: dto.from,
        comments: clone(dto.comments || {}),
      },
      statusHistory: [{ status: SR_STATUS.DRAFT, date: todayStr(), user: currentUserName() }],
      activity: [],
      version: 0,
    };
    revisionSr.materials = (revisionSr.materials || []).map((m) => ({ ...m, poRef: null }));
    pushActivity(revisionSr, `Round ${revisionSr.round} auto-created from ${sr.srNo} (Revision Required)`);
    sr.childSrId = nextId;
    db.requests.push(revisionSr);
  }

  saveDb(db);
  return { sampleRequest: decorate(sr), revisionSr: revisionSr ? decorate(revisionSr) : null };
};
