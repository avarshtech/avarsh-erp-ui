/**
 * A job order's materials (plan Phase 2): what each line needs, what the principal sent, what is short
 * (decision 20: we wait, never buy), and the Material In checks. Pure.
 */
import { MAIN_KIND, MATERIAL_KIND, SUPPLIED_BY } from './inwardConstants';

const COUNT_UOMS = ['pcs', 'sets', 'cone', 'nos', 'pairs'];
const sum = (values) => values.reduce((a, b) => a + (Number(b) || 0), 0);
export const roundFor = (uom, n) => (COUNT_UOMS.includes(uom) ? Math.ceil(n - 1e-9) : Math.round(n * 100) / 100);

export const qtyByColour = (jo) => Object.fromEntries(jo.colours.map(({ colour, qty }) => [colour, sum(Object.values(qty))]));
export const orderQty = (jo) => sum(Object.values(qtyByColour(jo)));

const piecesFor = (material, jo) => (material.colour ? (qtyByColour(jo)[material.colour] || 0) : orderQty(jo));

/** consumption × pieces (the line's colour, or the whole order) × (1 + allowance). */
export const requiredQty = (material, jo) => roundFor(
  material.uom, (Number(material.consumption) || 0) * piecesFor(material, jo) * (1 + (Number(material.allowancePct) || 0) / 100),
);

/**
 * Per material line: required, received, usable (received − defective), short against the requirement
 * (principal lines only), blocking when even the order itself is not covered without the allowance,
 * issued net of what came back, and in store. `lots` = the order's live lots, each with its `ledger`.
 */
export const materialStatus = (jo, lots) => jo.materials.map((m) => {
  const mine = lots.filter((l) => l.materialId === m.id);
  const received = sum(mine.map((l) => l.receivedQty));
  const defective = sum(mine.map((l) => l.defectiveQty));
  const usable = roundFor(m.uom, received - defective);
  const required = requiredQty(m, jo);
  const fromPrincipal = m.suppliedBy === SUPPLIED_BY.PRINCIPAL;
  return {
    ...m,
    required,
    received: roundFor(m.uom, received),
    defective,
    usable,
    short: fromPrincipal ? Math.max(0, roundFor(m.uom, required - usable)) : 0,
    blocking: fromPrincipal && usable < (Number(m.consumption) || 0) * piecesFor(m, jo) - 1e-9,
    issued: roundFor(m.uom, sum(mine.map((l) => l.ledger.consumable))),
    inStore: roundFor(m.uom, sum(mine.map((l) => l.ledger.inStore))),
    pct: fromPrincipal && required ? Math.min(100, Math.round((usable / required) * 100)) : null,
    lotCount: mine.length,
  };
});

/** A principal line cannot cover the order even without its allowance: the order waits (decision 20). */
export const waitingForPrincipal = (status) => status.some((m) => m.blocking);

/** Pieces each main-material line can make: usable ÷ (consumption × (1 + allowance)). */
export const piecesPossible = (m) => {
  const per = (Number(m.consumption) || 0) * (1 + (Number(m.allowancePct) || 0) / 100);
  return per ? Math.floor(m.usable / per + 1e-9) : null;
};

/** Main material received against required, for the order's first progress chip. */
export const mainMaterialIn = (jo, status) => {
  const main = status.filter((m) => m.kind === MAIN_KIND[jo.scope] && m.suppliedBy === SUPPLIED_BY.PRINCIPAL);
  return { cum: roundFor(main[0]?.uom, sum(main.map((m) => m.usable))), plan: roundFor(main[0]?.uom, sum(main.map((m) => m.required))), uom: main[0]?.uom };
};

/** Short against the principal's own challan: fabric beyond their weight tolerance, counts at all. */
export const challanShort = ({ kind, challanQty, receivedQty, tolerancePct }) => {
  const diff = (Number(challanQty) || 0) - (Number(receivedQty) || 0);
  if (diff <= 1e-9) return 0;
  if (kind !== MATERIAL_KIND.FABRIC) return diff;
  return diff > ((Number(challanQty) || 0) * (Number(tolerancePct) || 0)) / 100 + 1e-9 ? Math.round(diff * 1000) / 1000 : 0;
};

/**
 * Material In checks: [{ key?, message }]. `lines` = [{ key, kind, receivedQty, rolls? }].
 * An inter-state receipt needs the e-way bill whatever its value.
 */
export const validateInward = ({
  jobOrderId, theirDcNo, theirDcDate, date, today, lines, interState, ewayBillNo, postedDcNos = [],
}) => {
  const errors = [];
  if (!jobOrderId) errors.push({ message: 'Pick the job order.' });
  const dc = (theirDcNo || '').trim().toUpperCase();
  if (!dc) errors.push({ message: 'Enter the principal\'s challan number.' });
  else if (postedDcNos.map((d) => String(d).trim().toUpperCase()).includes(dc)) errors.push({ message: `Challan ${theirDcNo} is already received from this principal.` });
  if (!theirDcDate) errors.push({ message: 'Enter the principal\'s challan date.' });
  if (!date || date > today) errors.push({ message: 'The received date cannot be empty or in the future.' });
  else if (theirDcDate && theirDcDate > date) errors.push({ message: 'Their challan cannot be dated after the goods arrived.' });
  if (interState && !(ewayBillNo || '').trim()) errors.push({ message: 'Inter-state job-work goods need an e-way bill, whatever the value.' });
  const live = (lines || []).filter((l) => (Number(l.receivedQty) || 0) > 0);
  if (!live.length) errors.push({ message: 'Enter at least one received quantity.' });
  const rollNos = live.flatMap((l) => (l.rolls || []).map((r) => String(r.rollNo || '').trim().toUpperCase()));
  if (rollNos.some((r) => !r)) errors.push({ message: 'Every roll needs its number.' });
  if (new Set(rollNos).size !== rollNos.length) errors.push({ message: 'A roll number is repeated.' });
  return errors;
};
