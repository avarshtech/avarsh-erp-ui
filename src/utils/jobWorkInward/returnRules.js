/**
 * Return to the principal (plan Phase 2): good garments up to what is packed and not yet sent, rejected
 * garments (no charge) up to the rejects found at checking, leftover lots up to what is in store, and
 * cutting waste when their rule is "returned to them" (decision 22). Pure.
 */
import { WASTE_RULE } from './inwardConstants';

const live = (rows) => (rows || []).filter((r) => (Number(r.qty) || 0) > 0);

/** [{ key?, message }] — `ready` / `rejectsAvailable` = { colour: { size: qty } }; `inStoreByLot` = { lotId: qty }. */
export const validateReturn = ({
  garments, rejects, lotLines, wasteKg, ready, rejectsAvailable, inStoreByLot, wasteHeld, wasteRule, ourChallanNo, shipTo,
}) => {
  const errors = [];
  const waste = Number(wasteKg) || 0;
  if (!live(garments).length && !live(rejects).length && !live(lotLines).length && waste <= 0) {
    errors.push({ message: 'Enter at least one quantity to send back.' });
  }
  live(garments).forEach((g) => {
    const can = ready?.[g.colour]?.[g.size] || 0;
    if (g.qty > can) errors.push({ key: `g|${g.colour}|${g.size}`, message: `${g.colour} ${g.size}: only ${can} packed and not yet returned.` });
  });
  live(rejects).forEach((g) => {
    const can = rejectsAvailable?.[g.colour]?.[g.size] || 0;
    if (g.qty > can) errors.push({ key: `r|${g.colour}|${g.size}`, message: `${g.colour} ${g.size}: only ${can} rejected pieces are held.` });
  });
  live(lotLines).forEach((l) => {
    const can = inStoreByLot?.[l.lotId] || 0;
    if (l.qty > can + 1e-9) errors.push({ key: `l|${l.lotId}`, message: `${l.lotNo || 'Lot'}: only ${can} is in store.` });
  });
  if (waste > 0 && wasteRule !== WASTE_RULE.RETURN) errors.push({ message: 'This principal\'s waste is sold with their consent — record the sale from Party Stock.' });
  else if (waste > (Number(wasteHeld) || 0) + 1e-9) errors.push({ message: `Only ${wasteHeld} kg of waste is held for this order.` });
  if (!(ourChallanNo || '').trim()) errors.push({ message: 'Enter our return challan number.' });
  if (shipTo) {
    if (!(shipTo.name || '').trim() || !(shipTo.address || '').trim()) errors.push({ message: 'Enter the name and address the goods are shipped to.' });
    if (!(shipTo.principalInvoiceNo || '').trim()) errors.push({ message: 'Shipping to their customer: enter the principal\'s invoice number the goods travel on.' });
  }
  return errors;
};
