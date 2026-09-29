/**
 * Delivery Instructions of the job-work POs (Cut Panel PO, Garment Process PO): where the
 * processed goods return (Return To, with a name when "Other"), the return unit from the
 * Unit master (HR › Units) — snapshotted on the PO with its address, shown as the delivery
 * place — one expected delivery date, and the processing instructions.
 */
import dayjs from 'dayjs';

/** A unit's address on one line: street, city, state and pincode. */
export const unitAddress = (u) => [u?.address, u?.city, [u?.state, u?.pincode].filter(Boolean).join(' ')]
  .filter(Boolean).join(', ');

/** The return unit as the PO keeps it — the unit may later change or retire; the PO keeps what it said. */
export const unitSnapshot = (u) => ({
  returnUnitId: u?.id ?? null, returnUnitName: u?.unitName ?? null, returnUnitAddress: u ? unitAddress(u) || null : null,
});

/** The value that stands for a PO's own unit snapshot when its unit is not listed any more. */
export const OWN_UNIT = '__own_unit__';

/**
 * Options of the Return unit select: the branch's active units, led by the PO's own snapshot
 * when its unit is not among them (retired, another branch, or a seeded name-only one).
 */
export const returnUnitOptions = (units, doc) => {
  const options = units.map((u) => ({ value: u.id, label: u.unitName }));
  const listed = doc.returnUnitId != null && units.some((u) => u.id === doc.returnUnitId);
  return doc.returnUnitName && !listed ? [{ value: doc.returnUnitId ?? OWN_UNIT, label: doc.returnUnitName }, ...options] : options;
};

/**
 * A word under the expected delivery date, or null: before `notBefore` (the PO date) it is an
 * error, after `warnAfter` (a required date) only a warning.
 */
export const deliveryDateNote = (date, { notBefore, warnAfter }) => {
  if (date && notBefore && dayjs(date).isBefore(notBefore, 'day')) return { type: 'error', text: 'Must be on or after the PO date.' };
  if (date && warnAfter && dayjs(date).isAfter(warnAfter, 'day')) return { type: 'warning', text: 'After the required date.' };
  return null;
};

/** What the Delivery Instructions still lack; the caller adds its own code (VR-01, V14). */
export const deliveryIssues = (doc, dateKey) => [
  !doc.returnTo && 'Select where the goods return to',
  doc.returnTo === 'OTHER' && !String(doc.returnToOther || '').trim() && 'Name the other return place',
  !doc.returnUnitName && 'Select the return unit',
  !doc[dateKey] && 'Enter the expected delivery date',
].filter(Boolean);
