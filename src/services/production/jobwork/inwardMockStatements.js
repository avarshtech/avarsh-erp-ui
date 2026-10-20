/**
 * Mock of the inward statements (plan Phase 2): the party statement (the principal's material in and
 * out, with what is in store and what is not yet accounted for), the job-charges statement the
 * accountant raises the Tally invoice from (decision 4), and the status report the principal gets.
 * Never reaches the API.
 */
import dayjs from 'dayjs';
import { RETURN_STATUS } from '../../../utils/jobWorkInward/inwardConstants';
import { billingOverdue, returnCharges } from '../../../utils/jobWorkInward/chargeRules';
import {
  clone, latency, mockError, todayIso,
} from './jobWorkTrackerStore';
import { loadInwardDb, mutateInwardDb } from './inwardStore';
import { jobOrderContext } from './inwardMockContext';
import { challanOfLots } from './inwardMockLedger';
import { jobOrderView } from './inwardMockOrderView';

const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const MOVE_TEXT = {
  ISSUE: 'Issued to production', BACK: 'Back from production', RETURN: 'Returned to you', WRITE_OFF: 'Written off', MOVE_OUT: 'Moved to your next order',
};

/** One principal's material account, optionally for one job order. */
export const getPartyStatement = ({ principalId, jobOrderId } = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const principal = db.principals.find((p) => p.id === Number(principalId));
  if (!principal) return Promise.reject(mockError('Pick a principal.'));
  const orders = db.jobOrders.filter((j) => j.principalId === principal.id && (!jobOrderId || j.id === Number(jobOrderId)));
  const rows = [];
  const summary = [];
  const accounts = [];
  orders.forEach((jo) => {
    const ctx = jobOrderContext(db, jo, today);
    const challanOf = challanOfLots(db, ctx.lots);
    const itemOf = (l) => jo.materials.find((m) => m.id === l.materialId)?.itemName;
    ctx.lots.forEach((l) => {
      rows.push({ date: l.receivedOn, docNo: db.inwards.find((i) => i.id === l.inwardId)?.inwardNo, orderNo: jo.orderNo, text: l.origin ? `Moved in (${l.origin.docNo})` : `Received on your challan ${challanOf[l.id]}`, itemName: itemOf(l), lotNo: l.lotNo, uom: l.uom, qtyIn: l.receivedQty, qtyOut: 0 });
      db.movements.filter((m) => m.lotId === l.id && !m.cancelled).forEach((m) => {
        const inbound = m.type === 'BACK';
        rows.push({ date: m.date, docNo: m.docNo, orderNo: jo.orderNo, text: `${MOVE_TEXT[m.type]}${m.target ? ` — ${m.target.docNo}` : ''}${m.reason && m.type === 'WRITE_OFF' ? ` — ${m.reason}` : ''}`, itemName: itemOf(l), lotNo: l.lotNo, uom: l.uom, qtyIn: inbound ? m.qty : 0, qtyOut: inbound ? 0 : m.qty });
      });
      summary.push({ orderNo: jo.orderNo, itemName: itemOf(l), lotNo: l.lotNo, theirDcNo: challanOf[l.id], uom: l.uom, received: l.receivedQty, inStore: l.ledger.inStore, outstanding: l.outstanding, ageDays: l.ageDays, ageLevel: l.ageLevel });
    });
    ctx.rets.forEach((r) => rows.push({ date: r.date, docNo: r.returnNo, orderNo: jo.orderNo, text: `Garments returned on our challan ${r.ourChallanNo}`, itemName: `${jo.styleNo} — ${sum(r.garments.map((g) => g.qty))} good, ${sum(r.rejects.map((g) => g.qty))} rejected`, uom: 'pcs', qtyIn: 0, qtyOut: sum([...r.garments, ...r.rejects].map((g) => g.qty)), garments: true }));
    db.waste.filter((w) => w.jobOrderId === jo.id && !w.cancelled && w.type !== 'HELD').forEach((w) => rows.push({
      date: w.date, docNo: w.docNo, orderNo: jo.orderNo, text: w.type === 'SOLD' ? `Cutting waste sold with your consent (${w.consentRef}) to ${w.buyer}` : 'Cutting waste returned to you',
      itemName: jo.materials.find((m) => m.id === w.materialId)?.itemName, uom: 'kg', qtyIn: 0, qtyOut: w.kg, waste: true,
    }));
    accounts.push(...jobOrderView(db, ctx).fabricAccount.map((a) => ({ ...a, orderNo: jo.orderNo })));
  });
  rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.docNo).localeCompare(String(b.docNo)));
  rows.forEach((r, i) => { r.key = i + 1; });
  return latency(clone({ principal, rows, summary, accounts }));
};

/** Job charges per return for Tally: filter by principal, month (YYYY-MM) and Tally status. */
export const listCharges = ({ principalId, month, tally } = {}) => {
  const db = loadInwardDb();
  const today = todayIso();
  const rows = db.returns.filter((r) => r.status === RETURN_STATUS.DISPATCHED && (!month || r.date.startsWith(month))).map((r) => {
    const jo = db.jobOrders.find((j) => j.id === r.jobOrderId);
    const principal = db.principals.find((p) => p.id === jo.principalId);
    const c = returnCharges({ jo, principal, branch: db.branch, garments: r.garments });
    return {
      returnId: r.id, returnNo: r.returnNo, ourChallanNo: r.ourChallanNo, date: r.date, principalId: principal.id, principalName: principal.name, gstin: principal.gstin,
      orderNo: jo.orderNo, styleNo: jo.styleNo, sacCode: jo.sacCode, ...c, rate: c.pieces ? Math.round((c.taxable / c.pieces) * 100) / 100 : 0,
      tally: r.tally, overdue: billingOverdue({ returnDate: r.date, today, invoiced: !!r.tally }),
    };
  }).filter((r) => (!principalId || r.principalId === principalId) && (!tally || (tally === 'RECORDED' ? !!r.tally : !r.tally)))
    .sort((a, b) => a.date.localeCompare(b.date));
  return latency(rows);
};

/** The accountant raised one Tally invoice for these returns (one principal); record its number. */
export const recordTallyInvoice = ({ returnIds = [], invoiceNo = '', invoiceDate } = {}) => mutateInwardDb((db) => {
  const rets = db.returns.filter((r) => returnIds.includes(r.id));
  if (!rets.length) throw mockError('Pick the returns the invoice covers.');
  if (!invoiceNo.trim()) throw mockError('Enter the Tally invoice number.');
  const principals = new Set(rets.map((r) => db.jobOrders.find((j) => j.id === r.jobOrderId).principalId));
  if (principals.size > 1) throw mockError('One invoice covers one principal\'s returns.');
  if (rets.some((r) => r.tally)) throw mockError('Some of these returns are already in Tally.', { status: 409, code: 'CONFLICT' });
  const latest = rets.map((r) => r.date).sort().pop();
  if (!invoiceDate || invoiceDate < latest || invoiceDate > todayIso()) throw mockError(`The invoice date must be between ${latest} and today.`);
  rets.forEach((r) => { r.tally = { invoiceNo: invoiceNo.trim(), invoiceDate }; });
  return latency({ count: rets.length });
});

/** The principal's status report for one job order. */
export const getStatusReport = (jobOrderId) => {
  const db = loadInwardDb();
  const jo = db.jobOrders.find((j) => j.id === Number(jobOrderId));
  if (!jo) return Promise.reject(mockError('Job order not found.', { code: 'NOT_FOUND', status: 404 }));
  const today = todayIso();
  const view = jobOrderView(db, jobOrderContext(db, jo, today));
  return latency(clone({
    asOf: today, printedAt: dayjs().format('YYYY-MM-DD HH:mm'), jobOrder: jo, principal: view.principal, branch: view.branch, row: view.row,
    progress: view.progress, shortLines: view.materials.filter((m) => m.short > 0), returns: view.returns.filter((r) => r.status === RETURN_STATUS.DISPATCHED),
    stitchedNote: 'Stitched is counted for the whole order: the sewing line records pieces, not colours.',
    wasteOnHand: r3(view.waste.onHand),
  }));
};
