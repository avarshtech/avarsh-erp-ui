/**
 * ApprovalReasonDialog action config for the requirement lifecycle. No approval exists on
 * these documents: Close is the only confirmed transition after Submit — a submitted
 * requirement is otherwise edited in place until a PO against it is placed.
 */
export const CLOSE_ACTION = {
  key: 'close',
  label: 'Close',
  title: 'Close requirement',
  subtitle: 'Releases the unconsumed balance. The PO module can no longer use this requirement.',
  color: 'var(--error-color, #ff4d4f)',
  btnText: 'Close Requirement',
  placeholder: 'Why is this requirement being closed? (e.g. order short-shipped, process dropped)',
  requiresReason: true,
  minChars: 10,
};
