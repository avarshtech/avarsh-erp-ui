import { memo } from 'react';
import { DatePicker, Input, Select, Space, Switch, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const { Text } = Typography;

/** The filter bar of the requirement selection; `filter` is useGpoRequirementFilter(). */
const GpoRequirementFilters = memo(function GpoRequirementFilters({ filter }) {
  const { f, set, opts } = filter;
  const pick = (key, placeholder, width = 150) => (
    <Select allowClear size="small" name={`gpo-filter-${key}`} aria-label={placeholder} placeholder={placeholder} style={{ width }}
      value={f[key]} onChange={set(key)} options={key === 'status' ? opts.status.map((o) => ({ ...o, label: getRequirementStatusLabel(o.value) })) : opts[key]} />
  );
  return (
    <Space wrap size={8} style={{ marginBottom: 8 }}>
      <Input size="small" name="gpo-filter-q" aria-label="Search requirements" allowClear prefix={<SearchOutlined />} style={{ width: 240 }}
        placeholder="Requirement, order, buyer, style" value={f.q} onChange={(e) => set('q')(e.target.value)} />
      {pick('buyer', 'Buyer')}
      {pick('process', 'Process', 170)}
      {pick('color', 'Colour', 130)}
      {pick('status', 'Status', 150)}
      <DatePicker.RangePicker size="small" name="gpo-filter-submitted" format={DATE_FORMAT} placeholder={['Submitted from', 'to']}
        value={f.submitted} onChange={set('submitted')} style={{ width: 250 }} />
      <Space size={6}>
        <Switch size="small" checked={f.hideFull} onChange={set('hideFull')} aria-label="Hide fully allocated" />
        <Text style={{ fontSize: 12 }}>Hide fully allocated</Text>
      </Space>
    </Space>
  );
});

export default GpoRequirementFilters;
