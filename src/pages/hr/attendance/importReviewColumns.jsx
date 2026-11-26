import { Select, InputNumber, TimePicker, Tag, Tooltip } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ATTENDANCE_STATUS } from '../../../utils/hrConstants';

const TIME = 'HH:mm';

const STATUS_OPTIONS = ATTENDANCE_STATUS.map((s) => ({ value: s.value, label: s.label }));
const SESSION_OPTIONS = [
  { value: 'FIRST_HALF', label: 'First half' },
  { value: 'SECOND_HALF', label: 'Second half' },
];

/** Statuses that are a day at work, so punches and overtime mean something on them. */
const WORKED = new Set(['PRESENT', 'HALF_DAY', 'ON_DUTY']);

/**
 * Hours between the punches, less the break - the same arithmetic the server does.
 *
 * Recomputed as somebody edits a time, so the figure they are correcting towards moves
 * with them. The server works it out again on commit from the employee's own shift, so
 * this is the hint; that is the record. The break is not known here, which is why a
 * row's hours can tighten by the break once it is saved.
 */
export const hoursBetween = (inTime, outTime) => {
  if (!inTime || !outTime) return null;
  const start = dayjs(inTime, TIME);
  const end = dayjs(outTime, TIME);
  if (!start.isValid() || !end.isValid()) return null;
  let minutes = end.diff(start, 'minute');
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 100) / 100;
};

/**
 * The rows about to be imported, as a grid somebody can correct in place.
 *
 * <p>The machine's report is the floor's record and it is not always right: a punch
 * missed on the way out, a day marked absent that was leave, a shift that reads as
 * nineteen hours. Those were readable before and not fixable - the only way through
 * was to edit the file and upload it again, which meant leaving the screen that had
 * just told you what was wrong.</p>
 *
 * <p>Everything a correction needs is editable here: the status, both punches, the
 * half-day session, the leave type and overtime. Nothing is saved until Import, and
 * the server validates the edited rows again on the way in - this grid is for getting
 * the month right, not for getting past the checks.</p>
 *
 * @param onEdit   (index, patch) - applies the change to the row
 * @param issuesBy row index to the issues raised against it
 */
export const importReviewColumns = ({ editable, onEdit, leaveTypes, issuesBy }) => {
  const cell = (index, field) => (value) => onEdit(index, { [field]: value });

  const time = (index, field) => (_, record, rowIndex) => {
    const value = record[field];
    if (!editable) return value || '—';
    return (
      <TimePicker
        value={value ? dayjs(value, TIME) : null}
        onChange={(picked) => cell(rowIndex, field)(picked ? picked.format(TIME) : null)}
        format={TIME}
        minuteStep={1}
        allowClear
        size="small"
        style={{ width: '100%' }}
        placeholder="--:--"
      />
    );
  };

  return [
    {
      // The flag goes on the row, not only in the list above: a month is three
      // hundred rows and scrolling for the one the list named is the slow part.
      title: '',
      key: 'flag',
      width: 40,
      fixed: 'left',
      render: (_, __, rowIndex) => {
        const issues = issuesBy.get(rowIndex);
        if (!issues?.length) return null;
        return (
          <Tooltip title={issues.map((i) => i.message).join(' · ')}>
            <WarningOutlined style={{ color: '#fa8c16' }} />
          </Tooltip>
        );
      },
    },
    { title: 'Emp No', dataIndex: 'employeeNo', key: 'employeeNo', width: 100, fixed: 'left' },
    { title: 'Name', dataIndex: 'employeeName', key: 'employeeName', width: 170, fixed: 'left' },
    {
      title: 'Date',
      dataIndex: 'attendanceDate',
      key: 'attendanceDate',
      width: 120,
      render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value, record, rowIndex) => {
        if (!editable) {
          const s = ATTENDANCE_STATUS.find((o) => o.value === value);
          return s ? <Tag color={s.color}>{s.label}</Tag> : value;
        }
        return (
          <Select
            value={value}
            onChange={(next) => onEdit(rowIndex, {
              status: next,
              // A status that is not a half day cannot keep a session, and one that
              // is not leave cannot keep a leave type - the server refuses both.
              halfDaySession: next === 'HALF_DAY' ? record.halfDaySession : null,
              ...(next === 'LEAVE' || next === 'HALF_DAY'
                ? {} : { leaveTypeId: null, leaveTypeName: null }),
            })}
            options={STATUS_OPTIONS}
            size="small"
            style={{ width: '100%' }}
          />
        );
      },
    },
    {
      title: 'Session',
      dataIndex: 'halfDaySession',
      key: 'halfDaySession',
      width: 130,
      render: (value, record, rowIndex) => {
        if (!editable) return value || '—';
        return (
          <Select
            value={value}
            onChange={cell(rowIndex, 'halfDaySession')}
            options={SESSION_OPTIONS}
            disabled={record.status !== 'HALF_DAY'}
            allowClear
            size="small"
            style={{ width: '100%' }}
            placeholder="—"
          />
        );
      },
    },
    {
      title: 'Leave Type',
      dataIndex: 'leaveTypeId',
      key: 'leaveTypeId',
      width: 150,
      render: (value, record, rowIndex) => {
        if (!editable) return record.leaveTypeName || '—';
        return (
          <Select
            value={value}
            onChange={(id) => onEdit(rowIndex, {
              leaveTypeId: id ?? null,
              leaveTypeName: leaveTypes.find((t) => t.id === id)?.name ?? null,
            })}
            options={leaveTypes.map((t) => ({ value: t.id, label: `${t.code} - ${t.name}` }))}
            disabled={record.status !== 'LEAVE' && record.status !== 'HALF_DAY'}
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            style={{ width: '100%' }}
            placeholder="—"
          />
        );
      },
    },
    { title: 'In', dataIndex: 'inTime', key: 'inTime', width: 110, render: time(null, 'inTime') },
    { title: 'Out', dataIndex: 'outTime', key: 'outTime', width: 110, render: time(null, 'outTime') },
    {
      title: 'Hours',
      dataIndex: 'totalHours',
      key: 'totalHours',
      width: 80,
      align: 'right',
      // Never editable: it is the gap between the two punches, and a third number
      // that can disagree with them is one more thing to reconcile.
      render: (v) => (v == null ? '—' : Number(v)),
    },
    {
      title: 'OT',
      dataIndex: 'otHours',
      key: 'otHours',
      width: 90,
      align: 'right',
      render: (value, record, rowIndex) => {
        if (!editable) return value ?? 0;
        return (
          <InputNumber
            value={value ?? 0}
            onChange={(next) => cell(rowIndex, 'otHours')(next ?? 0)}
            min={0}
            max={12}
            step={0.5}
            disabled={!WORKED.has(record.status)}
            size="small"
            style={{ width: '100%' }}
          />
        );
      },
    },
  ];
};
