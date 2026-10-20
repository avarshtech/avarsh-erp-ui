import { Button, Progress, Typography } from 'antd';
import { PULLBACK_REASON_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { PullBackStatusTag } from '../components/JwTags';
import {
  fmtDate, fmtMoney, fmtQty, pct,
} from '../jwFormat';

const { Text } = Typography;

/** Pull-back list columns; the job number opens the job drawer, the row opens the pull-back. */
const pullBackColumns = ({ onOpenJob }) => [
  { title: 'Pull-back', dataIndex: 'pbNo', width: 165, render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>Raised {fmtDate(r.requestedAt)}</Text></> },
  {
    title: 'Job', dataIndex: 'jobNo', width: 160,
    render: (v, r) => <Button type="link" size="small" style={{ padding: 0 }} onClick={(e) => { e.stopPropagation(); onOpenJob(r.jobId); }}>{v}</Button>,
  },
  { title: 'Vendor', dataIndex: 'vendorName', width: 180 },
  { title: 'Order / style', key: 'os', width: 190, render: (_, r) => `${r.orderNo} · ${r.styleNo}` },
  { title: 'Reason', dataIndex: 'reason', width: 140, render: (v) => PULLBACK_REASON_LABEL[v] || '—' },
  { title: 'Requested', dataIndex: 'requestedQty', align: 'right', width: 95, render: fmtQty },
  { title: 'Approved', dataIndex: 'approvedQty', align: 'right', width: 95, render: (v) => (v === null ? '—' : fmtQty(v)) },
  {
    title: 'Back', key: 'back', width: 130,
    render: (_, r) => (r.approvedQty ? <Progress percent={pct(r.returnedQty, r.approvedQty)} size="small" format={() => fmtQty(r.returnedQty)} /> : '—'),
  },
  { title: 'Vendor earns', dataIndex: 'earnedEstimate', align: 'right', width: 110, render: fmtMoney },
  { title: 'In-house by', dataIndex: 'targetDate', width: 115, render: fmtDate },
  { title: 'Vendor\'s new date', dataIndex: 'vendorNewDue', width: 130, render: fmtDate },
  { title: 'Status', dataIndex: 'status', width: 200, render: (s) => <PullBackStatusTag status={s} /> },
];

export default pullBackColumns;
