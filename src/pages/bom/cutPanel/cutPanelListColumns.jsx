import { Space, Tag, Tooltip } from 'antd';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel, isRequirementEditable } from '../../../utils/requirementStatus';
import { formatDate } from '../../../utils/formatters';

/** Columns of the Cut Panel Requirement list (PRD §7.3) — no PO column, no PO action. */
export const buildCutPanelListColumns = ({ onOpen, canUpdate }) => [
  {
    title: 'CPR No.', dataIndex: 'cprNo', key: 'cprNo', width: 150, fixed: 'left',
    render: (v, r) => <RecordLink text={v} onClick={() => onOpen(r)} />,
  },
  { title: 'Order No.', dataIndex: 'orderNo', key: 'orderNo', width: 140 },
  { title: 'Buyer', dataIndex: 'buyer', key: 'buyer', width: 140, ellipsis: true },
  { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 110 },
  {
    title: 'Fabric', dataIndex: 'fabrics', key: 'fabrics', width: 170,
    render: (fabrics = []) => (fabrics.length ? (
      <Space size={4}>
        <span>{fabrics[0]}</span>
        {fabrics.length > 1 && (
          <Tooltip title={fabrics.slice(1).join(', ')}><Tag>+{fabrics.length - 1}</Tag></Tooltip>
        )}
      </Space>
    ) : '—'),
  },
  { title: 'Colours', dataIndex: 'colorCount', key: 'colorCount', width: 90, align: 'right' },
  { title: 'Processes', dataIndex: 'processCount', key: 'processCount', width: 100, align: 'right' },
  {
    title: 'Total Panel Qty', dataIndex: 'totalQty', key: 'totalQty', width: 140, align: 'right',
    render: (v) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Number(v || 0).toLocaleString('en-IN')}</span>,
  },
  {
    title: 'Status', dataIndex: 'status', key: 'status', width: 140, align: 'center',
    render: (s) => <StatusTag status={s} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />,
  },
  {
    title: 'Created', dataIndex: 'createdOn', key: 'createdOn', width: 130,
    render: (v, r) => <Tooltip title={`by ${r.createdBy}`}>{formatDate(v)}</Tooltip>,
  },
  {
    title: 'Actions', key: 'actions', width: 90, fixed: 'right',
    render: (_, r) => (isRequirementEditable(r.status) && canUpdate
      ? <ActionButton action="edit" size="small" onClick={() => onOpen(r)} />
      : <ActionButton action="view" size="small" onClick={() => onOpen(r)} />),
  },
];
