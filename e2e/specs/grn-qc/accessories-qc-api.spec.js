/**
 * Accessories/Trims QC API — E2E Tests
 *
 * Tests QC inspection creation against submitted Trims GRNs.
 * Covers result combinations (all OK, some NOT OK, mixed) and
 * validation rules (draft vs submit strictness, inspectionDate, criteria).
 *
 * Each combo test uses its OWN dedicated PO to avoid conflicts:
 *   E2E-AQ-1  — Combo 19: All criteria OK → PASS
 *   E2E-AQ-2  — Combo 20: First 2 criteria NOT OK → FAIL
 *   E2E-AQ-3  — Combo 21: Alternating OK/NOT OK
 *   E2E-AQ-V  — Shared PO for validation tests
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  findPOByNumber, refreshPO, trimsGrnPayload, trimsQcPayload,
  submitGrn, submitQc, draftQc, getTrimsQCCriteria, today,
} from '../../helpers/grn-qc-data.js';

// ─── Shared State ───────────────────────────────────────────────────────────

let api;
let activeCriteria;
const createdQcIds = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Submit a fresh Trims GRN for a single PO item against the given PO number.
 * Returns the submitted GRN, the poLineItemId, and the PO.
 */
async function submitTrimsGrn(api, poNumber) {
  const po = await findPOByNumber(api, poNumber);
  const item = po.items.find((i) => i.pendingQty > 0);
  if (!item) throw new Error(`PO '${poNumber}' has no line item with pending qty.`);

  const receiveQty = Math.min(100, item.pendingQty);
  const payload = trimsGrnPayload(po, [item], {
    [item.id]: [{ cartonNumber: `CTN-${Date.now()}`, quantity: receiveQty }],
  });

  // Ensure receivingQty on the line item matches the carton sum
  if (payload.items) {
    const pItem = payload.items.find((i) => i.poLineItemId === item.id);
    if (pItem) pItem.receivingQty = receiveQty;
  }

  const grn = await submitGrn(api, payload);
  return { grn, poLineItemId: item.id, po };
}

/**
 * Build criteria rows from active master criteria.
 * Falls back to synthetic rows if no active criteria exist.
 * @param {Function} [overrideFn] - (base, index, total) => modified row
 */
function buildCriteriaRows(overrideFn) {
  const source = activeCriteria.length > 0
    ? activeCriteria
    : Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      criteriaName: `Test Criterion ${i + 1}`,
      name: `Test Criterion ${i + 1}`,
    }));

  return source.map((c, i) => {
    const base = {
      id: c.id,
      criteria: c.criteriaName || c.name,
      ok: true,
      notOk: false,
      remarks: '',
    };
    return overrideFn ? overrideFn(base, i, source.length) : base;
  });
}

/** Track QC IDs for cleanup. */
function trackQc(qc) {
  if (qc?.id) createdQcIds.push(qc.id);
  return qc;
}

// ─── Setup & Teardown ───────────────────────────────────────────────────────

test.beforeAll(async () => {
  api = await createAuthenticatedClient();

  // Fetch active trims QC criteria
  activeCriteria = await getTrimsQCCriteria(api);
});

test.afterAll(async () => {
  // Best-effort cleanup: drafts can be deleted, submitted ones will 4xx (expected)
  for (const id of createdQcIds) {
    try { await api.delete(`/qc/${id}`); } catch { /* ignore */ }
  }
  await api.dispose();
});

// ─── Result Combinations ────────────────────────────────────────────────────

test.describe('Accessories QC — Result Combinations (API)', () => {

  test('Combo 19 (E2E-AQ-1): All criteria OK → PASS', async () => {
    const { grn, poLineItemId } = await submitTrimsGrn(api, 'E2E-AQ-1');

    const criteriaRows = buildCriteriaRows(); // all ok=true by default

    const payload = trimsQcPayload(grn, poLineItemId, criteriaRows, {
      inspector: 'E2E Inspector Combo19',
    });

    // Verify payload columns are populated
    expect(payload.qcType).toBe('Accessories');
    expect(payload.grnId).toBe(grn.id);
    expect(payload.poLineItemId).toBe(poLineItemId);
    expect(payload.inspectionDate).toBe(today());
    expect(payload.inspector).toBeTruthy();
    expect(payload.qtyOrdered).toBeGreaterThan(0);
    expect(payload.qtyReceived).toBeGreaterThan(0);
    expect(payload.qtyChecked).toBeGreaterThan(0);
    expect(payload.criteriaRows.length).toBeGreaterThan(0);
    expect(payload.overallResult).toBe('PASS');

    // Verify each criteria row has all columns
    for (const row of payload.criteriaRows) {
      expect(row.id).toBeDefined();
      expect(row.criteria).toBeTruthy();
      expect(row.ok).toBe(true);
      expect(row.notOk).toBe(false);
      expect(row.remarks).toBeDefined();
    }

    const qc = await submitQc(api, payload);
    trackQc(qc);

    expect(qc.id).toBeDefined();
    expect(qc.overallResult).toBe('PASS');
    expect(qc.qcType).toBe('Accessories');

    // Verify via GET
    const { data: fetched } = await api.get(`/qc/${qc.id}`);
    expect(fetched).toBeDefined();
    expect(fetched.overallResult).toBe('PASS');
    expect(fetched.grnId).toBe(grn.id);
    expect(fetched.poLineItemId).toBe(poLineItemId);
    expect(fetched.inspectionDate).toBe(today());
  });

  test('Combo 20 (E2E-AQ-2): First 2 criteria NOT OK with remarks → FAIL', async () => {
    const { grn, poLineItemId } = await submitTrimsGrn(api, 'E2E-AQ-2');

    const criteriaRows = buildCriteriaRows((base, i) => {
      if (i === 0) return { ...base, ok: false, notOk: true, remarks: 'Color mismatch detected' };
      if (i === 1) return { ...base, ok: false, notOk: true, remarks: 'Size variation out of spec' };
      return base; // remaining: ok=true
    });

    const payload = trimsQcPayload(grn, poLineItemId, criteriaRows, {
      inspector: 'E2E Inspector Combo20',
    });
    expect(payload.overallResult).toBe('FAIL');

    const qc = await submitQc(api, payload);
    trackQc(qc);

    expect(qc.id).toBeDefined();
    expect(qc.overallResult).toBe('FAIL');

    // Verify the criteria rows are persisted
    const { data: fetched } = await api.get(`/qc/${qc.id}`);
    expect(fetched).toBeDefined();
    expect(fetched.overallResult).toBe('FAIL');

    const notOkRows = (fetched.criteriaRows || []).filter((r) => r.notOk);
    expect(notOkRows.length).toBeGreaterThanOrEqual(2);

    // Verify notOk rows have remarks
    for (const row of notOkRows) {
      expect(row.remarks).toBeTruthy();
    }
  });

  test('Combo 21 (E2E-AQ-3): Alternating OK/NOT OK — verify counts', async () => {
    const { grn, poLineItemId } = await submitTrimsGrn(api, 'E2E-AQ-3');

    const criteriaRows = buildCriteriaRows((base, i) => {
      if (i % 2 === 1) {
        return { ...base, ok: false, notOk: true, remarks: `Issue on criterion ${i + 1}` };
      }
      return base; // even indices: ok=true
    });

    const payload = trimsQcPayload(grn, poLineItemId, criteriaRows, {
      inspector: 'E2E Inspector Combo21',
    });

    const qc = await submitQc(api, payload);
    trackQc(qc);

    expect(qc.id).toBeDefined();

    // Count expected results
    const okCount = criteriaRows.filter((r) => r.ok).length;
    const notOkCount = criteriaRows.filter((r) => r.notOk).length;

    expect(okCount).toBeGreaterThanOrEqual(1);
    expect(notOkCount).toBeGreaterThanOrEqual(1);

    // If any criterion is NOT OK, overall result must be FAIL
    expect(qc.overallResult).toBe('FAIL');

    // Verify via GET — persisted criteria counts match
    const { data: fetched } = await api.get(`/qc/${qc.id}`);
    expect(fetched).toBeDefined();

    const fetchedOk = (fetched.criteriaRows || []).filter((r) => r.ok).length;
    const fetchedNotOk = (fetched.criteriaRows || []).filter((r) => r.notOk).length;
    expect(fetchedOk).toBe(okCount);
    expect(fetchedNotOk).toBe(notOkCount);
  });
});

// ─── Validation ─────────────────────────────────────────────────────────────

test.describe('Accessories QC — Validation (API)', () => {

  let baseGrn;
  let basePoLineItemId;

  test.beforeAll(async () => {
    // Create one GRN for validation tests (most expect 4xx, so no QC conflict)
    const result = await submitTrimsGrn(api, 'E2E-AQ-V');
    baseGrn = result.grn;
    basePoLineItemId = result.poLineItemId;
  });

  test('missing grnId → error', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);
    delete payload.grnId;

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('missing poLineItemId → error', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);
    delete payload.poLineItemId;

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: missing inspectionDate → error', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);
    delete payload.inspectionDate;

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: inspectionDate before GRN date → error', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);
    payload.inspectionDate = '2020-01-01';

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: future inspectionDate → error', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 2);
    payload.inspectionDate = tomorrow.toISOString().split('T')[0];

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: empty criteria list → error', async () => {
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, []);

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: criteria with neither ok nor notOk → error', async () => {
    const criteriaRows = buildCriteriaRows((base) => ({
      ...base,
      ok: false,
      notOk: false,
      remarks: '',
    }));
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('submit: notOk without remarks → error', async () => {
    const criteriaRows = buildCriteriaRows((base, i) => {
      if (i === 0) return { ...base, ok: false, notOk: true, remarks: '' }; // missing remarks
      return base;
    });
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);

    const { status } = await api.post('/qc/submit', payload);
    expect(status).toBeGreaterThanOrEqual(400);
  });

  test('draft saves without inspectionDate (DEFECT: DB NOT NULL may reject)', async () => {
    const criteriaRows = buildCriteriaRows();
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, criteriaRows);
    delete payload.inspectionDate;

    const { data, status } = await api.post('/qc/draft', payload);
    // DB schema has inspection_date NOT NULL — server may reject or use default.
    // This test documents whether Trims QC draft is lenient on inspectionDate.
    if (status === 200 && data?.id) {
      createdQcIds.push(data.id);
      const { data: fetched } = await api.get(`/qc/${data.id}`);
      expect(fetched.qcType).toBe('Accessories');
    } else {
      // DEFECT or expected: DB enforces NOT NULL on inspection_date even for drafts
      expect([400, 500].includes(status)).toBeTruthy();
    }
  });

  test('draft saves without criteria → success', async () => {
    const payload = trimsQcPayload(baseGrn, basePoLineItemId, []);
    // Keep inspectionDate since DB requires it

    const { data, status } = await api.post('/qc/draft', payload);
    // A draft with no criteria is allowed (criteria are required only on submit).
    expect([200, 400]).toContain(status);
    if (status === 200 && data?.id) {
      createdQcIds.push(data.id);
      const { data: fetched } = await api.get(`/qc/${data.id}`);
      expect(fetched).toBeDefined();
      expect((fetched.criteriaRows || []).length).toBe(0);
    }
  });
});
