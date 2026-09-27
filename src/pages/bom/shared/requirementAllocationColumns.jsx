import { Progress, Tag, Typography } from 'antd';
import { Link } from 'react-router-dom';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const num = (title, dataIndex, extra = {}) => ({ title, dataIndex, align: 'right', width: 84, render: n, ...extra });

const STEP_COLOR = { 'Not allocated': 'default', 'Partially allocated': 'warning', 'Fully allocated': 'success' };

/** Per process step (CPR) or process line (GPR): the five quantities of CPP PRD §15.1 plus coverage. */
export const stepColumns = (source) => [
  source === 'GPR'
    ? { title: 'Seq', dataIndex: 'seq', width: 56 }
    : { title: 'Step', dataIndex: 'steps', width: 64, render: (steps) => steps.join(', ') },
  {
    title: source === 'GPR' ? 'Process' : 'Process / colour · panel',
    dataIndex: 'label',
    render: (label, r) => (r.detail ? <span>{label} <Text type="secondary">({r.detail})</Text></span> : <strong>{label}</strong>),
  },
  num('Required', 'required'),
  num('In draft PO', 'inDraft', { render: (v) => (v ? n(v) : '—') }),
  num("PO'd", 'allocated'),
  num('Completed', 'completed', { render: (v) => (v ? n(v) : '—') }),
  num('Released', 'released', { render: (v) => (v ? n(v) : '—') }),
  num('Balance', 'balance', { render: (v) => <strong>{n(v)}</strong> }),
  { title: 'Coverage', dataIndex: 'coverage', width: 110, render: (v) => <Progress percent={v} size="small" /> },
  { title: 'Status', dataIndex: 'status', width: 136, render: (v) => <Tag color={STEP_COLOR[v]}>{v}</Tag> },
];

/** The POs raised against the requirement; each number opens its PO. */
export const poColumns = [
  {
    title: 'PO No.', dataIndex: 'poNo', width: 150,
    render: (poNo, r) => <Link to={`${JOB_WORK_PO_PATH[r.type]}/${r.id}`}>{poNo}</Link>,
  },
  { title: 'PO Date', dataIndex: 'poDate', width: 110, render: (v) => formatDate(v) },
  { title: 'Process', dataIndex: 'processLabel' },
  { title: 'Job Worker', dataIndex: 'vendorName' },
  num('PO Qty', 'poQty'),
  num("PO'd", 'allocated', { render: (v) => (v ? n(v) : '—') }),
  num('Received', 'received', { render: (v) => (v ? n(v) : '—') }),
  {
    title: 'Status', dataIndex: 'status', width: 150,
    render: (s) => <StatusTag status={s} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />,
  },
];
