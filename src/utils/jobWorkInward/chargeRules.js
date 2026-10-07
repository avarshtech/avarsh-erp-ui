/**
 * Job charges on a return (decision 4: billed in Tally from an ERP statement). Good pieces × the job
 * rate (per size when the order has size rates); rejected pieces are never charged. CGST + SGST when the
 * principal's GSTIN state is the branch's state, IGST otherwise — the same rounding as job-work POs
 * (`poValue`). Pure.
 */
import { poValue } from '../jobWorkPoCalc';
import { getStateCodeFromGstin } from '../indianStates';

/** Days after a return within which the job-charge invoice should be raised. */
export const BILLING_DUE_DAYS = 30;

export const stateCodeOf = (party) => getStateCodeFromGstin(party?.gstin) || party?.stateCode || '';
export const isInterState = (principal, branch) => stateCodeOf(principal) !== stateCodeOf(branch);
export const rateFor = (jo, size) => Number(jo.ratesBySize?.[size] ?? jo.rate) || 0;

/** { pieces, taxable, cgst, sgst, igst, tax, total, interState, gstPct } for good garments [{ size, qty }]. */
export const returnCharges = ({ jo, principal, branch, garments }) => {
  const interState = isInterState(principal, branch);
  const lines = (garments || []).filter((g) => (Number(g.qty) || 0) > 0)
    .map((g) => ({ uom: 'PIECE', poQty: Number(g.qty), rate: rateFor(jo, g.size) }));
  const v = poValue({ lines, gstRatePercent: jo.gstRatePct, igst: interState });
  return {
    pieces: lines.reduce((a, l) => a + l.poQty, 0),
    taxable: v.taxable,
    cgst: v.cgst,
    sgst: v.sgst,
    igst: v.igstAmount,
    tax: v.tax,
    total: v.total,
    interState,
    gstPct: v.gstRatePercent,
  };
};

/** Unbilled for longer than BILLING_DUE_DAYS after the return. */
export const billingOverdue = ({ returnDate, today, invoiced }) => !invoiced
  && Math.round((new Date(today) - new Date(returnDate)) / 86400000) > BILLING_DUE_DAYS;

/** The concessional job-work rate needs a registered principal; warn when there is no GSTIN. */
export const concessionNote = (principal, gstPct) => (!principal?.gstin && Number(gstPct) < 18
  ? 'The concessional job-work rate needs a registered principal; check the rate with your CA.' : null);
