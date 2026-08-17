import { Space, Tag, Popconfirm } from 'antd';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import StatusTag from '../../../components/StatusTag';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import { GRN_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const TYPE_COLORS = { Fabric: 'blue', Accessories: 'purple' };

// Edit is allowed only for these statuses (matches the form-level edit gate).
// DRAFT = still being created; REVERSED = previously submitted, reopened for edits.
const EDITABLE_STATUSES = new Set([
  GRN_STATUS.DRAFT,
  GRN_STATUS.REVERSED,
]);

// Cancel is a pre-QC action: Draft or QC_Pending (server also blocks once any
// QC inspection exists against the GRN).
const CANCELLABLE_STATUSES = new Set([
  GRN_STATUS.DRAFT,
  GRN_STATUS.QC_PENDING,
]);

const getGRNListColumns = ({ onView, onEdit, onDelete, onCancel, canCancel = false }) => [
  {
    title: 'GRN Number',
    dataIndex: 'grnNumber',
    key: 'grnNumber',
    fixed: 'left',
    width: 160,
    render: (text, record) => (
      <RecordLink text={text} onClick={() => onView(record)} />
    ),
  },
  {
    title: 'GRN Date',
    dataIndex: 'grnDate',
    key: 'grnDate',
    width: 120,
    align: 'center',
    render: (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-'),
    sorter: (a, b) => dayjs(a.grnDate).unix() - dayjs(b.grnDate).unix(),
  },
  {
    title: 'Type',
    dataIndex: 'type',
    key: 'type',
    width: 110,
    render: (type) => <Tag color={TYPE_COLORS[type] || 'default'}>{type}</Tag>,
  },
  {
    title: 'PO Number',
    dataIndex: 'poNumber',
    key: 'poNumber',
    width: 160,
  },
  {
    title: 'Supplier',
    dataIndex: 'supplier',
    key: 'supplier',
    width: 180,
    ellipsis: true,
  },
  {
    title: 'Items',
    key: 'items',
    width: 80,
    align: 'center',
    render: (_, record) =>
      formatNumber(record.type === 'Fabric' ? record.totalRolls : record.items?.length || 0),
  },
  {
    title: 'Total Amount',
    dataIndex: 'totalAmount',
    key: 'totalAmount',
    width: 140,
    align: 'right',
    render: (amount) => <CurrencyDisplay amount={amount} currency="INR" />,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 140,
    fixed: 'right',
    render: (status) => (
      <StatusTag status={status} config={GRN_STATUS_CONFIG} getLabel={getInventoryStatusLabel} />
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 130,
    align: 'center',
    render: (_, record) => {
      const isDraft = record.status === GRN_STATUS.DRAFT;
      const canEdit = EDITABLE_STATUSES.has(record.status);
      return (
        <Space size="small">
          <ActionButton action="view" onClick={() => onView(record)} />
          {canEdit && <ActionButton action="edit" onClick={() => onEdit(record)} />}
          {isDraft && (
            <Popconfirm
              title="Delete draft GRN"
              description={`Are you sure you want to delete ${record.grnNumber}?`}
              okText="Delete"
              okType="danger"
              cancelText="Cancel"
              onConfirm={() => onDelete?.(record)}
            >
              <ActionButton action="delete" />
            </Popconfirm>
          )}
          {canCancel && CANCELLABLE_STATUSES.has(record.status) && (
            <ActionButton action="cancel" onClick={() => onCancel?.(record)} />
          )}
        </Space>
      );
    },
  },
];

export default getGRNListColumns;
