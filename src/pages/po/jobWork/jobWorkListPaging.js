/**
 * The job-work PO lists page on the server: each page's rows get their flags here, and the CSV export reads every
 * page of the current filters (100 rows at a time, at most 5,000 rows).
 */
import { poFlags } from '../../../utils/jobWorkPoStatus';

const EXPORT_PAGE = 100;
const EXPORT_CAP = 5000;

/** A page with each row's flags (order cancelled, …), as the list columns read them. */
export const withFlags = (type, page) => ({
  ...page,
  content: page.content.map((r) => ({ ...r, flags: poFlags({ ...r, type }, { orderCancelled: r.orderCancelled }) })),
});

/** Every row the filters match, for the export. */
export const allRows = async (fetchPage, filters) => {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const p = await fetchPage({ ...filters, page, size: EXPORT_PAGE });
    rows.push(...p.content);
    if (p.content.length < EXPORT_PAGE || rows.length >= p.totalElements || rows.length >= EXPORT_CAP) return rows;
  }
};
