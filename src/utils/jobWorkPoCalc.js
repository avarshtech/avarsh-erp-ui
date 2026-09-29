/**
 * Job-work PO quantities and values — shared by the Cut Panel PO and the Garment Process
 * PO (CPP PRD §11.3 / §13.3, GPO PRD §14–15). Pure functions.
 *
 *   billing qty = PO qty converted by the UOM (Piece 1 : 1, Dozen ÷ 12; Kg, Metre, Lot and
 *                 Other are keyed on the line — there is no panel weight to convert by)
 *   amount      = ROUND(billing qty × rate, 2)
 *   taxable     = basic + other charges (a job-work PO carries no discount)
 *   GST         = ROUND(taxable × rate, 2): IGST, or CGST (half, rounded half-up) + SGST
 *                 (the rest), so the two always add back to the tax
 *   PO value    = taxable + GST;   rounded = PO value to the rupee, half-up
 */
import { JOB_WORK_UOMS } from './jobWorkConstants';

const shift = (n, dp) => {
  const v = Number(n) || 0;
  if (/e/i.test(String(v))) return Math.round(v * 10 ** dp) / 10 ** dp;
  return Number(`${Math.round(Number(`${v}e${dp}`))}e-${dp}`);
};

/** Half-up to 2 dp on the decimal value, not its binary approximation (1.005 → 1.01). */
export const round2 = (n) => shift(n, 2);
export const round3 = (n) => shift(n, 3);

const perUnit = (uom) => JOB_WORK_UOMS.find((u) => u.value === uom)?.perUnit ?? null;

/** Kg, Metre, Lot and Other: the billing quantity is keyed on the line. */
export const isKeyedBilling = (uom) => perUnit(uom) == null;

/** The quantity the rate applies to, or null while a keyed one is still blank. */
export const billingQty = (line) => {
  const per = perUnit(line.uom);
  if (per != null) return round3((Number(line.poQty) || 0) / per);
  return line.billingQty === null || line.billingQty === undefined || line.billingQty === '' ? null : Number(line.billingQty);
};

const hasRate = (line) => line.rate !== null && line.rate !== undefined && line.rate !== '';

export const lineAmount = (line) => {
  const qty = billingQty(line);
  return qty == null || !hasRate(line) ? 0 : round2(qty * Number(line.rate));
};

/**
 * The PO value block. `igst` follows the vendor's IGST tick (deviation D2 — place of
 * supply moves to the server in the API phase).
 */
export const poValue = ({ lines, otherCharges = 0, gstRatePercent = 0, igst = false }) => {
  const basic = round2(lines.reduce((s, l) => s + lineAmount(l), 0));
  const charges = round2(Number(otherCharges) || 0);
  const taxable = round2(basic + charges);
  const tax = round2((taxable * (Number(gstRatePercent) || 0)) / 100);
  const cgst = igst ? 0 : round2(tax / 2);
  const sgst = igst ? 0 : round2(tax - cgst);
  const total = round2(taxable + tax);
  const rounded = Math.round(total);
  return {
    basic, otherCharges: charges, taxable, gstRatePercent: Number(gstRatePercent) || 0, igst,
    cgst, sgst, igstAmount: igst ? tax : 0, tax, total, rounded, roundOff: round2(rounded - total),
  };
};

/** Quantity and value per UOM — the print shows these instead of one total when UOMs are mixed (EC-12). */
export const subtotalsByUom = (lines) => {
  const out = new Map();
  lines.forEach((l) => {
    const t = out.get(l.uom) || { uom: l.uom, poQty: 0, billingQty: 0, amount: 0 };
    t.poQty += Number(l.poQty) || 0;
    t.billingQty = round3(t.billingQty + (billingQty(l) || 0));
    t.amount = round2(t.amount + lineAmount(l));
    out.set(l.uom, t);
  });
  return [...out.values()];
};
