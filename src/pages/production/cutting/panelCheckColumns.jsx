import { Button, Checkbox, Input, InputNumber } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { FormSelect } from '../../../components/form';

/**
 * Bundle-range Verification grid of a panel check: one row per range of returned
 * panels — how many it held, whether it was checked, and what was found.
 */
export const buildPanelCheckColumns = ({ setRow, removeRow, qualityOptions, actionOptions }) => [
  { title: 'Size', dataIndex: 'size', width: 80, align: 'center' },
  { title: 'Order Range', dataIndex: 'orderRange', width: 110, align: 'center', render: (v) => <code>{v}</code> },
  {
    title: 'Bundle Range', dataIndex: 'bundleRange', width: 130,
    render: (v, _, idx) => (
      <Input size="small" name={`bundleRange-${idx}`} aria-label="Bundle range" value={v}
        onChange={(e) => setRow(idx, 'bundleRange', e.target.value)} />
    ),
  },
  {
    title: 'Qty', dataIndex: 'qty', width: 100, align: 'center',
    render: (v, _, idx) => (
      <InputNumber size="small" name={`qty-${idx}`} aria-label="Panel quantity" min={0} precision={0}
        value={v} style={{ width: 85 }} onChange={(val) => setRow(idx, 'qty', val)} />
    ),
  },
  {
    title: 'Verified', dataIndex: 'verified', width: 80, align: 'center',
    render: (v, _, idx) => <Checkbox aria-label="Verified" checked={v} onChange={(e) => setRow(idx, 'verified', e.target.checked)} />,
  },
  {
    title: 'Print / Process Quality', dataIndex: 'quality', width: 170,
    render: (v, _, idx) => (
      <FormSelect size="small" value={v} style={{ width: 155 }} placeholder="Quality"
        options={qualityOptions} onChange={(val) => setRow(idx, 'quality', val)} />
    ),
  },
  {
    title: 'Comments', dataIndex: 'comments', width: 180,
    render: (v, _, idx) => (
      <Input size="small" name={`comments-${idx}`} aria-label="Comments" value={v}
        onChange={(e) => setRow(idx, 'comments', e.target.value)} />
    ),
  },
  {
    title: 'Corrective Action', dataIndex: 'action', width: 200,
    render: (v, _, idx) => (
      <FormSelect size="small" value={v} style={{ width: 185 }} placeholder="Action"
        options={actionOptions} onChange={(val) => setRow(idx, 'action', val)} />
    ),
  },
  {
    title: 'QC Sign', dataIndex: 'qcSign', width: 130,
    render: (v, _, idx) => (
      <Input size="small" name={`qcSign-${idx}`} aria-label="QC sign" value={v} placeholder="Inspector"
        onChange={(e) => setRow(idx, 'qcSign', e.target.value)} />
    ),
  },
  {
    title: '', key: 'del', width: 46, align: 'center',
    render: (_, __, idx) => (
      <Button size="small" type="text" danger aria-label="Remove range" icon={<DeleteOutlined />} onClick={() => removeRow(idx)} />
    ),
  },
];
