import { DatePicker, InputNumber, Select, Switch, Tag } from 'antd';
import {
  ASSET_CONDITION, ASSET_STATUS, TRANSFER_STATUS, VERIFICATION_RESULT, toOptions,
} from '../../../utils/assetConstants';

const { RangePicker } = DatePicker;

const opts = (map) => Object.entries(map).map(([value, m]) => ({
  value, label: typeof m === 'string' ? m : m.label,
}));

const pick = (width, placeholder, key, v, set, options) => (
  <Select
    allowClear
    showSearch
    optionFilterProp="label"
    style={{ width }}
    placeholder={placeholder}
    value={v[key]}
    onChange={set(key)}
    options={options}
  />
);

/**
 * The filter widgets a report declares (PRD section M).
 *
 * The server says which filters each report takes, so the bar is drawn from
 * that list rather than from a copy of the table kept in the browser. Add a
 * filter to a report on the server and it appears here.
 *
 * Unit and category apply to all nine and are drawn by the page itself, so
 * neither is in any report's own list.
 *
 * Enum options that already have a server lookup - disposal methods - come
 * through `extra` rather than being mirrored here. One copy of an enum in the
 * browser is a liability; two is a bug waiting for somebody to add a value.
 */
const WIDGETS = {
  status: (v, set) => pick(160, 'Status', 'status', v, set, toOptions(ASSET_STATUS)),
  condition: (v, set) => pick(150, 'Condition', 'condition', v, set, toOptions(ASSET_CONDITION)),
  transferStatus: (v, set) => pick(170, 'Transfer status', 'transferStatus', v, set, opts(TRANSFER_STATUS)),
  result: (v, set) => pick(185, 'Result', 'result', v, set, opts(VERIFICATION_RESULT)),

  method: (v, set, extra) => pick(170, 'Method', 'method', v, set, extra.methods ?? []),
  verificationRunId: (v, set, extra) => pick(220, 'Verification run', 'verificationRunId', v, set, extra.runs ?? []),
  // The server returns at most 25 employees per search, so this one asks the
  // server as you type instead of filtering a stale first 25 in the browser.
  employeeId: (v, set, extra) => (
    <Select
      allowClear
      showSearch
      filterOption={false}
      style={{ width: 210 }}
      placeholder="Search by name or employee no."
      value={v.employeeId}
      onChange={set('employeeId')}
      onSearch={extra.onEmployeeSearch}
      options={extra.employees ?? []}
      notFoundContent={null}
    />
  ),
  departmentId: (v, set, extra) => pick(180, 'Department', 'departmentId', v, set, extra.departments ?? []),
  fromUnitId: (v, set, extra) => pick(150, 'From unit', 'fromUnitId', v, set, extra.units ?? []),
  toUnitId: (v, set, extra) => pick(150, 'To unit', 'toUnitId', v, set, extra.units ?? []),

  assignmentState: (v, set) => pick(160, 'Open / returned', 'assignmentState', v, set, [
    { value: 'OPEN', label: 'Still held' },
    { value: 'RETURNED', label: 'Returned' },
  ]),

  withinDays: (v, set) => (
    <span>
      Within
      <InputNumber
        min={1}
        max={730}
        style={{ width: 90, margin: '0 6px' }}
        value={v.withinDays ?? 30}
        onChange={set('withinDays')}
      />
      days
    </span>
  ),

  dateRange: (v, set, extra) => (
    <RangePicker format="DD-MM-YYYY" value={extra.range} onChange={extra.onRange} allowEmpty={[true, true]} />
  ),

  includeDisposed: (v, set) => toggle('Include disposed', v.includeDisposed, set('includeDisposed')),
  includeOverdue: (v, set) => toggle('Include overdue', v.includeOverdue, set('includeOverdue')),
  includeExpired: (v, set) => toggle('Include expired', v.includeExpired, set('includeExpired')),
};

const toggle = (label, checked, onChange) => (
  <span>
    <Switch size="small" checked={!!checked} onChange={onChange} style={{ marginRight: 6 }} />
    {label}
  </span>
);

/**
 * One filter's widget. A filter the server names that this build has no widget
 * for is shown as a tag rather than skipped silently, so the gap is visible
 * instead of looking like the filter does not exist.
 */
export const widgetFor = (key, values, set, extra) => {
  const render = WIDGETS[key];
  if (!render) return <Tag color="orange">{`${key} (not supported in this version)`}</Tag>;
  return render(values, set, extra);
};
