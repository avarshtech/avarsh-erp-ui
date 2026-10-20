/**
 * Layout constants shared by the fabric and accessories stock drawers.
 *
 * Kept out of StockDrawerLayout.jsx because a module that exports both components and
 * plain values breaks Fast Refresh (react-refresh/only-export-components).
 */

/** Three columns from `sm` up, two on a phone. Spread onto DetailCard.Field. */
export const FIELD_SPAN = { xs: 12, sm: 8 };

/** The heading the bill-passing and GRN views already use above a table. */
export const SECTION_HEADING = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-secondary)',
  margin: '24px 0 8px',
};
