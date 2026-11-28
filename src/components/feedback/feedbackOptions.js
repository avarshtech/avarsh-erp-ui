/** Choices and defaults of the report form. */

export const ISSUE_TYPES = [
  { value: 'BUG', label: 'Bug' },
  { value: 'ENHANCEMENT', label: 'Enhancement' },
  { value: 'SUGGESTION', label: 'Suggestion' },
];

export const PRIORITIES = [
  { value: 'CRITICAL', label: 'Critical — work is blocked' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' },
];

/** The three everyday environments first; Local and Test are for developers and automated runs. */
export const ENVIRONMENT_OPTIONS = [
  { value: 'DEV', label: 'Development' },
  { value: 'QA', label: 'QA' },
  { value: 'PROD', label: 'Production' },
  { value: 'LOCAL', label: 'Local' },
  { value: 'TEST', label: 'Test / automation' },
];

export const ENVIRONMENT_COLORS = { PROD: 'red', QA: 'orange', DEV: 'blue', LOCAL: 'default', TEST: 'purple' };

export const INITIAL_VALUES ={ type: 'BUG', priority: 'MEDIUM', title: '', description: '' };

export const PLACEHOLDERS = {
  BUG: {
    title: 'e.g. PO total does not include tax',
    description: 'What did you do, what happened, and what did you expect to happen?',
  },
  ENHANCEMENT: {
    title: 'e.g. Filter GRNs by supplier',
    description: 'What would you like to be able to do, and why would it help?',
  },
  SUGGESTION: {
    title: 'e.g. Show the buyer name on the order list',
    description: 'Tell us your idea.',
  },
};
