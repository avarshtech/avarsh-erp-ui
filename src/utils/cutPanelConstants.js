/**
 * Cut Panel Requirement (CPR) — constants and PRD message texts.
 * PRD: Avarsh_ERP_Cut_Panel_Generation_PRD_v1.0, adjusted for the confirmed decision
 * that there is NO approval step: Submit releases the requirement to the PO module,
 * Reopen (nothing consumed) returns it to Draft, Close ends it.
 */
export const CPR_MODULE_ID = 'cut-panel';
export const CPR_PREFIX = 'CPR';
export const CPR_PROCESS_CATEGORY = 'Cut Panel';
export const OTHER_PROCESS_NAME = 'Other';
export const NO_PROCESS_LABEL = 'No cut-panel process';

/** A single "+ Add to Grid" above this many lines asks first (PRD §20). */
export const EXPANSION_WARN_LIMIT = 200;

/** Blocking validations (PRD §12.1). VAL-09 is dropped — there is no approver. */
export const CPR_VAL = {
  VAL_01: 'Select an order to continue.',
  VAL_02: 'This order has no approved BOM. Approve the BOM before creating a cut panel requirement.',
  VAL_03: 'Select fabric, colour, panel and at least one process.',
  VAL_04: 'Add at least one cut panel requirement line before submitting.',
  VAL_05: 'Enter a quantity for every size, or remove the line.',
  VAL_06: 'Process sequence must start at 1 and run continuously without duplicates.',
  VAL_07: 'Quantity and allowance must be positive numbers.',
  VAL_08: 'This fabric, colour, panel and process combination already exists on this requirement.',
  VAL_10: 'This requirement is submitted and cannot be edited. Reopen it first (only possible while no PO has used it).',
  OTHER_NAME: 'Name the "Other" process before adding it.',
  REASON: 'Record a reason on every line whose quantity or allowance differs from the calculated value.',
};

/** Non-blocking warnings (PRD §12.2) — never block, but WRN-01/02/04 need a reason. */
export const CPR_WRN = {
  WRN_01: 'Entered quantity exceeds the calculated quantity',
  WRN_02: 'Entered quantity is below the calculated quantity',
  WRN_03: 'Colours with no cut-panel process will be reported as "No cut-panel process".',
  WRN_04: 'Allowance differs from the order allowance',
  WRN_05: 'The BOM has been revised since this requirement was created. It is not updated automatically.',
  WRN_06: 'The order quantity has changed since this requirement was created.',
  WRN_07: 'This order already has cut panel requirements:',
};
