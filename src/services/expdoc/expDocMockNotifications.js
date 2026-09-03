/**
 * Export Documentation — notification events (PRD §23).
 *
 * The ERP has a real notification service (`services/core/notificationService.js`)
 * backed by `sys_notifications` and a `NotificationPermissionMapping` on the server.
 * This module has no server, so its events live in the mock store and the
 * NotificationCenter merges them with whatever the API returns. The SHAPE is the
 * API's shape — `{id, type, title, body, actionUrl, isRead, createdAt}` — so the
 * cutover is deleting this file and registering the topics on the backend.
 *
 * Audience is RECORDED, not enforced. §23 addresses each event to a role, and the
 * server filters by permission; a single-user demo has nobody to filter to, and
 * quietly hiding events would make the feature look broken rather than unimplemented.
 */
import { loadDb, saveDb } from './expDocMockStore';
import { delay, clone, nowStamp, currentUserName, pageOf } from './expDocMockCommon';
import { EXPDOC_PREFIX, SERIES_WARN_AT, seriesHeadroom, LAST_DOC_NUMBER } from './expDocDocNumbers';

/** The §23 event catalogue. Types are namespaced so they cannot collide with the API's. */
export const EXPDOC_NOTIFICATION = {
  PL_SUBMITTED: 'EXPDOC_PL_SUBMITTED',
  PL_APPROVED: 'EXPDOC_PL_APPROVED',
  PL_SENT_BACK: 'EXPDOC_PL_SENT_BACK',
  PL_CANCELLED: 'EXPDOC_PL_CANCELLED',
  PL_REVISED: 'EXPDOC_PL_REVISED',
  DOC_RELEASED: 'EXPDOC_DOC_RELEASED',
  INVOICE_SUBMITTED: 'EXPDOC_INVOICE_SUBMITTED',
  INVOICE_APPROVED: 'EXPDOC_INVOICE_APPROVED',
  INVOICE_SENT_BACK: 'EXPDOC_INVOICE_SENT_BACK',
  SOURCE_STALE: 'EXPDOC_SOURCE_STALE',
  SERIES_EXHAUSTED: 'EXPDOC_SERIES_EXHAUSTED',
  ETD_APPROACHING: 'EXPDOC_ETD_APPROACHING',
};

/** Who each event is addressed to (§23), recorded on the row for the API phase. */
const AUDIENCE = {
  [EXPDOC_NOTIFICATION.PL_SUBMITTED]: 'Documentation Manager',
  [EXPDOC_NOTIFICATION.PL_APPROVED]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.PL_SENT_BACK]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.PL_CANCELLED]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.PL_REVISED]: 'Documentation Manager',
  [EXPDOC_NOTIFICATION.DOC_RELEASED]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.INVOICE_SUBMITTED]: 'Finance',
  [EXPDOC_NOTIFICATION.INVOICE_APPROVED]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.INVOICE_SENT_BACK]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.SOURCE_STALE]: 'Documentation Executive',
  [EXPDOC_NOTIFICATION.SERIES_EXHAUSTED]: 'Template Admin',
  [EXPDOC_NOTIFICATION.ETD_APPROACHING]: 'Documentation Manager',
};

/**
 * Raise one event.
 *
 * Synchronous and db-scoped: every caller is already inside a mutation that will
 * `saveDb`, and raising a notification must never be a second write that can land
 * without the change it describes.
 */
export const raise = (db, { type, title, body, actionUrl, entityType, entityId, entityNo, dedupeKey }) => {
  db.notifications = db.notifications || [];
  /*
   * A repeatable condition — a stale source, an approaching ETD — must not stack up
   * one row per read, and must not come BACK the moment it is read.
   *
   * So an existing row with the same key wins outright while it still says the same
   * thing, read or unread. Only a changed message replaces it, because that is a
   * genuinely different state of the world and the reader has not seen it yet.
   */
  if (dedupeKey) {
    // Deleting a condition row is a dismissal, not a fix. It stays dismissed while
    // the condition says the same thing, and returns when it says something new.
    const dismissed = (db.dismissedNotifications || {})[dedupeKey];
    if (dismissed && dismissed.title === title && dismissed.body === body) return null;
    const idx = db.notifications.findIndex((n) => n.dedupeKey === dedupeKey);
    if (idx >= 0) {
      const existing = db.notifications[idx];
      if (existing.title === title && existing.body === body) return null;
      db.notifications.splice(idx, 1);
    }
  }
  const row = {
    id: `expdoc-${Math.max(0, ...db.notifications.map((n) => Number(String(n.id).replace('expdoc-', '')) || 0)) + 1}`,
    type,
    title,
    body,
    actionUrl: actionUrl || null,
    entityType: entityType || null,
    entityId: entityId ?? null,
    entityNo: entityNo || null,
    audience: AUDIENCE[type] || null,
    raisedBy: currentUserName(),
    dedupeKey: dedupeKey || null,
    isRead: false,
    createdAt: nowStamp(),
    source: 'EXPDOC_MOCK',
  };
  db.notifications.unshift(row);
  // A demo browser should not accumulate forever; the API pages, this trims.
  if (db.notifications.length > 200) db.notifications.length = 200;
  return row;
};

/**
 * Conditions rather than events: nothing "happens" when an ETD comes closer or a
 * source drifts, so they are evaluated when the list is read and deduped by key.
 * A real backend would run these on a schedule.
 */
const evaluateConditions = (db) => {
  let raised = 0;
  const note = (args) => { if (raise(db, args)) raised += 1; };
  const today = new Date();
  const daysTo = (d) => Math.round((new Date(`${d}T00:00:00`) - today) / 86400000);

  (db.shipments || [])
    .filter((s) => s.status !== 'CLOSED' && s.etd)
    .forEach((s) => {
      const days = daysTo(s.etd);
      if (days < 0 || days > 7) return;
      const docs = (db.packingLists || []).filter((p) => p.shipmentId === s.id);
      const unapproved = docs.filter((p) => ['DRAFT', 'SUBMITTED'].includes(p.status));
      if (!docs.length && days > 3) return;
      note({
        type: EXPDOC_NOTIFICATION.ETD_APPROACHING,
        title: `${s.shipmentNo} sails in ${days} day${days === 1 ? '' : 's'}`,
        body: docs.length
          ? `${unapproved.length} of ${docs.length} document(s) are still unapproved.`
          : 'No packing list has been raised for this shipment yet.',
        actionUrl: `/export-docs/shipments/edit/${s.id}`,
        entityType: 'SHIPMENT', entityId: s.id, entityNo: s.shipmentNo,
        dedupeKey: `etd:${s.id}`,
      });
    });

  // §15: a series that is about to run out is an administrator's problem, and they
  // need to hear about it before the approval that would hit the wall.
  Object.values(EXPDOC_PREFIX).forEach((prefix) => {
    const h = seriesHeadroom(db, prefix);
    if (h.next <= SERIES_WARN_AT) return;
    note({
      type: EXPDOC_NOTIFICATION.SERIES_EXHAUSTED,
      title: h.exhausted
        ? `Series ${prefix}/${h.fy} is exhausted`
        : `Series ${prefix}/${h.fy} is nearly exhausted`,
      body: h.exhausted
        ? `No more numbers can be issued. Configure a wider series or a new prefix.`
        : `${h.remaining} number(s) left before ${prefix}/${h.fy}/${LAST_DOC_NUMBER}.`,
      actionUrl: '/export-docs/reports',
      dedupeKey: `series:${prefix}:${h.fy}`,
    });
  });

  (db.packingLists || [])
    .filter((p) => p.status === 'DRAFT')
    .forEach((p) => {
      const drifted = (p.sourceRefs || []).filter((ref) => {
        const live = (db.packingEntries || []).find((e) => e.id === ref.packingEntryId);
        return live && live.version !== ref.packingEntryVersion;
      });
      if (!drifted.length) return;
      note({
        type: EXPDOC_NOTIFICATION.SOURCE_STALE,
        title: `${p.plNo} is behind its carton data`,
        body: `${drifted.map((d) => d.packingNo).join(', ')} changed after this document was built. Refresh before submitting.`,
        actionUrl: `/export-docs/packing-lists/edit/${p.id}`,
        entityType: 'PACKING_LIST', entityId: p.id, entityNo: p.plNo,
        dedupeKey: `stale:${p.id}`,
      });
    });
  return raised > 0;
};

export const listNotifications = async (params = {}) => {
  await delay(60);
  const db = loadDb();
  if (evaluateConditions(db)) saveDb(db);
  const rows = (db.notifications || [])
    .filter((n) => (params.unreadOnly ? !n.isRead : true));
  return pageOf(clone(rows), { page: params.page ?? 0, size: params.size ?? 50 });
};

export const unreadCount = async () => {
  const res = await listNotifications({ size: 500 });
  return res.content.filter((n) => !n.isRead).length;
};

const mutate = (id, fn) => {
  const db = loadDb();
  const row = (db.notifications || []).find((n) => n.id === id);
  if (!row) return null;
  fn(db, row);
  saveDb(db);
  return clone(row);
};

export const markRead = async (id) => { await delay(40); return mutate(id, (db, r) => { r.isRead = true; }); };
export const markUnread = async (id) => { await delay(40); return mutate(id, (db, r) => { r.isRead = false; }); };

export const markAllRead = async () => {
  await delay(40);
  const db = loadDb();
  (db.notifications || []).forEach((n) => { n.isRead = true; });
  saveDb(db);
};

/** Remember that a condition row was dismissed, so it does not return on the next read. */
const dismiss = (db, row) => {
  if (!row?.dedupeKey) return;
  db.dismissedNotifications = db.dismissedNotifications || {};
  db.dismissedNotifications[row.dedupeKey] = { title: row.title, body: row.body };
};

export const removeNotification = async (id) => {
  await delay(40);
  const db = loadDb();
  const row = (db.notifications || []).find((n) => n.id === id);
  if (row) dismiss(db, row);
  db.notifications = (db.notifications || []).filter((n) => n.id !== id);
  saveDb(db);
};

export const removeReadNotifications = async () => {
  await delay(40);
  const db = loadDb();
  (db.notifications || []).filter((n) => n.isRead).forEach((n) => dismiss(db, n));
  db.notifications = (db.notifications || []).filter((n) => !n.isRead);
  saveDb(db);
};
