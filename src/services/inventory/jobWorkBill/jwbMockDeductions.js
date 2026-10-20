/**
 * Demo stand-in for the Stage 2 deduction endpoints — the lines of the Vendor Debit Note. Editable only while
 * the bill is with the clerk or the verifier (the same window as its lines).
 */
import { decorateBill, proposeDeductions } from '../../../utils/jobWorkBillCalc';
import { JW_DEDUCTION_TYPES } from '../../../utils/jobWorkBillConstants';
import { areDebitsEditable } from '../../../utils/billPassingConstants';
import { mutateJwbDb, nextId, refuse } from './jwbDemoStore';
import { logActivity, snapshotFromPo, withDeductionFigures } from './jwbMockSnapshot';
import { findBill } from './jwbMockBills';

const editableBill = (db, id) => {
  const bill = findBill(db, id);
  if (!areDebitsEditable(bill.status)) throw refuse(`Deductions on ${bill.jwbNumber} are closed in ${bill.status}`);
  return bill;
};

const done = (bill, action, details) => {
  bill.version += 1;
  bill.activity = logActivity(bill, action, details);
  return decorateBill(bill);
};

const invalid = (message) => refuse(message, { status: 400, error: 'VALIDATION_FAILED' });

/** "Propose deductions": re-read the DCs and checks, then propose from the figures as they stand. */
export const mockProposeDeductions = (id) => mutateJwbDb((db) => {
  const bill = editableBill(db, id);
  Object.assign(bill, snapshotFromPo(db, db.pos.find((p) => p.id === bill.poId), bill));
  bill.deductions = proposeDeductions(bill, decorateBill(bill).lines, bill.deductions || [], () => nextId(db, 'deduction'));
  const open = bill.deductions.filter((d) => d.status === 'PROPOSED').length;
  return done(bill, 'Deductions proposed', `${open} open proposal(s)`);
});

/** Add (no id) or edit a deduction. Quantity types are priced as quantity × rate; the rest carry an amount. */
export const mockSaveDeduction = (id, input) => mutateJwbDb((db) => {
  const bill = editableBill(db, id);
  const type = JW_DEDUCTION_TYPES[input.type];
  if (!type) throw invalid('Pick a deduction type');
  if (!input.reason?.trim()) throw invalid('Give the reason the vendor will read on the debit note');
  if (type.basis && !(Number(input.qty) > 0)) throw invalid(`${type.label} needs a quantity`);
  const existing = input.id ? bill.deductions.find((d) => d.id === input.id) : null;
  const row = withDeductionFigures({
    ...(existing || { id: nextId(db, 'deduction'), origin: 'MANUAL', status: 'PROPOSED' }),
    type: input.type, lineId: input.lineId ?? null, qty: type.basis ? Number(input.qty) : null,
    rate: type.basis ? Number(input.rate) || 0 : null, amount: input.amount,
    gstTreatment: input.gstTreatment || type.gst, reason: input.reason.trim(), remarks: input.remarks || '',
  }, bill.gstRatePercent);
  bill.deductions = existing ? bill.deductions.map((d) => (d.id === row.id ? row : d)) : [...bill.deductions, row];
  return done(bill, existing ? 'Deduction edited' : 'Deduction added', `${type.label}: ${row.amount}`);
});

export const mockSetDeductionStatus = (id, deductionId, status, reason) => mutateJwbDb((db) => {
  const bill = editableBill(db, id);
  const d = bill.deductions.find((x) => x.id === deductionId);
  if (!d) throw invalid('That deduction is no longer on the bill');
  if (status === 'CONFIRMED' && !(d.amount > 0)) {
    throw invalid(JW_DEDUCTION_TYPES[d.type]?.basis === 'PCS'
      ? 'Key the recovery rate per piece before confirming' : 'A deduction of nothing cannot be confirmed');
  }
  if (status === 'DROPPED' && !reason?.trim()) throw invalid('Say why the deduction is dropped');
  d.status = status;
  d.droppedReason = status === 'DROPPED' ? reason.trim() : null;
  return done(bill, status === 'CONFIRMED' ? 'Deduction confirmed' : 'Deduction dropped',
    `${JW_DEDUCTION_TYPES[d.type]?.label}: ${d.amount}`);
});

/** A system proposal is dropped, never deleted — the verifier's ruling stays on record. */
export const mockDeleteDeduction = (id, deductionId) => mutateJwbDb((db) => {
  const bill = editableBill(db, id);
  const d = bill.deductions.find((x) => x.id === deductionId);
  if (!d) throw invalid('That deduction is no longer on the bill');
  if (d.origin !== 'MANUAL') throw invalid('Drop a proposed deduction instead of deleting it');
  bill.deductions = bill.deductions.filter((x) => x.id !== deductionId);
  return done(bill, 'Deduction removed', JW_DEDUCTION_TYPES[d.type]?.label);
});
