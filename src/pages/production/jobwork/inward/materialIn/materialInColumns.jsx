import {
  Button, Space, Tag, Tooltip, Typography,
} from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { INWARD_STATUS } from '../../../../../utils/jobWorkInward/inwardConstants';
import { DocStatusTag } from '../components/InwardTags';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const summaryText = (s) => [s.rolls ? `${s.rolls} rolls · ${fmtQty(s.fabricKg)} kg` : null, s.panelSets ? `${fmtQty(s.panelSets)} panel sets` : null, s.trimLines ? `${s.trimLines} trim lines` : null].filter(Boolean).join(' · ');

/** Material In list columns: the job order opens its drawer, Report prints the shortage & defect report. */
const materialInColumns = ({ onOpenJob, onReport, onCancel, canCancel }) => [
  { title: 'Material In', dataIndex: 'inwardNo', width: 160, render: (v, r) => <><Text strong style={{ fontSize: 12 }}>{v}</Text><br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.date)}</Text></> },
  { title: 'Principal', dataIndex: 'principalName', width: 180 },
  { title: 'Job order', dataIndex: 'orderNo', width: 170, render: (v, r) => <Button type="link" size="small" style={{ padding: 0 }} onClick={() => onOpenJob(r.jobOrderId)}>{v} · {r.styleNo}</Button> },
  { title: 'Their challan', dataIndex: 'theirDcNo', width: 200, render: (v, r) => <>{v}<br /><Text type="secondary" style={{ fontSize: 11 }}>{fmtDate(r.theirDcDate)} · {r.dispatchedFrom}</Text></> },
  { title: 'Vehicle / e-way bill', key: 'mv', width: 170, render: (_, r) => <Text style={{ fontSize: 12 }}>{r.vehicleNo || '—'}<br />{r.ewayBillNo || <Text type="secondary">no e-way bill</Text>}</Text> },
  { title: 'What came', dataIndex: 'summary', width: 220, render: summaryText },
  { title: 'Declared value', dataIndex: 'declaredValue', width: 120, align: 'right', render: (v) => <Tooltip title="Their value for the challan and e-way bill; never in our stock value.">{fmtMoney(v)}</Tooltip> },
  {
    title: 'Inspection', key: 'insp', width: 150,
    render: (_, r) => (r.shortLines || r.defectCount ? <Space size={4} wrap>{r.shortLines > 0 && <Tag color="orange">{r.shortLines} short</Tag>}{r.defectCount > 0 && <Tag color="red">{r.defectCount} defects</Tag>}</Space> : <Tag color="green">OK</Tag>),
  },
  { title: 'Status', dataIndex: 'status', width: 110, render: (s, r) => (r.cancelReason ? <Tooltip title={r.cancelReason}><span><DocStatusTag status={s} /></span></Tooltip> : <DocStatusTag status={s} />) },
  {
    title: '', key: 'act', width: 170, fixed: 'right',
    render: (_, r) => (
      <Space size={4}>
        <Button size="small" icon={<PrinterOutlined />} onClick={() => onReport(r.id)}>Report</Button>
        {r.status === INWARD_STATUS.POSTED && canCancel && <Button size="small" type="link" danger onClick={() => onCancel(r)}>Cancel</Button>}
      </Space>
    ),
  },
];

export default materialInColumns;
