import { ASSET_CONDITION, ASSET_STATUS, STATUS_REASON, toOptions } from '../../utils/assetConstants';

const STATUS_OPTIONS = toOptions(ASSET_STATUS);
const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);
const REASON_OPTIONS = Object.entries(STATUS_REASON).map(([value, label]) => ({ value, label }));

/** The cover questions people actually ask, as windows rather than dates. */
const EXPIRY_OPTIONS = [
  { value: 0, label: 'Already lapsed' },
  { value: 30, label: 'Lapsing in 30 days' },
  { value: 90, label: 'Lapsing in 90 days' },
];

/**
 * The two things the dashboard counts and somebody then has to find.
 *
 * One select rather than two checkboxes: they are alternative questions about
 * the same machines, and nobody asks both at once.
 */
export const ATTENTION = {
  MAINT_OVERDUE: { label: 'Service overdue', filters: { maintenanceOverdue: true, notVerifiedInDays: undefined } },
  UNVERIFIED_6M: { label: 'Not counted in 6 months', filters: { maintenanceOverdue: undefined, notVerifiedInDays: 180 } },
};

const ATTENTION_OPTIONS = Object.entries(ATTENTION).map(([value, m]) => ({ value, label: m.label }));

/** Which option the current filters amount to, so a URL-seeded filter shows in the bar. */
export const attentionValueOf = (filters) => {
  if (filters.maintenanceOverdue) return 'MAINT_OVERDUE';
  if (filters.notVerifiedInDays) return 'UNVERIFIED_6M';
  return undefined;
};

const select = (list, key, placeholder, options) => ({
  type: 'select',
  span: { xs: 12, sm: 8, md: 5, lg: 4 },
  props: {
    placeholder,
    value: list.filters[key],
    onChange: list.setFilter(key),
    options,
    allowClear: true,
    showSearch: true,
    optionFilterProp: 'label',
    'aria-label': placeholder,
  },
});

/**
 * The register's filter bar.
 *
 * Extracted from the page for the same reason the columns were: the page is a
 * layout, and seven filter definitions inline left no room to read it.
 */
export const buildAssetListFilters = ({ list, lookups, onAttentionChange }) => [
  select(list, 'categoryId', 'Category', lookups.options.categories),
  select(list, 'unitId', 'Unit', lookups.options.units),
  select(list, 'departmentId', 'Department', lookups.departmentsOf(list.filters.unitId)),
  select(list, 'status', 'Status', STATUS_OPTIONS),
  select(list, 'condition', 'Condition', CONDITION_OPTIONS),
  // "Which machines are standing for want of an operator" is a question about
  // the reason, not the status - both read Idle.
  select(list, 'statusReasonCode', 'Reason', REASON_OPTIONS),
  select(list, 'expiringInDays', 'Warranty / AMC', EXPIRY_OPTIONS),
  {
    type: 'select',
    span: { xs: 12, sm: 8, md: 5, lg: 4 },
    props: {
      placeholder: 'Needs attention',
      value: attentionValueOf(list.filters),
      onChange: onAttentionChange,
      options: ATTENTION_OPTIONS,
      allowClear: true,
      'aria-label': 'Needs attention',
    },
  },
];
