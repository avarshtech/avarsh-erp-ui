/**
 * The job-work PO lists keep their filter bar on one line with the menu open — the Cut Panel
 * PO (two date ranges) from 1440px wide even with a scrollbar, the Garment Process PO from
 * about 1350px: a small search box, and filters that start at the width their default text
 * needs; all of them share what is left, and a long value is cut short rather than widening
 * its column. Widths are the column's, the 12px gutter included. Narrower screens wrap rather
 * than cut the text.
 */
export const LIST_GUTTER = [12, 12];

/** Just room for "Search": the narrowest box that keeps the Cut Panel PO bar on one line at 1440px. */
export const LIST_SEARCH_FLEX = '1 1 120px';

/** A filled date range needs this much to show both dates in full. */
export const RANGE_COL = 268;

/** A filter column at least `px` wide from lg up, growing into spare room; on `span` below lg. */
export const lineFilter = (px, span) => ({ span: { ...span, lg: { flex: `1 1 ${px}px` } }, colStyle: { minWidth: 0 } });
