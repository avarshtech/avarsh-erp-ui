import { memo } from 'react';
import {
  Card, Table, Tag, Tooltip, Typography,
} from 'antd';
import { DOC_TYPE_LABEL, PULLBACK_STATUS, stageLabel } from '../../../../utils/jobWorkTracker/constants';
import { fmtMoney, fmtQty } from '../jwFormat';

const { Text } = Typography;
const KIND_LABEL = { CUT: 'Cutting', SEW: 'Sewing', FIN: 'Finishing', PROCESS: 'Process' };
const sizesText = (sizes) => Object.entries(sizes || {}).map(([s, q]) => `${s} ${q}`).join(' · ') || '—';

const BREAKDOWN_COLUMNS = [
  { title: 'Vendor PO', dataIndex: 'docNo', render: (v, b) => <>{v} <Text type="secondary">({DOC_TYPE_LABEL[b.docType]})</Text></> },
  { title: 'Rate / pc', dataIndex: 'rate', align: 'right', render: fmtMoney },
  { title: 'Share earned', dataIndex: 'sharePct', align: 'right', render: (v) => `${v}%` },
  { title: 'Earns / pc', dataIndex: 'amount', align: 'right', render: fmtMoney },
  { title: '', dataIndex: 'note', render: (v) => <Text type="secondary" style={{ fontSize: 12 }}>{v}</Text> },
];

/** Lines (suggested → requested → approved → settled), what the vendor earns, and what approval holds back on its POs. */
const PullBackPayCard = memo(function PullBackPayCard({ pb }) {
  const per = pb.earnings.perLine;
  const lineColumns = [
    { title: 'Colour', dataIndex: 'colour', width: 100 },
    { title: 'Stage (expected)', dataIndex: 'stage', width: 130, render: stageLabel },
    { title: 'Suggested', dataIndex: 'suggested', align: 'right', width: 90, render: fmtQty },
    { title: 'Requested', dataIndex: 'requested', align: 'right', width: 95, render: fmtQty },
    { title: 'Approved', dataIndex: 'approved', align: 'right', width: 95, render: (v, l) => (v === null ? '—' : <Text type={v < l.requested ? 'warning' : undefined}>{fmtQty(v)}</Text>) },
    { title: 'Back to vendor', dataIndex: 'backToVendor', align: 'right', width: 115, render: (v) => (v ? fmtQty(v) : '—') },
    { title: 'Written off', dataIndex: 'writtenOff', align: 'right', width: 100, render: (v, l) => (v ? <Tooltip title={l.writeOffReason}><Text type="danger">{fmtQty(v)}</Text></Tooltip> : '—') },
    { title: 'Earns / pc', key: 'pp', align: 'right', width: 95, render: (_, l, i) => fmtMoney(per[i]?.perPiece) },
    { title: 'Vendor earns', key: 'amt', align: 'right', width: 110, render: (_, l, i) => fmtMoney(per[i]?.amount) },
  ];
  const withdrawalColumns = [
    { title: 'Vendor PO', dataIndex: 'docNo', width: 190, render: (v, w) => <>{v} <Text type="secondary">({DOC_TYPE_LABEL[w.docType]})</Text></> },
    { title: 'Part', dataIndex: 'kind', width: 90, render: (k) => KIND_LABEL[k] },
    { title: 'Colour', dataIndex: 'colour', width: 90 },
    { title: 'Stage', dataIndex: 'stageLabel', width: 110 },
    { title: 'Qty', dataIndex: 'qty', align: 'right', width: 70, render: fmtQty },
    { title: 'By size', dataIndex: 'sizes', render: sizesText },
    { title: '', dataIndex: 'provisional', width: 100, render: (p) => (p ? <Tag>Provisional</Tag> : <Tag color="green">Final</Tag>) },
  ];
  const pending = ![PULLBACK_STATUS.APPROVED, PULLBACK_STATUS.SETTLED].includes(pb.status);
  return (
    <>
      <Card size="small" title="Lines and pay" extra={<Text strong>Vendor earns {fmtMoney(pb.earnings.total)} on these pieces</Text>} style={{ marginBottom: 12 }}>
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={lineColumns}
          dataSource={pb.lines}
          scroll={{ x: 930 }}
          expandable={{ expandedRowRender: (l, i) => <Table rowKey="docNo" size="small" pagination={false} columns={BREAKDOWN_COLUMNS} dataSource={per[i]?.breakdown || []} /> }}
        />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          A good pulled-back piece earns the share of the vendor&apos;s rate for the stages it finished (expand a line). Each piece is paid once: here, or as accepted on a receipt.
        </Text>
      </Card>
      <Card size="small" title={pending ? 'What approval would hold back on the vendor\'s POs' : 'Held back on the vendor\'s POs'}>
        <Table rowKey={(w) => `${w.docKey}|${w.kind}|${w.colour}|${w.stage}`} size="small" pagination={false} columns={withdrawalColumns} dataSource={pb.withdrawals} scroll={{ x: 820 }} />
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          The vendor PO rows are never edited: these quantities come off their plan, coverage, material issues and reservations. Returns replace the size split with what actually came back.
        </Text>
      </Card>
    </>
  );
});

export default PullBackPayCard;
