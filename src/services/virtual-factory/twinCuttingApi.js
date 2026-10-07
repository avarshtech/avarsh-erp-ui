import { twinGet } from './twinHttp';

/** The cutting room (read-only). */
export const fetchCuttingDashboard = () => twinGet('/cutting/dashboard');

export const fetchCutPos = () => twinGet('/cutting/cut-pos');

export const fetchMarkerPlans = () => twinGet('/cutting/marker-plans', { page: 0, size: 100, status: 'IN_PROGRESS' })
  .then((page) => page?.content || []);

export const fetchLayAudits = (day) => twinGet('/cutting/lay-audits', { page: 0, size: 100, dateFrom: day, dateTo: day })
  .then((page) => page?.content || []);

export const fetchCuttingTables = () => twinGet('/cutting-tables/active');
