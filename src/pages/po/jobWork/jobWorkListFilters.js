/**
 * The job-work PO lists keep their filter bar on one line from 1440px wide with the menu open:
 * a compact, fixed search box, and filters that start at the width they need and share what
 * is left — a long value is cut short rather than widening its column. Widths are the
 * column's, the 12px gutter included. Narrower screens wrap: the readable date ranges, the
 * selects and the search do not fit beside each other.
 */
export const LIST_GUTTER = [12, 12];

/** Room for a placeholder such as "PO no., CPR…"; the list's full search hint no longer fits. */
export const LIST_SEARCH_FLEX = '0 0 164px';

/** A filled date range needs this much to show both dates in full. */
export const RANGE_COL = 265;

/** A filter column at least `px` wide from lg up, growing into spare room; on `span` below lg. */
export const lineFilter = (px, span) => ({ span: { ...span, lg: { flex: `1 1 ${px}px` } }, colStyle: { minWidth: 0 } });
