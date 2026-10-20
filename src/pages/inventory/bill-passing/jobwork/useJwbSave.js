import { useCallback } from 'react';
import { submitJobWorkBill, updateJobWorkBill } from '../../../../services/inventory/jobWorkBill/jobWorkBillService';

/** What the server needs to save the bill: the invoice header and, per line, only what the user keyed. */
const payloadOf = (bill, duplicateOverrideReason) => ({
  vendorInvoiceNo: bill.vendorInvoiceNo, vendorInvoiceDate: bill.vendorInvoiceDate, headerRemarks: bill.headerRemarks,
  otherCharges: bill.otherCharges, invoiceCgst: bill.invoiceCgst, invoiceSgst: bill.invoiceSgst,
  invoiceIgst: bill.invoiceIgst, invoiceRoundOff: bill.invoiceRoundOff,
  lines: bill.lines.map((l) => ({ id: l.id, ...l.keyed })),
  duplicateOverrideReason, version: bill.version,
});

/**
 * Save and Save & Submit for a job-work bill. A DUPLICATE_INVOICE refusal (D9) offers the override with a reason
 * instead of only reporting it. `quiet` drops the "saved" toast when the save is the first half of a submit.
 */
export default function useJwbSave({ bill, run, openReason, confirm }) {
  const handleSave = useCallback((busyKey = 'save', { quiet = false } = {}) => run(
    busyKey,
    () => updateJobWorkBill(bill.id, payloadOf(bill)),
    quiet ? null : 'Bill saved',
    (e) => {
      if (e.response?.data?.error !== 'DUPLICATE_INVOICE') return false;
      openReason({
        key: busyKey,
        title: 'Override the duplicate invoice check?',
        label: 'Why this invoice number is being booked a second time',
        okText: 'Override and save',
        successMsg: quiet ? null : 'Bill saved with a duplicate override',
        onSubmit: (text) => updateJobWorkBill(bill.id, payloadOf(bill, text)),
      });
      return true;
    },
  ), [bill, run, openReason]);

  const handleSubmit = useCallback(() => confirm({
    title: `Submit ${bill.jwbNumber}?`,
    content: 'The bill is saved and goes to the verification queue. Its lines and deductions stay open until it is sent for approval.',
    okText: 'Save & Submit',
    onOk: async () => {
      const saved = await handleSave('submit', { quiet: true });
      if (saved) await run('submit', () => submitJobWorkBill(saved.id, saved.version), 'Bill submitted for verification');
    },
  }), [bill, confirm, handleSave, run]);

  return { handleSave, handleSubmit };
}
