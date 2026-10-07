import { twinGet } from './twinHttp';

/** The sewing floor and end-line QC (read-only). */
export const fetchProductionLines = () => twinGet('/production-lines');

export const fetchSewingDashboard = (day) => twinGet('/sewing/dashboard', { date: day });

export const fetchSewingPlans = () => twinGet('/sewing/plans');

export const fetchShifts = () => twinGet('/hr/shifts/active');

export const fetchHourlySheet = (planId, day, shiftId) => twinGet('/sewing/hourly/sheet', { planId, date: day, shiftId });

export const fetchTopse = () => twinGet('/sewing/topse');

export const fetchPendingBundleIssues = () => twinGet('/sewing/cut-receipts/pending-issues');

export const fetchGarmentIssues = () => twinGet('/sewing/garment-issues');
