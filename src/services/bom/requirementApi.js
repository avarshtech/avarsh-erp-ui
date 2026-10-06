/**
 * What the Cut Panel and Garment Process Requirement clients share: the order context in the shape the screens
 * read, the server's page shape, and the one-shot cleanup of the design-phase mock stores.
 */
import { getColorHex } from '../../utils/colorConstants';
import { formatDate } from '../../utils/formatters';

/** The localStorage keys of the design-phase mocks: no code reads them since the API cutover. */
const MOCK_KEYS = [
  'avarsh.bom.cutPanel.mockStore.v1',
  'avarsh.bom.garmentProcess.mockStore.v1',
  'avarsh.po.jobWork.mockStore.v1',
];

try {
  MOCK_KEYS.forEach((key) => localStorage.removeItem(key));
} catch {
  // Private-mode / storage-disabled browsers: nothing to clean up anyway.
}

/** Colour swatches come from the name-based colour map: an order colour carries only its name. */
export const toOrderContext = (ctx) => ctx && ({
  ...ctx,
  colors: (ctx.colors || []).map((c) => ({ ...c, hex: getColorHex(c.name) })),
});

const shown = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatDate(v) : v);

/**
 * History rows as DocumentHistoryDrawer reads them: a field-level change ({ field, from, to }) is appended to the
 * row's details as "field: before → after", dates as the screens show them.
 */
export const toHistory = (events) => (events || []).map((e) => ({
  ...e,
  details: [e.details, ...(e.changes || []).map((c) => `${c.field}: ${shown(c.from)} → ${shown(c.to)}`)].filter(Boolean).join(' · '),
}));

/** The server page (PaginatedResponse) as the list screens read it. */
export const toPage = (data) => ({
  content: data?.content || [],
  totalElements: data?.totalElements || 0,
  pageNumber: data?.pageNumber ?? 0,
  pageSize: data?.pageSize ?? 25,
});

/** A list's filters as query params: blanks dropped, dates as yyyy-MM-dd, the table's 1-based page as 0-based. */
export const listParams = ({ page = 1, size = 10, ...filters } = {}) => {
  const params = { page: Math.max(page - 1, 0), size };
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = typeof value?.format === 'function' ? value.format('YYYY-MM-DD') : value;
  });
  return params;
};
