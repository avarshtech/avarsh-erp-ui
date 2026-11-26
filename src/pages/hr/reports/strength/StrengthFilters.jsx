import { memo } from 'react';
import { Card, DatePicker, Select, Space, Typography } from 'antd';
import DateInput from '../../../../components/DateInput';
import { ActionButton } from '../../../../components/buttons';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const field = (label, control) => (
  <Space orientation="vertical" size={2}>
    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
    {control}
  </Space>
);

/**
 * The report's questions: which day, which unit, who counts as a new joiner, and
 * which designation gets the unit-wise summary. Every change re-runs the report -
 * it is two queries - so there is no Run button to forget.
 */
const StrengthFilters = memo(function StrengthFilters({
  date, onDate, unitId, onUnit, unitOptions, joined, onJoined,
  focus, onFocus, focusOptions, onExport, onPrint, busy, disabled,
}) {
  return (
    <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '14px 20px' } }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <Space size={[16, 12]} wrap align="end">
          {field('Report date', (
            <DateInput value={date} onChange={(d) => d && onDate(d)} allowClear={false} style={{ width: 150 }} />
          ))}
          {field('Unit', (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="All units"
              style={{ width: 180 }}
              value={unitId}
              onChange={onUnit}
              options={unitOptions}
            />
          ))}
          {field('New joiners - joined between', (
            <RangePicker
              format="DD-MM-YYYY"
              value={joined}
              onChange={(range) => range?.[0] && range?.[1] && onJoined(range)}
              allowClear={false}
              presets={[
                { label: 'Last 7 days', value: [date.subtract(6, 'day'), date] },
                { label: 'Last 30 days', value: [date.subtract(29, 'day'), date] },
                { label: 'This month', value: [date.startOf('month'), date] },
                { label: 'Last 90 days', value: [date.subtract(89, 'day'), date] },
              ]}
            />
          ))}
          {field('Unit-wise summary for', (
            <Select
              showSearch
              optionFilterProp="label"
              style={{ width: 170 }}
              value={focus}
              onChange={onFocus}
              options={focusOptions}
            />
          ))}
        </Space>
        <Space wrap>
          <ActionButton action="download" text="Excel" loading={busy === 'EXCEL'} disabled={disabled} onClick={() => onExport('EXCEL')} />
          <ActionButton action="download" text="PDF" loading={busy === 'PDF'} disabled={disabled} onClick={() => onExport('PDF')} />
          <ActionButton action="print" text="Print" loading={busy === 'PRINT'} disabled={disabled} onClick={onPrint} />
        </Space>
      </div>
    </Card>
  );
});

export default StrengthFilters;
