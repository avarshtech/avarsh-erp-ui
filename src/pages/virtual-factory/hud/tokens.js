/** Colours and wording shared by the panels. */
export const BAND_COLOUR = { good: '#22c55e', watch: '#f59e0b', alert: '#ef4444', none: '#94a3b8' };

export const RISK = {
  'on-track': { color: 'success', label: 'On track' },
  'at-risk': { color: 'warning', label: 'At risk' },
  late: { color: 'error', label: 'Late' },
  done: { color: 'default', label: 'Shipped' },
  unknown: { color: 'default', label: 'No date' },
  inactive: { color: 'default', label: 'Not in work' },
};

export const MACHINE_STATUS = {
  RUNNING: { color: 'success', label: 'Running' },
  IDLE: { color: 'warning', label: 'Idle' },
  DOWN: { color: 'error', label: 'Down' },
  MAINTENANCE: { color: 'processing', label: 'Maintenance' },
};

export const STAGE_LABEL = {
  planning: 'Planning', material: 'Material', cutting: 'Cutting', sewing: 'Sewing',
  finishing: 'Finishing', packing: 'Packing', shipping: 'Shipping',
};
