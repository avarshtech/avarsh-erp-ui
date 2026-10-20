import { useState } from 'react';
import {
  App, Button, Card, Col, Popconfirm, Progress, Row, Space, Table, Typography,
} from 'antd';
import { CarOutlined, InboxOutlined } from '@ant-design/icons';
import { cancelReturn } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import {
  DAMAGE_SOURCE_LABEL, PULLBACK_STATUS, RETURN_STATUS, stageLabel,
} from '../../../../utils/jobWorkTracker/constants';
import ReasonModal from '../components/ReasonModal';
import { ReturnStatusTag } from '../components/JwTags';
import { fmtDate, fmtQty, pct } from '../jwFormat';
import { expectedByColour } from './returnRows';

const { Text } = Typography;
const KEY = 'production-job-work';
const sum = (lines, k) => lines.reduce((a, l) => a + (Number(l[k]) || 0), 0);
const LINE_COLUMNS = [
  { title: 'Colour', dataIndex: 'colour' }, { title: 'Size', dataIndex: 'size' },
  { title: 'Stage reached', dataIndex: 'stage', render: stageLabel },
  { title: 'Good', dataIndex: 'good', align: 'right', render: fmtQty }, { title: 'Damaged', dataIndex: 'damaged', align: 'right', render: fmtQty },
  { title: 'Damage source', dataIndex: 'damageSource', render: (s) => DAMAGE_SOURCE_LABEL[s] || '—' },
];

/** Trucks back on the pull-back (any number of trips), progress per colour, and vendor material returns. */
const PullBackReturnsCard = ({ pb, onRecord, onVendorReturn, onChanged }) => {
  const { message } = App.useApp();
  const [cancelling, setCancelling] = useState(null);
  const live = [PULLBACK_STATUS.PENDING_APPROVAL, PULLBACK_STATUS.APPROVED].includes(pb.status);
  const canReceive = hasPermission(KEY, 'receive');
  const canCancel = live && hasPermission(KEY, 'cancel');
  const expected = expectedByColour(pb);

  const drop = async (ret, reason = '') => {
    await cancelReturn(ret.id, { reason });
    message.success(`${ret.prNo} cancelled.`);
    onChanged();
  };
  const columns = [
    { title: 'Return', dataIndex: 'prNo', render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)}</Text></> },
    { title: 'Vendor DC', dataIndex: 'vendorDcNo', render: (v) => v || '—' },
    { title: 'Good', key: 'g', align: 'right', render: (_, r) => fmtQty(sum(r.lines, 'good')) },
    { title: 'Damaged', key: 'd', align: 'right', render: (_, r) => fmtQty(sum(r.lines, 'damaged')) },
    { title: 'Status', dataIndex: 'status', render: (s) => <ReturnStatusTag status={s} /> },
    {
      title: '', key: 'act', width: 150, render: (_, r) => (
        <Space size={4}>
          {r.status === RETURN_STATUS.DRAFT && live && canReceive && <Button size="small" type="link" onClick={() => onRecord(r)}>Edit</Button>}
          {r.status === RETURN_STATUS.DRAFT && canCancel && <Popconfirm title={`Cancel draft ${r.prNo}?`} onConfirm={() => drop(r).catch((e) => toastUnlessHandled(message, e))}><Button size="small" type="link" danger>Cancel</Button></Popconfirm>}
          {r.status === RETURN_STATUS.POSTED && canCancel && <Button size="small" type="link" danger onClick={() => setCancelling(r)}>Cancel</Button>}
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card size="small" title="Goods back" style={{ marginBottom: 12 }}
        extra={live && canReceive && <Button type="primary" size="small" icon={<CarOutlined />} onClick={() => onRecord(null)}>{pb.status === PULLBACK_STATUS.APPROVED ? 'Record return' : 'Draft a return'}</Button>}>
        <Row gutter={[16, 8]} style={{ marginBottom: 12 }}>
          {Object.entries(expected).map(([c, q]) => (
            <Col key={c} xs={24} md={8}>
              <Text>{c}: {fmtQty(pb.returnedByColour[c] || 0)} of {fmtQty(q)} back</Text>
              <Progress percent={pct(pb.returnedByColour[c] || 0, q)} size="small" />
            </Col>
          ))}
        </Row>
        <Table rowKey="id" size="small" pagination={false} columns={columns} dataSource={pb.returns}
          expandable={{ expandedRowRender: (r) => <Table rowKey={(l) => `${l.colour}|${l.size}|${l.stage}`} size="small" pagination={false} columns={LINE_COLUMNS} dataSource={r.lines} /> }}
          locale={{ emptyText: 'Nothing back yet.' }} />
      </Card>
      <Card size="small" title="Fabric, trims and packing back from the vendor"
        extra={pb.status !== PULLBACK_STATUS.CANCELLED && canReceive && <Button size="small" icon={<InboxOutlined />} onClick={onVendorReturn}>Vendor material return</Button>}>
        {pb.vendorReturns.length
          ? pb.vendorReturns.map((v) => <div key={v.id}><Text strong style={{ fontSize: 12 }}>{v.vmrNo}</Text> <Text type="secondary">{fmtDate(v.date)} · DC {v.vendorDcNo} · {v.lines.length} line(s)</Text></div>)
          : <Text type="secondary">None yet. Good material goes back onto the lot it left from; damaged is recorded only.</Text>}
      </Card>
      {cancelling && (
        <ReasonModal title={`Cancel ${cancelling.prNo}`} okText="Cancel return" placeholder="Why is this return being cancelled?"
          onSubmit={(reason) => drop(cancelling, reason)} onClose={() => setCancelling(null)} />
      )}
    </>
  );
};

export default PullBackReturnsCard;
