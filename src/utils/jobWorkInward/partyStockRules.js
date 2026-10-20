/**
 * Party stock — the principal's material while it is with us (plan Phase 2). Every figure comes
 * from one append-only movement log: a lot is one Material In line; movements are ISSUE (to our
 * cutting / sewing or a process vendor), BACK (unused or end-bits back from production), RETURN (to
 * the principal), WRITE_OFF and MOVE_OUT (to their next order, which opens a new lot). Pure.
 */
import { AGE_WARN_DAYS, TARGET_TYPE } from './inwardConstants';

export const MOVEMENT = {
  ISSUE: 'ISSUE', BACK: 'BACK', RETURN: 'RETURN', WRITE_OFF: 'WRITE_OFF', MOVE_OUT: 'MOVE_OUT',
};

const sumQty = (rows) => rows.reduce((a, m) => a + (Number(m.qty) || 0), 0);
const round3 = (n) => Math.round(n * 1000) / 1000;

/** One lot's account. `movements` = the live movements of this lot only. */
export const lotLedger = (lot, movements) => {
  const of = (type) => sumQty(movements.filter((m) => m.type === type));
  const received = Number(lot.receivedQty) || 0;
  const issued = of(MOVEMENT.ISSUE);
  const back = of(MOVEMENT.BACK);
  const returned = of(MOVEMENT.RETURN);
  const writtenOff = of(MOVEMENT.WRITE_OFF);
  const movedOut = of(MOVEMENT.MOVE_OUT);
  const atVendor = movements.filter((m) => m.type === MOVEMENT.ISSUE && m.target?.type === TARGET_TYPE.PROCESS_PO)
    .reduce((a, m) => a + Math.max(0, (Number(m.qty) || 0) - (Number(m.backFromVendor) || 0)), 0);
  return {
    received, issued, back, returned, writtenOff, movedOut, atVendor,
    inStore: round3(received - issued + back - returned - writtenOff - movedOut),
    consumable: round3(issued - back),
  };
};

/** Days since the principal's challan date (a moved lot keeps its original date). */
export const ageDays = (fromIso, todayIso) => Math.max(0, Math.round((new Date(todayIso) - new Date(fromIso)) / 86400000));

/** 0 when fine, otherwise the warning threshold reached (300 / 330 / 365). */
export const ageLevel = (days) => [...AGE_WARN_DAYS].reverse().find((d) => days >= d) || 0;

/** Problems issuing lots to production: [{ lotId?, message }]. `lines` = [{ lotId, qty }]. */
export const validateIssue = ({ target, lines, inStoreByLot, lotJobOrder, jobOrderId }) => {
  const errors = [];
  if (!target?.docNo) errors.push({ message: 'Pick where the material goes.' });
  const live = (lines || []).filter((l) => (Number(l.qty) || 0) > 0);
  if (!live.length) errors.push({ message: 'Enter a quantity for at least one lot.' });
  live.forEach((l) => {
    if (lotJobOrder[l.lotId] !== jobOrderId) errors.push({ lotId: l.lotId, message: 'A principal\'s material goes only to their own order.' });
    if (Number(l.qty) > (inStoreByLot[l.lotId] || 0) + 1e-9) errors.push({ lotId: l.lotId, message: `Only ${inStoreByLot[l.lotId] || 0} is in store.` });
  });
  return errors;
};

/** Move or write off part of a lot: the quantity must be in store; each needs its own reference. */
export const validateLotAction = ({ mode, qty, inStore, toJobOrderId, consentRef, reason }) => {
  const errors = [];
  const q = Number(qty) || 0;
  if (q <= 0) errors.push({ message: 'Enter a quantity above 0.' });
  if (q > inStore + 1e-9) errors.push({ message: `Only ${inStore} is in store.` });
  if (mode === 'MOVE') {
    if (!toJobOrderId) errors.push({ message: 'Pick the principal\'s order it moves to.' });
    if (!(consentRef || '').trim()) errors.push({ message: 'Enter the principal\'s consent reference.' });
  } else if (!(reason || '').trim()) errors.push({ message: 'Give a reason for the write-off.' });
  return errors;
};
