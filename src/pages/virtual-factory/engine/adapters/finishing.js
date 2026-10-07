import { dayOf, num, sum, text } from '../util.js';

/** Sewing → finishing garment issues (/sewing/garment-issues). */
export const adaptGarmentIssues = (list) => (list || [])
  .filter((issue) => issue.status !== 'CANCELLED')
  .map((issue) => ({
    id: issue.id,
    no: text(issue.issueNo),
    orderNo: text(issue.orderNo),
    style: text(issue.styleNo),
    date: dayOf(issue.issueDate),
    qty: num(issue.totalQty),
    received: num(issue.totalReceived),
    pending: num(issue.remainingQty),
    status: text(issue.status),
  }));

/** Garments out at an external process vendor (/finishing/process-issues). */
export const adaptProcessIssues = (list) => (list || [])
  .filter((issue) => issue.status !== 'CANCELLED')
  .map((issue) => ({
    id: issue.id,
    no: text(issue.issueNo),
    orderNo: text(issue.orderNo),
    style: text(issue.styleNo),
    process: text(issue.processName),
    vendor: text(issue.vendorName),
    date: dayOf(issue.issueDate),
    expectedReturn: dayOf(issue.expectedReturnDate),
    issued: num(issue.totalIssuedQty),
    received: num(issue.totalReceivedQty),
    rejected: num(issue.totalRejectedQty),
    pending: num(issue.totalPendingQty),
    status: text(issue.status),
  }));

/**
 * Finishing: the station funnel and checks come from the Finishing module's own data (still a demo
 * store while that module runs on mocks); receipts from sewing and external processes are live.
 */
export const adaptFinishing = ({ dashboard, garmentIssues, processIssues, demo }) => {
  const d = dashboard || {};
  const funnel = new Map((d.funnel || []).map((f) => [text(f.stage), num(f.qty)]));
  return {
    demo: Boolean(demo),
    stations: {
      received: funnel.get('Received') || 0,
      trimmed: funnel.get('Thread trimmed') || 0,
      kaja: funnel.get('Kaja / Button') || 0,
      checked: funnel.get('Checked') || 0,
      ironed: funnel.get('Ironed') || 0,
      metalDetected: funnel.get('Metal detected') || 0,
    },
    dhuPct: d.dhu == null ? null : num(d.dhu),
    rftPct: d.rft == null ? null : num(d.rft),
    alterationRatePct: d.alterationRate == null ? null : num(d.alterationRate),
    wip: num(d.wip),
    alerts: (d.alerts || []).map((a) => ({ type: text(a.type), text: text(a.text) })),
    fromSewing: {
      issued: sum(garmentIssues, (g) => g.qty),
      received: sum(garmentIssues, (g) => g.received),
      pending: sum(garmentIssues, (g) => g.pending),
    },
    atVendors: processIssues.filter((p) => p.pending > 0),
  };
};
