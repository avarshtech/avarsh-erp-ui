/**
 * Mock CRUD + list API for Sample Requests. Mirrors the future REST contract:
 * Spring page shape {content, totalElements, totalPages, size, number},
 * camelCase fields, YYYY-MM-DD dates, `version` for optimistic locking.
 */
import { loadDb, saveDb, nextSrNo } from './srMockStore';
import { getStockStatus } from './srMockMasters';
import { daysRemaining, deadlineRag } from '../../utils/deadlineUtils';
import { SR_STATUS, isSrEditable, isSrDeletable } from '../../utils/sampleRequestConstants';
import { getCurrentUser } from '../../utils/permissions';

const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const clone = (v) => JSON.parse(JSON.stringify(v));
export const fail = (code, msg) => { const e = new Error(msg); e.code = code; throw e; };

export const currentUserName = () => {
  const u = getCurrentUser();
  if (!u) return 'User';
  if (typeof u === 'string') return u;
  return u.name || u.fullName || u.username || u.email || 'User';
};

const nowStamp = () => {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

export const pushActivity = (sr, action, extra = {}) => {
  sr.activity = sr.activity || [];
  sr.activity.unshift({
    id: (sr.activity[0]?.id || 0) + 1,
    timestamp: nowStamp(),
    user: currentUserName(),
    action,
    ...extra,
  });
};

export const todayStr = () => {
  const dt = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

// Derived, read-only decoration (never persisted)
export const decorate = (sr, db = null) => {
  const out = clone(sr);
  out.daysToDispatch = daysRemaining(sr.dispatchDeadline);
  out.deadlineRag = deadlineRag(out.daysToDispatch);
  out.daysToApproval = daysRemaining(sr.buyerApprovalDeadline);
  // Dispatch details live on the dispatch entity (R2) — resolve for the view
  const store = db || loadDb();
  const dispatch = (store.dispatches || []).find((d) => (d.srIds || []).includes(sr.id));
  out.dispatchInfo = dispatch ? clone(dispatch) : null;
  out.materials = (out.materials || []).map((line) => {
    const stock = getStockStatus(line, line.sampleQtyRequired || 0);
    return { ...line, stockStatus: stock.status, stockAvailable: stock.available };
  });
  out.totalMaterialLines = out.materials.length;
  out.shortfallCount = out.materials.filter((m) => m.stockStatus !== 'IN_STOCK').length;
  out.availableCount = out.totalMaterialLines - out.shortfallCount;
  out.isOverdue = out.status !== SR_STATUS.DISPATCHED
    && !['APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'FEEDBACK_RECEIVED'].includes(out.status)
    && out.daysToDispatch != null && out.daysToDispatch < 0;
  return out;
};

const matches = (sr, params) => {
  if (params.search) {
    const q = params.search.toLowerCase();
    if (!`${sr.srNo} ${sr.orderNo}`.toLowerCase().includes(q)) return false;
  }
  if (params.status && sr.status !== params.status) return false;
  if (params.sampleTypeId && sr.sampleTypeId !== Number(params.sampleTypeId)) return false;
  if (params.buyer && sr.buyerName !== params.buyer) return false;
  if (params.deadlineFrom && (!sr.dispatchDeadline || sr.dispatchDeadline < params.deadlineFrom)) return false;
  if (params.deadlineTo && (!sr.dispatchDeadline || sr.dispatchDeadline > params.deadlineTo)) return false;
  if (params.overdue) {
    const days = daysRemaining(sr.dispatchDeadline);
    const active = ['DRAFT', 'SUBMITTED', 'IN_PRODUCTION'].includes(sr.status);
    if (!(active && days != null && days < 0)) return false;
  }
  // "Comments logged but action pending" — resting at Feedback Received, or
  // dispatched with a saved comment draft
  if (params.pendingApproval
    && !(sr.status === SR_STATUS.FEEDBACK_RECEIVED || (sr.status === SR_STATUS.DISPATCHED && sr.feedback))) return false;
  return true;
};

export const searchSampleRequests = async (params = {}) => {
  await delay();
  const db = loadDb();
  const filtered = db.requests.filter((sr) => matches(sr, params)).map((sr) => decorate(sr, db));
  filtered.sort((a, b) => (b.id - a.id));
  const size = Number(params.size ?? 10);
  const page = Number(params.page ?? 0);
  const start = page * size;
  return {
    content: filtered.slice(start, start + size),
    totalElements: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / size)),
    size,
    number: page,
  };
};

export const getSampleRequest = async (id) => {
  await delay();
  const sr = loadDb().requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  return decorate(sr);
};

export const createSampleRequest = async (payload) => {
  await delay();
  const db = loadDb();
  const id = Math.max(0, ...db.requests.map((r) => r.id)) + 1;
  const sr = {
    parentSrId: null,
    childSrId: null,
    priorFeedbackRef: null,
    dispatch: null,
    feedback: null,
    invoiceRef: null,
    remarks: '',
    ...clone(payload),
    id,
    srNo: nextSrNo(db),
    status: SR_STATUS.DRAFT,
    statusHistory: [{ status: SR_STATUS.DRAFT, date: todayStr(), user: currentUserName() }],
    activity: [],
    version: 0,
  };
  pushActivity(sr, 'Sample Request created', {
    details: `${(sr.materials || []).length} material lines auto-populated`,
  });
  db.requests.push(sr);
  saveDb(db);
  return decorate(sr);
};

const HEADER_DIFF_FIELDS = [
  ['sampleTypeName', 'Sample Type'], ['colourSubstitutionAllowed', 'Colour/Design Substitution'],
  ['sampleQty', 'Sample Quantity'], ['colourReference', 'Colour/Print Reference'],
  ['priority', 'Priority'], ['specialInstructions', 'Special Instructions'],
  ['inHandDate', 'Sample In-Hand Date'], ['dispatchDeadline', 'Dispatch Deadline'],
  ['buyerApprovalDeadline', 'Buyer Approval Deadline'], ['remarks', 'Remarks'],
];

export const updateSampleRequest = async (id, payload) => {
  await delay();
  const db = loadDb();
  const sr = db.requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  if (!isSrEditable(sr.status)) fail('CONFLICT', `SR in status ${sr.status} cannot be edited`);

  HEADER_DIFF_FIELDS.forEach(([field, label]) => {
    if (payload[field] !== undefined && JSON.stringify(payload[field]) !== JSON.stringify(sr[field])) {
      pushActivity(sr, `Field ${label} changed`, {
        field: label,
        oldValue: sr[field] ?? '—',
        newValue: payload[field] ?? '—',
        importSourced: payload.__importSource ? payload.__importSource : undefined,
      });
    }
  });

  const { __importSource, ...rest } = payload;
  Object.assign(sr, clone(rest), { version: (sr.version || 0) + 1 });
  saveDb(db);
  return decorate(sr);
};

/**
 * PRD §8.3: at In Production the Merchandiser may still edit Special
 * Instructions and Remarks — header, materials and deadlines stay frozen.
 */
export const updateInstructions = async (id, { specialInstructions, remarks }) => {
  await delay();
  const db = loadDb();
  const sr = db.requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  if (sr.status !== SR_STATUS.IN_PRODUCTION) {
    fail('CONFLICT', 'Instructions can only be edited while the SR is In Production');
  }
  [['specialInstructions', 'Special Instructions', specialInstructions],
    ['remarks', 'Remarks', remarks]].forEach(([field, label, value]) => {
    if (value !== undefined && value !== sr[field]) {
      pushActivity(sr, `Field ${label} changed`, { field: label, oldValue: sr[field] || '—', newValue: value || '—' });
      sr[field] = value;
    }
  });
  sr.version = (sr.version || 0) + 1;
  saveDb(db);
  return decorate(sr);
};

export const deleteSampleRequest = async (id) => {
  await delay();
  const db = loadDb();
  const sr = db.requests.find((r) => r.id === Number(id));
  if (!sr) fail('NOT_FOUND', `Sample request ${id} not found`);
  if (!isSrDeletable(sr.status)) {
    fail('CONFLICT', 'SR records are not deletable once status moves beyond Draft');
  }
  db.requests = db.requests.filter((r) => r.id !== Number(id));
  saveDb(db);
};

export const listByOrderNo = async (orderNo) => {
  await delay();
  const db = loadDb();
  const rows = db.requests.filter((r) => r.orderNo === orderNo).map((sr) => decorate(sr, db));
  rows.sort((a, b) => a.id - b.id);
  // Courier cost lives on the dispatch entity — count each dispatch ONCE
  const seen = new Set();
  let totalCourierCost = 0;
  rows.forEach((r) => {
    const d = r.dispatchInfo;
    if (d && d.status === 'DISPATCHED' && !seen.has(d.id)) {
      seen.add(d.id);
      totalCourierCost += d.courierCost || 0;
    }
  });
  return { content: rows, totalCourierCost };
};

export const getActivity = async (id) => {
  const sr = await getSampleRequest(id);
  return sr.activity || [];
};

/** Distinct buyer names across SRs — facet source for the list filter. */
export const listSrBuyers = async () => {
  await delay(60);
  return [...new Set(loadDb().requests.map((r) => r.buyerName).filter(Boolean))].sort();
};
