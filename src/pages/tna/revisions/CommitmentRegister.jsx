import { memo } from 'react';
import { Alert, Table, Tag } from 'antd';
import { fmtDate, fmtDateTime, fmtText } from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';

const columns = [
  { title: 'Line', dataIndex: 'lineNo', width: 50 },
  { title: 'Commitment', dataIndex: 'type', width: 120, render: (v) => <Tag color={v === 'ORIGINAL' ? 'default' : 'purple'}>{v === 'ORIGINAL' ? 'Original' : 'Revised'}</Tag> },
  { title: 'Date', dataIndex: 'date', width: 104, render: (v) => <strong>{fmtDate(v)}</strong> },
  { title: 'Set on', dataIndex: 'setOn', width: 140, render: fmtDateTime },
  { title: 'Source', dataIndex: 'sourceRecord', width: 130 },
  { title: 'By', dataIndex: 'actor', width: 180, ellipsis: true },
  { title: 'Reason', dataIndex: 'reason', width: 220, ellipsis: true, render: fmtText },
];

/**
 * FR-5.9 — the original and every revised dispatch commitment, kept for the life of the order.
 * A revision moves no activity and never appears in a delay figure (BR-12, BR-13).
 */
const CommitmentRegister = memo(function CommitmentRegister({ data }) {
  const revised = (data?.lines || []).filter((l) => l.movement);
  return (
    <div>
      <Table
        rowKey={(r) => `${r.lineId}-${r.type}-${r.setOn}`}
        size="small"
        bordered
        columns={columns}
        dataSource={data?.register || []}
        pagination={false}
        scroll={{ x: 900 }}
        title={() => <strong>Commitment register</strong>}
      />
      {revised.map((l) => (
        <Alert
          key={l.lineId}
          type="warning"
          showIcon
          style={{ marginTop: 10 }}
          title={<span>Line {l.lineNo}: the <DeltaTag value={l.movement} tone="movement" /> movement is recorded as a commitment revision. It moved no activity and is never reported as shipment delay.</span>}
        />
      ))}
    </div>
  );
});

export default CommitmentRegister;
