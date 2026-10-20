import { memo } from 'react';
import {
  Button, InputNumber, Select, Table, Typography,
} from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { DAMAGE_SOURCE_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';

const { Text } = Typography;
const SOURCES = toOptions(DAMAGE_SOURCE_LABEL);

/** What arrived: colour × size × the stage actually reached, good or damaged (with whose fault). */
const ReturnLinesTable = memo(function ReturnLinesTable({
  rows, colours, sizes, stages, badColours = [], onChange, onRemove, onAdd,
}) {
  const num = (k, r, i) => (
    <InputNumber name={`ret-${k}-${i}`} size="small" min={0} precision={0} controls={false} style={{ width: '100%' }}
      value={r[k]} onChange={(v) => onChange(i, { [k]: v ?? 0 })} />
  );
  const pick = (k, r, i, options, extra = {}) => (
    <Select name={`ret-${k}-${i}`} size="small" style={{ width: '100%' }} value={r[k]} options={options}
      onChange={(v) => onChange(i, { [k]: v })} {...extra} />
  );
  const columns = [
    { title: 'Colour', key: 'colour', width: 120, render: (_, r, i) => pick('colour', r, i, colours.map((c) => ({ value: c, label: c })), { status: badColours.includes(r.colour) ? 'error' : undefined }) },
    { title: 'Size', key: 'size', width: 90, render: (_, r, i) => pick('size', r, i, sizes.map((s) => ({ value: s, label: s }))) },
    { title: 'Stage reached', key: 'stage', width: 140, render: (_, r, i) => pick('stage', r, i, stages) },
    { title: 'Good', key: 'good', width: 90, render: (_, r, i) => num('good', r, i) },
    { title: 'Damaged', key: 'damaged', width: 90, render: (_, r, i) => num('damaged', r, i) },
    {
      title: 'Damage source', key: 'src', width: 140,
      render: (_, r, i) => (r.damaged > 0 ? pick('damageSource', r, i, SOURCES, { placeholder: 'Whose fault?' }) : <Text type="secondary">—</Text>),
    },
    { title: '', key: 'x', width: 44, render: (_, r, i) => <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label="Remove line" onClick={() => onRemove(i)} /> },
  ];
  return (
    <Table
      rowKey="_k"
      size="small"
      pagination={false}
      columns={columns}
      dataSource={rows}
      scroll={{ x: 714, y: 380 }}
      footer={() => <Button size="small" icon={<PlusOutlined />} onClick={onAdd}>Add line</Button>}
    />
  );
});

export default ReturnLinesTable;
