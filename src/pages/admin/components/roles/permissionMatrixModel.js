/**
 * Pure logic behind the permission matrix. No React, no Ant Design — so the
 * toggle rules can be reasoned about (and fixed) without touching the UI.
 *
 * Everything here takes a permissions object and returns a NEW one; nothing
 * mutates its input.
 */
import { applyDependencies, getBlockedReason } from '../../../../utils/permissions';

/** The four operations that get their own aligned column. */
export const CRUD_OPS = ['view', 'add', 'update', 'delete'];

/**
 * Every operation any screen can declare must appear in BOTH maps. A missing
 * OP_COLORS entry used to produce "undefined40" — invalid CSS the browser drops,
 * leaving the chip unstyled with no error anywhere.
 */
export const OP_LABELS = {
  view: 'View',
  add: 'Add',
  update: 'Update',
  delete: 'Delete',
  approve: 'Approve',
  reject: 'Reject',
  cancel: 'Cancel',
  refer_back: 'Refer Back',
  verify: 'Verify',
  post: 'Post',
  finalize: 'Finalize',
  revise: 'Revise',
  override: 'Override',
  print: 'Print',
  reprint: 'Reprint',
  publish: 'Publish',
  lock: 'Lock',
};

export const OP_COLORS = {
  view: '#6366f1',
  add: '#22c55e',
  update: '#f59e0b',
  delete: '#ef4444',
  approve: '#10b981',
  reject: '#f43f5e',
  cancel: '#64748b',
  refer_back: '#8b5cf6',
  verify: '#14b8a6',
  post: '#eab308',
  finalize: '#16a34a',
  revise: '#0ea5e9',
  override: '#a855f7',
  print: '#0891b2',
  reprint: '#7c3aed',
  publish: '#059669',
  lock: '#475569',
};

/** A screen may rename an operation for itself, e.g. delete → "Cancel GRN". */
export const opLabel = (screen, op) => screen?.opLabels?.[op] ?? OP_LABELS[op] ?? op;

/** Operations that are not one of the four aligned CRUD columns. */
export const specialOps = (screen) => screen.ops.filter((op) => !CRUD_OPS.includes(op));

const blankOps = (screen, value) =>
  screen.ops.reduce((acc, op) => { acc[op] = value; return acc; }, {});

const entryFor = (permissions, screen) =>
  permissions[screen.id] ?? { access: false, operations: blankOps(screen, false) };

/** access is always derived — never stored independently. */
const withAccess = (operations) => ({
  access: Object.values(operations).some(Boolean),
  operations,
});

export const isGranted = (permissions, screenId, op) =>
  permissions?.[screenId]?.operations?.[op] === true;

/**
 * Toggle one operation.
 *
 * `view` is the right to open the screen, so it cascades: turning it off clears
 * the screen, and turning anything else on turns it on. Screens with no view
 * operation — the approval bundles — opt out. That used to be a hardcoded list
 * of three ids, which silently mishandled the four other view-less screens.
 */
export const toggleOp = (permissions, screen, op, checked) => {
  const current = entryFor(permissions, screen);
  const operations = { ...current.operations };
  const cascades = screen.ops.includes('view');

  if (op === 'view' && !checked && cascades) {
    screen.ops.forEach((o) => { operations[o] = false; });
  } else {
    operations[op] = checked;
    if (checked && op !== 'view' && cascades) operations.view = true;
  }

  return applyDependencies({ ...permissions, [screen.id]: withAccess(operations) });
};

/** Grant or revoke every operation on one screen. */
export const toggleScreen = (permissions, screen, checked) =>
  applyDependencies({
    ...permissions,
    [screen.id]: withAccess(blankOps(screen, checked)),
  });

/**
 * Grant or revoke a whole section. Screens blocked by a dependency are skipped
 * on grant rather than set and immediately cleared, so "select all" cannot leave
 * a row looking granted when applyDependencies is about to revoke it.
 */
export const toggleSection = (permissions, screens, checked) => {
  let next = { ...permissions };
  screens.forEach((screen) => {
    if (checked && getBlockedReason(screen.id, next)) return;
    next[screen.id] = withAccess(blankOps(screen, checked));
  });
  return applyDependencies(next);
};

/** granted/total for one screen, plus its tri-state checkbox flags. */
export const screenState = (permissions, screen) => {
  const ops = permissions?.[screen.id]?.operations ?? {};
  const granted = screen.ops.filter((op) => ops[op] === true).length;
  return {
    granted,
    total: screen.ops.length,
    checked: granted > 0 && granted === screen.ops.length,
    indeterminate: granted > 0 && granted < screen.ops.length,
  };
};

/**
 * granted/total across a section.
 *
 * Both flags come from the same count. They used to be computed differently —
 * "all" compared every operation while "some" read the stored access flag — so a
 * role whose access flag disagreed with its operations rendered an indeterminate
 * section header above rows with nothing ticked.
 */
export const sectionState = (permissions, screens) => {
  const granted = screens.reduce((n, s) => n + screenState(permissions, s).granted, 0);
  const total = screens.reduce((n, s) => n + s.ops.length, 0);
  return {
    granted,
    total,
    checked: granted > 0 && granted === total,
    indeterminate: granted > 0 && granted < total,
  };
};

export const countGranted = (permissions, screens) => sectionState(permissions, screens);

export const SHOW_FILTERS = [
  { value: 'all', label: 'All screens' },
  { value: 'granted', label: 'Granted only' },
  { value: 'denied', label: 'Not granted' },
  { value: 'special', label: 'Approvals & special' },
];

/**
 * Filter by free text and by the Show selector. Text matches the things an
 * admin might actually type: the screen name, its route, its description, and
 * the operation labels — so searching "approve" finds every screen that carries
 * an Approve right, wherever it lives.
 */
export const filterScreens = (screens, permissions, query, filter) => {
  const q = query.trim().toLowerCase();
  return screens.filter((screen) => {
    if (filter === 'special' && specialOps(screen).length === 0) return false;
    if (filter === 'granted' && screenState(permissions, screen).granted === 0) return false;
    if (filter === 'denied' && screenState(permissions, screen).granted > 0) return false;
    if (!q) return true;
    const haystack = [
      screen.name,
      screen.id,
      screen.path,
      screen.description,
      ...(screen.routes ?? []),
      ...screen.ops.map((op) => opLabel(screen, op)),
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  });
};

/** Keys the frontend no longer knows, carried through a save untouched. */
export const unknownKeys = (permissions, screens) => {
  const known = new Set(screens.map((s) => s.id));
  return Object.keys(permissions ?? {}).filter((k) => !known.has(k));
};
