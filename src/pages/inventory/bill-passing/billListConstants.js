import { BILL_QUICK_FILTER, BILL_PASSING_STATUS_LABEL } from '../../../utils/billPassingConstants';
import { BILL_SOURCES } from '../../../utils/jobWorkBillConstants';

export const LIST_VIEW = { BILLS: 'Bills', LINES: 'Lines' };

export const SOURCE_OPTIONS = [{ value: 'ALL', label: 'All' }, ...BILL_SOURCES.map((s) => ({ value: s.value, label: s.label }))];

export const QUICK_FILTER_OPTIONS = [
  { label: 'Pending', value: BILL_QUICK_FILTER.PENDING },
  { label: 'Passed', value: BILL_QUICK_FILTER.PASSED },
  { label: 'On Hold', value: BILL_QUICK_FILTER.ON_HOLD },
  { label: 'Rejected', value: BILL_QUICK_FILTER.REJECTED },
  { label: 'All', value: BILL_QUICK_FILTER.ALL },
];

export const STATUS_OPTIONS = Object.entries(BILL_PASSING_STATUS_LABEL).map(([value, label]) => ({ value, label }));

export const isQuickFilter = (value) => QUICK_FILTER_OPTIONS.some((o) => o.value === value);
