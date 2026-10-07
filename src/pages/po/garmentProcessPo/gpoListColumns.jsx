import { Space, Tag, Tooltip } from 'antd';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';
import { formatDate } from '../../../utils/formatters';

const n = (v) => Number(v || 0).toLocaleString('en-IN');
const money = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const firstPlus = (list = []) => (list.length ? (
  <Space size={4}><span>{list[0]}</span>{list.length > 1 && <Tooltip title={list.slice(1).join(', ')}><Tag>+{list.length - 1}</Tag></Tooltip>}</Space>
) : '—');

/**
 * Columns of the Garment Process PO list (PRD §22). A flag (overdue return, order
 * cancelled…) replaces the status pill; row actions View, Edit (Draft), Print and Cancel.
 * `a` = { onOpen, onPrint, onCancel, canUpdate, canCancel }.
 */
export const buildGpoListColumns = (a) => [
  { title: 'PO No.', dataIndex: 'poNo', width: 150, fixed: 'left', render: (v, r) => <RecordLink text={v} onClick={() => a.onOpen(r)} /> },
  { title: 'Requirement No.', dataIndex: 'gprNos', width: 190, render: firstPlus },
  { title: 'Order', dataIndex: 'orderNos', width: 160, render: firstPlus },
  { title: 'Style', dataIndex: 'styleNos', width: 110, render: firstPlus },
  { title: 'Vendor', dataIndex: 'vendorName', width: 190 },
  { title: 'Process', dataIndex: 'processLabel', width: 150 },
  { title: 'Qty', dataIndex: 'poQty', width: 90, align: 'right', render: n },
  { title: 'Grand Total', dataIndex: 'poValue', width: 130, align: 'right', render: money },
  { title: 'PO Date', dataIndex: 'poDate', width: 110, render: (v) => formatDate(v) },
  { title: 'Expected delivery', dataIndex: 'expectedReturnDate', width: 140, render: (v) => formatDate(v) },
  {
    title: 'Status', key: 'status', width: 160, align: 'center', fixed: 'right',
    render: (_, r) => (r.flags.length
      ? <Space size={2}>{r.flags.map((f) => <Tag key={f.key} color={f.color}>{f.label}</Tag>)}</Space>
      : <StatusTag status={r.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />),
  },
  {
    title: 'Actions', key: 'actions', width: 130, fixed: 'right',
    render: (_, r) => (
      <Space size={2}>
        {r.status === S.DRAFT && a.canUpdate
          ? <ActionButton action="edit" size="small" aria-label={`Edit ${r.poNo}`} onClick={() => a.onEdit(r)} />
          : <ActionButton action="view" size="small" aria-label={`Open ${r.poNo}`} onClick={() => a.onOpen(r)} />}
        {r.status !== S.DRAFT && <ActionButton action="print" size="small" aria-label={`Print ${r.poNo}`} loading={a.printingId === r.id} onClick={() => a.onPrint(r)} />}
        {a.canCancel && [S.DRAFT, S.APPROVED].includes(r.status) && <ActionButton action="cancel" size="small" aria-label={`Cancel ${r.poNo}`} onClick={() => a.onCancel(r)} />}
      </Space>
    ),
  },
];
