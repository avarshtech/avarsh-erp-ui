import { Button, Checkbox, Input, InputNumber, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import RecordLink from '../../../components/RecordLink';
import FinishingStatusTag from './FinishingStatusTag';

export const garmentCheckNo = (id) => `GC-${String(id).padStart(3, '0')}`;

/** Garment check rows: one per colour and size of the process issue, checked qty capped at what was sent. */
export const buildGarmentCheckRowColumns = ({ setRow, removeRow, qualityOptions, actionOptions }) => [
  { title: 'Colour', dataIndex: 'color', width: 120 },
  { title: 'Size', dataIndex: 'size', width: 70, align: 'center' },
  { title: 'Issued', dataIndex: 'issuedQty', width: 80, align: 'right' },
  {
    title: 'Checked Qty', dataIndex: 'checkedQty', width: 115, align: 'center',
    render: (v, r, idx) => (
      <InputNumber size="small" name={`checkedQty-${idx}`} aria-label={`Checked quantity ${r.color} ${r.size}`}
        min={0} max={r.issuedQty} precision={0} value={v} style={{ width: 90 }}
        onChange={(val) => setRow(idx, 'checkedQty', val)} />
    ),
  },
  {
    title: 'Verified', dataIndex: 'verified', width: 80, align: 'center',
    render: (v, _, idx) => <Checkbox aria-label="Verified" checked={v} onChange={(e) => setRow(idx, 'verified', e.target.checked)} />,
  },
  {
    title: 'Process Quality', dataIndex: 'quality', width: 170,
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
      <Button size="small" type="text" danger aria-label="Remove row" icon={<DeleteOutlined />} onClick={() => removeRow(idx)} />
    ),
  },
];

/** The Garment Checks list on the External Process tab. */
export const buildGarmentCheckListColumns = (open) => [
  {
    title: 'Check #', dataIndex: 'id', width: 90, fixed: 'left', align: 'center',
    render: (v) => <RecordLink text={garmentCheckNo(v)} onClick={() => open(v)} />,
  },
  { title: 'Process PO #', dataIndex: 'issueNo', width: 160, render: (v) => <code>{v}</code> },
  { title: 'Process', dataIndex: 'processName', width: 130, render: (v) => <Tag color="geekblue">{v}</Tag> },
  { title: 'Work Order', dataIndex: 'workOrderNo', width: 150 },
  { title: 'Style', dataIndex: 'styleNo', width: 130 },
  { title: 'Vendor', dataIndex: 'vendorName', width: 170, ellipsis: true, render: (v) => v || '—' },
  { title: 'Date', dataIndex: 'checkDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
  { title: 'Checked Qty', dataIndex: 'totalCheckedQty', width: 110, align: 'right', render: (v) => <strong>{v}</strong> },
  {
    title: 'Verified', key: 'verified', width: 100, align: 'center',
    render: (_, r) => `${r.verifiedRowCount} / ${r.rows.length}`,
  },
  { title: 'Status', dataIndex: 'status', width: 110, render: (v) => <FinishingStatusTag status={v} /> },
  {
    title: 'Actions', key: 'act', width: 90, fixed: 'right', align: 'center',
    render: (_, r) => <ActionButton action="edit" size="small" aria-label={`Edit ${garmentCheckNo(r.id)}`} onClick={() => open(r.id)} />,
  },
];
