import { useCallback, useState } from 'react';
import {
  deleteJobWorkDeduction, proposeJobWorkDeductions, saveJobWorkDeduction, setJobWorkDeductionStatus,
} from '../../../../services/inventory/jobWorkBill/jobWorkBillService';

/**
 * The debit note's actions. Every one returns the bill, which the workspace adopts — so unsaved line or header
 * edits are saved first, or adopting the server's copy would silently drop them.
 */
export default function useJwbDeductions({ bill, run, openReason, isDirty, handleSave }) {
  const [editing, setEditing] = useState(null);

  const act = useCallback(async (key, fn, successMsg) => {
    if (isDirty && !(await handleSave(key, { quiet: true }))) return null;
    return run(key, fn, successMsg);
  }, [isDirty, handleSave, run]);

  const onPropose = useCallback(() => act('propose', () => proposeJobWorkDeductions(bill.id, bill.version), 'Deductions proposed'), [act, bill]);
  const onConfirm = useCallback((d) => act(`confirm-${d.id}`, () => setJobWorkDeductionStatus(bill.id, d.id, 'CONFIRMED'), 'Deduction confirmed'), [act, bill]);
  const onDelete = useCallback((d) => act(`delete-${d.id}`, () => deleteJobWorkDeduction(bill.id, d.id), 'Deduction removed'), [act, bill]);
  const onDrop = useCallback(async (d) => {
    if (isDirty && !(await handleSave(`drop-${d.id}`, { quiet: true }))) return;
    openReason({
      key: `drop-${d.id}`, title: 'Drop this deduction', label: 'Why it is dropped', minLength: 5, successMsg: 'Deduction dropped',
      onSubmit: (t) => setJobWorkDeductionStatus(bill.id, d.id, 'DROPPED', t),
    });
  }, [openReason, isDirty, handleSave, bill]);

  const onSave = useCallback(async (values) => {
    const next = await act(values.id ? `edit-${values.id}` : 'add', () => saveJobWorkDeduction(bill.id, values), 'Deduction saved');
    if (next) setEditing(null);
  }, [act, bill]);

  return {
    tableProps: {
      onPropose, onConfirm, onDrop, onDelete,
      onAdd: () => setEditing({ deduction: null }),
      onEdit: (d) => setEditing({ deduction: d }),
    },
    editorProps: { open: Boolean(editing), deduction: editing?.deduction ?? null, onCancel: () => setEditing(null), onSave },
  };
}
