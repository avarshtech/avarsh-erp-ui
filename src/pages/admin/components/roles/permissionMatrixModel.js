/**
 * Pure logic behind the permission editor. No React, no Ant Design — so the
 * toggle rules can be reasoned about (and fixed) without touching the UI.
 *
 * Everything here takes a permissions object and returns a NEW one; nothing
 * mutates its input.
 */
import { applyDependencies, getBlockedReason, getEmptyPermissions } from '../../../../utils/permissions';

/** The four operations that get their own aligned column. */
export const CRUD_OPS = ['view', 'add', 'update', 'delete'];

/** Every operation any screen can declare needs a label here, or it renders as its raw key. */
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
  revise: 'Revise',
  override: 'Override',
  print: 'Print',
  reprint: 'Reprint',
  publish: 'Publish',
  lock: 'Lock',
  dispatch: 'Dispatch',
  receive: 'Receive',
  pay: 'Pay',
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

/**
 * Screens whose `requires` parent must be granted first come after every other
 * screen. The registry lists some approval bundles BEFORE their parent (GRN's
 * two bundles precede `inventory`, Costing's precedes `costing`), so a section
 * granted in registry order skipped them as still blocked.
 */
const parentsFirst = (screens) => [
  ...screens.filter((s) => !s.requires),
  ...screens.filter((s) => s.requires),
];

export const isGranted = (permissions, screenId, op) =>
  permissions?.[screenId]?.operations?.[op] === true;

/**
 * A stored role on a fresh template: every registry key present, each operation
 * taken from the stored map as a strict boolean, access derived from them — the
 * stored flag is free-form jsonb and can disagree. Keys this version does not
 * list are left out; a save would drop them anyway.
 */
export const fromStored = (stored) => {
  const merged = getEmptyPermissions();
  Object.keys(stored ?? {}).forEach((id) => {
    if (!merged[id]) return;
    const ops = { ...merged[id].operations };
    Object.keys(ops).forEach((op) => { ops[op] = stored[id]?.operations?.[op] === true; });
    merged[id] = withAccess(ops);
  });
  return applyDependencies(merged);
};

/**
 * Toggle one operation.
 *
 * `view` is the right to open the screen, so it cascades: turning it off clears
 * the screen, and turning anything else on turns it on. Screens with no view
 * operation — the approval bundles — opt out.
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
 * Grant or revoke a whole section, parents first. Screens still blocked by a
 * dependency are skipped on grant rather than set and immediately cleared, so
 * "all" cannot leave a row looking granted when applyDependencies revokes it.
 */
export const toggleSection = (permissions, screens, checked) => {
  const next = { ...permissions };
  parentsFirst(screens).forEach((screen) => {
    if (checked && getBlockedReason(screen.id, next)) return;
    next[screen.id] = withAccess(blankOps(screen, checked));
  });
  return applyDependencies(next);
};

/**
 * One operation across a section's screens — a column header's box. Screens
 * without the operation are untouched; it cascades through `view` as one box would.
 */
export const toggleColumn = (permissions, screens, op, checked) =>
  parentsFirst(screens)
    .filter((screen) => screen.ops.includes(op))
    .reduce((next, screen) => (checked && getBlockedReason(screen.id, next) ? next : toggleOp(next, screen, op, checked)), permissions);

/** View on every screen that has it, keeping every right already granted. */
export const addViewEverywhere = (permissions, screens) => toggleColumn(permissions, screens, 'view', true);

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
 * granted/total across a set of screens. Both flags come from the same count,
 * so a header can never read indeterminate above rows with nothing ticked.
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

/**
 * Every operation whose value differs between two permission maps, in the
 * order the screens are listed: `{ screen, op, granted }`, granted being the new value.
 */
export const diffPermissions = (before, after, screens) =>
  screens.flatMap((screen) => screen.ops
    .filter((op) => isGranted(before, screen.id, op) !== isGranted(after, screen.id, op))
    .map((op) => ({ screen, op, granted: isGranted(after, screen.id, op) })));

export const SHOW_FILTERS = [
  { value: 'all', label: 'All screens' },
  { value: 'granted', label: 'Granted only' },
  { value: 'denied', label: 'Not granted' },
  { value: 'special', label: 'With other rights' },
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
