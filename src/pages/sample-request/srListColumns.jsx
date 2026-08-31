import { Tag, Typography, Space } from 'antd';
import StatusTag from '../../components/StatusTag';
import RecordLink from '../../components/RecordLink';
import { ActionButton } from '../../components/buttons';
import { SR_STATUS_CONFIG } from '../../utils/statusConfig';
import { getSrStatusLabel, SR_STATUS, isSrEditable, isSrDeletable } from '../../utils/sampleRequestConstants';
import { formatDate } from '../../utils/formatters';
import DaysRemainingTag from './DaysRemainingTag';

const { Text } = Typography;

/**
 * SR List columns (R2). Direct role/status-gated action buttons — invoices are
 * generated after DISPATCH creation (Dispatches → Invoices), never from here;
 * rounds are not used, so there is no Round column.
 */
export const buildSrColumns = ({
  onView, onEdit, onDelete, canUpdate, canDelete,
}) => [
  {
    title: 'SR Number',
    dataIndex: 'srNo',
    key: 'srNo',
    fixed: 'left',
    width: 150,
    render: (text, record) => <RecordLink text={text} onClick={() => onView(record)} />,
  },
  {
    title: 'Order No',
    dataIndex: 'orderNo',
    key: 'orderNo',
    width: 150,
    // Doc numbers must never wrap at the "/" separators — the table scrolls instead
    render: (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text}</Text>,
  },
  {
    title: 'Style No',
    dataIndex: 'styleNo',
    key: 'styleNo',
    width: 130,
    render: (text) => <Text strong>{text || '-'}</Text>,
  },
  { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 110, ellipsis: true },
  {
    title: 'Sample Type',
    dataIndex: 'sampleTypeName',
    key: 'sampleTypeName',
    width: 170,
    // Single line, wide column — the table scrolls rather than wrapping badges
    render: (name) => (
      <Tag color="purple" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{name}</Tag>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 175,
    // Wide enough for the longest badge ("Revision Required" + icon) — never clipped
    render: (status) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <StatusTag status={status} config={SR_STATUS_CONFIG} getLabel={getSrStatusLabel} />
      </span>
    ),
  },
  {
    title: 'Dispatch Deadline',
    dataIndex: 'dispatchDeadline',
    key: 'dispatchDeadline',
    width: 130,
    render: (date) => (date ? formatDate(date) : <Text type="secondary">— not set —</Text>),
  },
  {
    title: 'Buyer Deadline',
    dataIndex: 'buyerApprovalDeadline',
    key: 'buyerApprovalDeadline',
    width: 140,
    render: (date) => (date ? formatDate(date) : <Text type="secondary">— not set —</Text>),
  },
  {
    title: 'Days Remaining',
    key: 'daysRemaining',
    width: 150,
    // Terminal rows show a short outcome chip instead of repeating the Status badge
    render: (_, record) => {
      if (record.status === SR_STATUS.REVISION_REQUIRED) {
        return <Tag color="orange" style={{ whiteSpace: 'nowrap' }}>Closed — revision noted</Tag>;
      }
      if (record.status === SR_STATUS.APPROVED) return <Tag color="green">Closed</Tag>;
      if (record.status === SR_STATUS.REJECTED) return <Tag>Closed</Tag>;
      if (record.status === SR_STATUS.DISPATCHED) return <Tag color="cyan">Dispatched</Tag>;
      if (record.status === SR_STATUS.FEEDBACK_RECEIVED) {
        return <Tag color="geekblue" style={{ whiteSpace: 'nowrap' }}>Decision pending</Tag>;
      }
      return <DaysRemainingTag date={record.dispatchDeadline} />;
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 120,
    // Row click opens the detail — keep action clicks from bubbling into it
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    // All actions are direct icon buttons (no grouped ⋮ menu), role/status gated
    render: (_, record) => {
      const draft = isSrEditable(record.status);
      return (
        <Space size="small">
          <ActionButton action="view" size="small" onClick={() => onView(record)} />
          {draft && canUpdate && (
            <ActionButton action="edit" size="small" onClick={() => onEdit(record)} />
          )}
          {isSrDeletable(record.status) && canDelete && (
            <ActionButton action="delete" size="small" onClick={() => onDelete(record)} />
          )}
        </Space>
      );
    },
  },
];

export default buildSrColumns;
