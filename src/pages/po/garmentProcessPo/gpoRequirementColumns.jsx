import { Tag, Tooltip } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const num = (title, dataIndex, render = n) => ({ title, dataIndex, align: 'right', width: 96, render });

/** Columns of the requirement selection (PRD §9): Requirement No., Order, Style, Seq, Process, Required, Already PO, Balance, Status. */
export const gpoRequirementColumns = ({ onPo }) => [
  {
    title: 'Requirement No.', dataIndex: 'gprNo', width: 170,
    render: (v, r) => (onPo[r.key] ? <span>{v} <Tag color="blue">On this PO ({onPo[r.key]})</Tag></span> : v),
  },
  { title: 'Order No.', dataIndex: 'orderNo', width: 136 },
  { title: 'Buyer', dataIndex: 'buyer', width: 130, ellipsis: true },
  { title: 'Style', dataIndex: 'styleNo', width: 90 },
  { title: 'Seq', dataIndex: 'seqNo', width: 56, align: 'center' },
  { title: 'Process', dataIndex: 'processLabel', width: 160 },
  num('Required', 'required'),
  num('Already PO', 'allocated', (v, r) => (r.inDraft ? <Tooltip title={`${n(r.inDraft)} more on draft POs — not counted until submitted`}>{n(v)} *</Tooltip> : n(v))),
  num('Balance', 'balance', (v) => <strong>{n(v)}</strong>),
  {
    title: 'Status', dataIndex: 'status', width: 140,
    render: (s) => <StatusTag status={s} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} size="small" />,
  },
];
