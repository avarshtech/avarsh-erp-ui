import { Button, Table, Tag, Tooltip, Typography } from 'antd';
import { REJECT_SOURCE_LABEL, RECEIPT_STATUS } from '../../../../utils/jobWorkTracker/constants';
import { ReceiptStatusTag } from '../components/JwTags';
import { fmtDate, fmtQty } from '../jwFormat';

const { Text } = Typography;

/** Receipt list columns; Cancel shows only on a posted receipt and for users with the cancel op. */
const receiptColumns = ({ onOpenJob, onCancel, canCancel }) => [
  { title: 'Receipt', dataIndex: 'receiptNo', width: 170, render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.receiptDate)}</Text></> },
  { title: 'Job', dataIndex: 'jobNo', width: 170, render: (v, r) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenJob(r.jobId)}>{v}</Button> },
  { title: 'Vendor', dataIndex: 'vendorName', width: 180 },
  { title: 'Order / style', key: 'os', width: 200, render: (_, r) => `${r.orderNo} · ${r.styleNo}` },
  { title: 'Stage', dataIndex: 'stageLabel', width: 170, render: (v, r) => <>{v}{r.temporary && <Tag color="gold" style={{ marginLeft: 6 }}>Temporary</Tag>}</> },
  { title: 'Vendor DC', dataIndex: 'vendorDcNo', width: 130 },
  { title: 'Good', dataIndex: 'good', align: 'right', width: 80, render: fmtQty },
  { title: 'Rejected', dataIndex: 'rejected', align: 'right', width: 90, render: fmtQty },
  { title: 'Alter', dataIndex: 'alter', align: 'right', width: 80, render: fmtQty },
  {
    title: 'Status', dataIndex: 'status', width: 120,
    render: (s, r) => (r.cancelReason ? <Tooltip title={r.cancelReason}><span><ReceiptStatusTag status={s} /></span></Tooltip> : <ReceiptStatusTag status={s} />),
  },
  {
    title: '', key: 'act', width: 80, fixed: 'right',
    render: (_, r) => (r.status === RECEIPT_STATUS.POSTED && canCancel
      ? <Button type="link" size="small" danger onClick={() => onCancel(r)}>Cancel</Button> : null),
  },
];

const LINE_COLUMNS = [
  { title: 'Colour', dataIndex: 'colour', width: 110 },
  { title: 'Size', dataIndex: 'size', width: 70 },
  { title: 'Good', dataIndex: 'good', align: 'right', width: 80, render: fmtQty },
  { title: 'Alter', dataIndex: 'alter', align: 'right', width: 80, render: fmtQty },
  { title: 'Rejected', dataIndex: 'rejected', align: 'right', width: 90, render: fmtQty },
  { title: 'Reject source', dataIndex: 'rejectSource', width: 160, render: (s) => (s ? REJECT_SOURCE_LABEL[s] : '—') },
];

/** The receipt's colour × size lines, shown when a row is expanded. */
export const renderReceiptLines = (receipt) => (
  <Table rowKey={(l) => `${l.colour}|${l.size}`} size="small" pagination={false} columns={LINE_COLUMNS}
    dataSource={receipt.lines} style={{ maxWidth: 620 }} />
);

export default receiptColumns;
