/**
 * Sewing REST client. One function per backend endpoint, named to match the
 * sewingService surface the screens already call, so moving a feature off the
 * mock is a one-line change in sewingService.js.
 */
import axiosInstance, { upload } from '../core/axiosInstance';

const BASE = '/sewing';

/* ── 5.1 Operators ───────────────────────────────────────────────────────── */

export const getOperators = async () => {
  const { data } = await axiosInstance.get(`${BASE}/operators`);
  return data;
};

export const saveOperator = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/operators/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/operators`, payload);
  return data;
};

/* ── 5.2 SAM library ─────────────────────────────────────────────────────── */

export const getSamValues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/style-sam`);
  return data;
};

/** The SAM sheet for one style — what the plan screen auto-fills from. */
export const getStyleSam = async (styleNo) => {
  const { data } = await axiosInstance.get(`${BASE}/style-sam`, { params: { styleNo } });
  return data[0] ?? null;
};

export const saveStyleSam = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/style-sam/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/style-sam`, payload);
  return data;
};

/* ── Order lookup ────────────────────────────────────────────────────────── */

export const getOrders = async () => {
  const { data } = await axiosInstance.get(`${BASE}/orders`);
  return data;
};

/* ── 4.1 Production plan ─────────────────────────────────────────────────── */

export const listPlans = async () => {
  const { data } = await axiosInstance.get(`${BASE}/plans`);
  return data;
};

export const getPlan = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/plans/${id}`);
  return data;
};

export const savePlan = async (payload) => {
  const { data } = payload.id
    ? await axiosInstance.put(`${BASE}/plans/${payload.id}`, payload)
    : await axiosInstance.post(`${BASE}/plans`, payload);
  return data;
};

const PLAN_COMMAND = { APPROVED: 'approve', ON_HOLD: 'hold', COMPLETED: 'complete', CANCELLED: 'cancel' };

/**
 * Moves a plan by its own command, sent the version the screen last read. IN_PROGRESS is the
 * start of an approved plan, or the resume of one on hold: `from` is the status it has now.
 */
export const setPlanStatus = async (id, status, version, from) => {
  const command = status === 'IN_PROGRESS' ? (from === 'ON_HOLD' ? 'resume' : 'start') : PLAN_COMMAND[status];
  if (!command) throw new Error(`A production plan is not moved to ${status}`);
  const { data } = await axiosInstance.post(`${BASE}/plans/${id}/${command}`, { version });
  return data;
};

/** The style's SAM sheet as plan operations, so a studied style is not re-timed. */
export const getSuggestedOperations = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/plans/suggested-operations`, { params: { orderId } });
  return data;
};

/* ── 4.2 Cut parts receipt ───────────────────────────────────────────────── */

export const listCutReceipts = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-receipts`);
  return data;
};

/** Cutting bundle issues sewing has not received yet, with their bundles. */
export const listPendingBundleIssues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/cut-receipts/pending-issues`);
  return data;
};

export const saveCutReceipt = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/cut-receipts`, payload);
  return data;
};

/* ── 4.3 Hourly production ───────────────────────────────────────────────── */

export const listHourly = async () => {
  const { data } = await axiosInstance.get(`${BASE}/hourly`);
  return data;
};

/**
 * The sheet for a plan on a day and shift. When none is saved yet the server
 * returns a blank one carrying the previous day's operators forward, so the
 * response has no id until it is saved.
 */
export const getHourlySheet = async ({ planId, date, shiftId }) => {
  const { data } = await axiosInstance.get(`${BASE}/hourly/sheet`, { params: { planId, date, shiftId } });
  return data;
};

export const saveHourlySheet = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/hourly`, payload);
  return data;
};

/** Tailors already counted for the same hour elsewhere, without saving. */
export const findHourConflicts = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/hourly/conflicts`, payload);
  return data;
};

const HOURLY_COMMAND = { SUBMITTED: 'submit', IN_PROGRESS: 'reopen' };

/** Closes the day's sheet (SUBMITTED) or opens it again (IN_PROGRESS), sent its current version. */
export const setHourlyStatus = async (id, status, version) => {
  const command = HOURLY_COMMAND[status];
  if (!command) throw new Error(`An hourly sheet is not moved to ${status}`);
  const { data } = await axiosInstance.post(`${BASE}/hourly/${id}/${command}`, { version });
  return data;
};

/* ── 4.5 Trim verification ───────────────────────────────────────────────── */

export const listTrimCards = async () => {
  const { data } = await axiosInstance.get(`${BASE}/trim-cards`);
  return data;
};

/** The order's BOM, which is what a new verification card starts from. */
export const getBomItems = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/trim-cards/bom-items`, { params: { orderId } });
  return data;
};

/** Only the labels on that BOM - what pre-final checking has to verify. */
export const getBomLabelItems = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/trim-cards/bom-labels`, { params: { orderId } });
  return data;
};

export const saveTrimCard = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/trim-cards`, payload);
  return data;
};

/* ── 4.6 Measurement reports ─────────────────────────────────────────────── */

export const listMeasurements = async () => {
  const { data } = await axiosInstance.get(`${BASE}/measurements`);
  return data;
};

export const getMeasurement = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/measurements/${id}`);
  return data;
};

/** The style's chart for a size, actuals blank — what a new report starts from. */
export const getMeasurementOpeningPoints = async (orderId, size) => {
  const { data } = await axiosInstance.get(`${BASE}/measurements/opening-points`, { params: { orderId, size } });
  return data;
};

export const saveMeasurement = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/measurements`, payload);
  return data;
};

/* ── 4.7 End-line check (TOPSE) ──────────────────────────────────────────── */

export const listTopse = async () => {
  const { data } = await axiosInstance.get(`${BASE}/topse`);
  return data;
};

export const getTopse = async (id) => {
  const { data } = await axiosInstance.get(`${BASE}/topse/${id}`);
  return data;
};

export const saveTopse = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/topse`, payload);
  return data;
};

/* ── 4.8 Parts replacement ───────────────────────────────────────────────── */

export const listReplacements = async () => {
  const { data } = await axiosInstance.get(`${BASE}/replacements`);
  return data;
};

export const saveReplacement = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/replacements`, payload);
  return data;
};

const PART_COMMAND = { CUT: 'mark-cut', DELIVERED: 'mark-delivered' };

/**
 * Cutting marking one rejected part cut, or delivered back to the line, by its own command. A part
 * has no version of its own: `version` is its request's, and every part moved moves it on.
 */
export const setReplacementPartStatus = async (id, partId, status, version) => {
  const command = PART_COMMAND[status];
  if (!command) throw new Error(`A replacement part is marked cut or delivered, not ${status}`);
  const { data } = await axiosInstance.post(`${BASE}/replacements/${id}/parts/${partId}/${command}`, { version });
  return data;
};

/* ── 5.3 Incentives · 6.1 Floor dashboard ────────────────────────────────── */

/** Read-only: computed from the hourly sheets every call, never posted anywhere. */
export const getIncentives = async (date) => {
  const { data } = await axiosInstance.get(`${BASE}/incentives`, { params: { date } });
  return data;
};

export const getFloorDashboard = async (date) => {
  const { data } = await axiosInstance.get(`${BASE}/dashboard`, { params: { date } });
  return data;
};

/* ── Measurement chart master ────────────────────────────────────────────── */

const SPECS = '/measurement-specs';

export const getMeasurementChart = async (styleNo) => {
  const { data } = await axiosInstance.get(SPECS, { params: { styleNo } });
  return data;
};

/**
 * Reads an uploaded chart and returns what it says, writing nothing. Posted
 * through the shared upload helper so the multipart boundary is set rather than
 * the instance's JSON content type.
 */
export const parseMeasurementChart = async (file, styleNo) => {
  const form = new FormData();
  form.append('file', file);
  return upload(`${SPECS}/parse?styleNo=${encodeURIComponent(styleNo)}`, form);
};

/** Commits a parsed chart, replacing the style's existing one. */
export const saveMeasurementChart = async (payload) => {
  const { data } = await axiosInstance.post(SPECS, payload);
  return data;
};

/* ── 4.4 Garment issue to finishing ──────────────────────────────────────── */

export const listGarmentIssues = async () => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues`);
  return data;
};

export const issuedBySize = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues/issued-by-size`, { params: { orderId } });
  return data;
};

/** The size-wise sheet a new note starts from, with balances carried forward. */
export const getIssueOpeningLines = async (orderId) => {
  const { data } = await axiosInstance.get(`${BASE}/garment-issues/opening-lines`, { params: { orderId } });
  return data;
};

/** Finishing recording what it took in against a garment issue. */
export const recordGarmentIssueReceipt = async (id, lines) => {
  const { data } = await axiosInstance.put(`${BASE}/garment-issues/${id}/receipt`, { lines });
  return data;
};

export const saveGarmentIssue = async (payload) => {
  const { data } = await axiosInstance.post(`${BASE}/garment-issues`, payload);
  return data;
};
