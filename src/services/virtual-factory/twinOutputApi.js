import { decorateEntry } from '../../utils/packingEntryIssues';
import { newest, twinGet } from './twinHttp';

/** External processes, packing and the planning documents behind the floor (read-only). */
export const fetchProcessIssues = () => twinGet('/finishing/process-issues', { page: 0, size: 100 })
  .then((page) => page?.content || []);

export const fetchPackingEntries = (since) => twinGet('/packing/entries', { page: 0, size: 100, dateFrom: since })
  .then((page) => ({ ...page, content: (page?.content || []).map(decorateEntry) }));

export const fetchPackingDaily = (day) => twinGet('/packing/daily-summary', { date: day });

export const fetchCuttingPoList = () => twinGet('/cutting-po', newest(20));

export const fetchWorkOrders = () => twinGet('/work-order', newest(20));

export const fetchFinishingPos = () => twinGet('/finishing-po', newest(20));
