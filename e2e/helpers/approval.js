/**
 * Centralized Approval Engine Helpers for E2E Tests
 *
 * The app routes all approvals through the apv_* engine:
 *   POST /approval-requests/submit                      — submit entity for approval
 *   GET  /approval-requests/entity/{entityType}/{id}    — list requests for an entity
 *   POST /approval-requests/{requestId}/action          — APPROVE | REJECT | REFER_BACK
 *
 * If no approval flow is configured for the entity type, /submit responds with
 * { autoApproved: true } and the entity is approved directly. Tests must handle
 * BOTH paths — which one runs depends on the seeded apv_approval_flows rows.
 *
 * Entity types in use: COST_SHEET, ORDER, BOM, PURCHASE_ORDER (see backend ApprovalEntityType).
 */

/**
 * Find the latest PENDING approval request for an entity.
 * @param {import('./api-client.js').ApiClient} api
 * @param {string} entityType - e.g. 'ORDER', 'COST_SHEET', 'BOM', 'PURCHASE_ORDER'
 * @param {number} entityId
 * @returns {Promise<object|null>} the pending request, or null when none exists
 */
export async function findPendingRequest(api, entityType, entityId) {
  const { data, status } = await api.get(`/approval-requests/entity/${entityType}/${entityId}`);
  if (status !== 200 || !Array.isArray(data)) return null;
  return data.find((r) => r.status === 'PENDING') || null;
}

/**
 * Act on a pending approval request via the engine.
 * @param {import('./api-client.js').ApiClient} api
 * @param {number} requestId
 * @param {'APPROVE'|'REJECT'|'REFER_BACK'} actionType
 * @param {string} [comments]
 * @param {object} [actionData] - module-specific payload (e.g. PO pdfBucketPath)
 */
export async function actOnRequest(api, requestId, actionType, comments, actionData) {
  const { data, status } = await api.post(`/approval-requests/${requestId}/action`, {
    actionType,
    comments,
    actionData,
  });
  if (status < 200 || status >= 300) {
    throw new Error(`Approval action ${actionType} on request ${requestId} failed: ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Approve an entity through whichever path is configured:
 * engine request if one is PENDING, otherwise reports { engine: false } so the
 * caller can use the direct UI buttons / direct endpoint instead.
 *
 * @returns {Promise<{engine: boolean, request?: object, result?: object}>}
 */
export async function approveEntityIfPending(api, entityType, entityId, comments = 'E2E approve') {
  const pending = await findPendingRequest(api, entityType, entityId);
  if (!pending) return { engine: false };
  const result = await actOnRequest(api, pending.id, 'APPROVE', comments);
  return { engine: true, request: pending, result };
}
