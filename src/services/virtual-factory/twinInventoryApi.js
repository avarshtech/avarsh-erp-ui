import { newest, twinGet } from './twinHttp';

/** Receiving, fabric inspection, stock and material issues (read-only). */
export const fetchGrns = (since) => twinGet('/grns', newest(40, { dateStart: since }));

export const fetchFabricQc = (since) => twinGet('/qc', newest(30, { type: 'Fabric', dateStart: since }));

export const fetchFabricStock = () => twinGet('/inventory/stock/fabric', { page: 0, size: 60, sort: 'itemCode', direction: 'asc' });

export const fetchTrimStock = () => twinGet('/inventory/stock/accessories', { page: 0, size: 40, sort: 'itemCode', direction: 'asc' });

export const fetchIssues = (since) => twinGet('/material-issues', { page: 0, size: 40, dateFrom: since });
