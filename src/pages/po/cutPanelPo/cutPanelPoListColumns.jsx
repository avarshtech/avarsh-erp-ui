import { Space, Tag, Tooltip } from 'antd';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';
import { formatDate } from '../../../utils/formatters';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** First value, then "+n" with the rest in a tooltip (PRD §14.2 — consolidated POs). */
const firstPlus = (list = []) => (list.length ? (
  <Space size={4}>
    <span>{list[0]}</span>
    {list.length > 1 && <Tooltip title={list.slice(1).join(', ')}><Tag>+{list.length - 1}</Tag></Tooltip>}
  </Space>
) : '—');

/** Columns of the Cut Panel PO register (PRD FR-26, report R-1). A flag replaces the status pill (FR-28). */
export const buildCutPanelPoColumns = ({ onOpen, canUpdate }) => [
  { title: 'PO No.', dataIndex: 'poNo', width: 150, fixed: 'left', render: (v, r) => <RecordLink text={v} onClick={() => onOpen(r)} /> },
  { title: 'PO Date', dataIndex: 'poDate', width: 110, render: (v) => formatDate(v) },
  { title: 'CPR', dataIndex: 'cprNos', width: 190, render: firstPlus },
  { title: 'Order', dataIndex: 'orderNos', width: 170, render: firstPlus },
  { title: 'Style', dataIndex: 'styleNos', width: 110, render: firstPlus },
  { title: 'Buyer', dataIndex: 'buyers', width: 130, render: firstPlus },
  { title: 'Job Worker', dataIndex: 'vendorName', width: 180, ellipsis: true },
  { title: 'Process', dataIndex: 'processLabel', width: 140 },
  { title: 'PO Qty', dataIndex: 'poQty', width: 100, align: 'right', render: n },
  { title: 'PO Value', dataIndex: 'poValue', width: 130, align: 'right', render: money },
  { title: 'Delivery', dataIndex: 'requiredDeliveryDate', width: 110, render: (v) => formatDate(v) },
  {
    title: 'Status', key: 'status', width: 170, align: 'center', fixed: 'right',
    render: (_, r) => (r.flags.length
      ? <Space size={2} wrap>{r.flags.map((f) => <Tag key={f.key} color={f.color}>{f.label}</Tag>)}</Space>
      : <StatusTag status={r.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />),
  },
  {
    title: 'Actions', key: 'actions', width: 90, fixed: 'right',
    render: (_, r) => (r.status === S.DRAFT && canUpdate
      ? <ActionButton action="edit" size="small" onClick={() => onOpen(r)} />
      : <ActionButton action="view" size="small" onClick={() => onOpen(r)} />),
  },
];
