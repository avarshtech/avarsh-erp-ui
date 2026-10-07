/**
 * What the access table shows, worked out without React: which rows a section
 * lists, the counts the hero, the nav and the summary card print, and the state
 * of a column header's box. Everything is derived from the registry, never a
 * hardcoded number — the screen count moved twice while this was being built.
 */
import { CRUD_OPS, filterScreens, isGranted, screenState, specialOps } from './permissionMatrixModel';

/** An approval bundle is a set of rights inside its parent screen, not a screen of its own. */
export const isBundle = (screen) => screen.kind === 'approval';

const screensOnly = (screens) => screens.filter((s) => !isBundle(s));

const hasAny = (permissions, screen) => screenState(permissions, screen).granted > 0;

/** `{ granted, total }`: screens the role can open, of all the screens there are; bundles excluded. */
export const screenCount = (permissions, screens) => {
  const own = screensOnly(screens);
  return { granted: own.filter((s) => hasAny(permissions, s)).length, total: own.length };
};

/** Every right granted, bundle rights included. */
export const rightsCount = (permissions, screens) =>
  screens.reduce((n, s) => n + screenState(permissions, s).granted, 0);

/** How many screens hold each CRUD right, and how many other rights are granted (bundles included). */
export const opSummary = (permissions, screens) => {
  const own = screensOnly(screens);
  const summary = Object.fromEntries(CRUD_OPS.map((op) => [op, own.filter((s) => isGranted(permissions, s.id, op)).length]));
  summary.other = screens.reduce((n, s) => n + specialOps(s).filter((op) => isGranted(permissions, s.id, op)).length, 0);
  return summary;
};

/**
 * A section's rows: each screen, then the approval bundles that require it — attached by
 * `requires`, never by position, because the registry lists some bundles before their parent.
 * A screen stays while it or one of its bundles matches; a bundle shows only when it matches.
 */
export const buildRows = (section, permissions, query = '', filter = 'all') => {
  const matches = (screen) => filterScreens([screen], permissions, query, filter).length === 1;
  const parents = screensOnly(section.screens);
  const bundles = section.screens.filter(isBundle);
  const rows = [];
  parents.forEach((screen) => {
    const own = bundles.filter((b) => b.requires === screen.id && matches(b));
    if (!matches(screen) && own.length === 0) return;
    rows.push({ key: screen.id, screen, bundle: false });
    own.forEach((b) => rows.push({ key: b.id, screen: b, bundle: true }));
  });
  bundles
    .filter((b) => !parents.some((p) => p.id === b.requires) && matches(b))
    .forEach((b) => rows.push({ key: b.id, screen: b, bundle: true }));
  return rows;
};

/** Screens of a section matching the search and the Show filter — the nav's count while searching. */
export const matchCount = (section, permissions, query, filter) =>
  filterScreens(section.screens, permissions, query, filter).length;

/** A column header's box: tri-state over the screens that have the operation. */
export const columnState = (permissions, screens, op) => {
  const own = screens.filter((s) => s.ops.includes(op));
  const granted = own.filter((s) => isGranted(permissions, s.id, op)).length;
  return {
    disabled: own.length === 0,
    checked: granted > 0 && granted === own.length,
    indeterminate: granted > 0 && granted < own.length,
  };
};

export const changeKey = (screenId, op) => `${screenId}:${op}`;

/** The changes grouped by section, in section order: `[{ section, items }]`. */
export const groupChanges = (changes, sections) => sections
  .map((section) => ({ section, items: changes.filter((c) => c.screen.section === section.key) }))
  .filter((group) => group.items.length > 0);
