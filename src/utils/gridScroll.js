/**
 * Scrolling for the long line grids of the job-work screens (requirement and PO lines). A grid taller than its
 * viewport-high box scrolls inside it — header and totals pinned, the horizontal scrollbar always in reach instead of
 * at the foot of a page-long table. A grid that fits keeps its natural height: antd gives a fixed-height body a
 * permanent scrollbar track, which beside a few rows reads as a stray scroll.
 */
const CHROME = 340; // page header, card title and toolbar, and the sticky action bar around the grid
const MIN_BODY = 320;
const ROW = 42; // a row of small inputs

export const GRID_BODY_HEIGHT = `max(${MIN_BODY}px, calc(100vh - ${CHROME}px))`;

const bodyHeight = () => Math.max(MIN_BODY, (typeof window === 'undefined' ? 768 : window.innerHeight) - CHROME);

/** antd Table `scroll` for a grid of `rowCount` rows that is `x` wide. */
export const gridScroll = (x, rowCount) => (rowCount * ROW > bodyHeight() ? { x, y: GRID_BODY_HEIGHT } : { x });
