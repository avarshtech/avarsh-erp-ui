import { memo, useMemo } from 'react';
import {
  InputNumber, Select, Table, Typography,
} from 'antd';
import { REJECT_SOURCE_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';
import { fmtQty } from '../jwFormat';

const { Text } = Typography;
const SOURCES = toOptions(REJECT_SOURCE_LABEL);

/**
 * Long-format receipt lines: colour, size, plan at the stage, already received, then good / alter /
 * rejected / reject source. "Alter" pieces are handed back to the vendor for repair and do not count.
 */
const ReceiptGrid = memo(function ReceiptGrid({ rows, onChange, overColours = [] }) {
  const columns = useMemo(() => [
    { title: 'Colour', dataIndex: 'colour', width: 100, render: (c) => <Text strong type={overColours.includes(c) ? 'danger' : undefined}>{c}</Text> },
    { title: 'Size', dataIndex: 'size', width: 70 },
    { title: 'Plan', dataIndex: 'plan', width: 80, align: 'right', render: fmtQty },
    { title: 'Received', dataIndex: 'already', width: 90, align: 'right', render: (v) => <Text type="secondary">{fmtQty(v)}</Text> },
    ...['good', 'alter', 'rejected'].map((k) => ({
      title: { good: 'Good', alter: 'Alter (back to vendor)', rejected: 'Rejected (kept)' }[k], key: k, width: k === 'alter' ? 150 : 110,
      render: (_, r, i) => (
        <InputNumber name={`rcpt-${k}-${i}`} size="small" min={0} precision={0} controls={false} value={r[k]}
          onChange={(v) => onChange(i, { [k]: v ?? 0 })} style={{ width: '100%' }} />
      ),
    })),
    {
      title: 'Reject source', key: 'src', width: 170,
      render: (_, r, i) => (r.rejected > 0 ? (
        <Select name={`rcpt-src-${i}`} size="small" style={{ width: '100%' }} options={SOURCES} value={r.rejectSource}
          placeholder="Whose fault?" onChange={(v) => onChange(i, { rejectSource: v })} />
      ) : <Text type="secondary">—</Text>),
    },
  ], [onChange, overColours]);
  return (
    <Table rowKey={(r) => `${r.colour}|${r.size}`} size="small" pagination={false} columns={columns} dataSource={rows}
      scroll={{ x: 880, y: 360 }} />
  );
});

export default ReceiptGrid;
