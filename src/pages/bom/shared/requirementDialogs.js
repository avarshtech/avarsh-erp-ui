/**
 * ApprovalReasonDialog action configs for the requirement lifecycle actions.
 * No approval exists on these documents — Close and Reopen are the only confirmed
 * transitions after Submit.
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

export const REOPEN_ACTION = {
  key: 'reopen',
  label: 'Reopen',
  title: 'Reopen requirement',
  subtitle: 'Returns it to Draft and withdraws it from the PO module until it is submitted again.',
  color: 'var(--warning-color, #faad14)',
  btnText: 'Reopen',
  requiresReason: false,
};
