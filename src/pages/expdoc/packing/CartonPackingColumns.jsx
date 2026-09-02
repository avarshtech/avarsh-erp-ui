import { Badge, Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import { PACKING_ENTRY_STATUS_CONFIG } from '../../../utils/statusConfig';
import { PACKING_ENTRY_STATUS_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

const nowrap = (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text || '—'}</Text>;
const numeric = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Column factory for the carton packing register. */
export const buildCartonPackingColumns = ({ onView, onEdit, onDelete, canUpdate, canDelete }) => [
  {
    title: 'Packing No',
    dataIndex: 'packingNo',
    key: 'packingNo',
    fixed: 'left',
    width: 170,
    render: (text, record) => <RecordLink text={text} onClick={() => onView(record)} />,
  },
  { title: 'Order No', dataIndex: 'orderNo', key: 'orderNo', width: 160, render: nowrap },
  {
    title: 'Buyer',
    dataIndex: 'buyerName',
    key: 'buyerName',
    width: 200,
    ellipsis: true,
    render: (name, record) => (
      <Space size={4} wrap={false}>
        <Text ellipsis>{name || '—'}</Text>
        {record.subClientCode && <Tag color="geekblue">{record.subClientCode}</Tag>}
      </Space>
    ),
  },
  { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 150, ellipsis: true },
  {
    title: 'Cartons',
    dataIndex: ['totals', 'cartons'],
    key: 'cartons',
    width: 96,
    align: 'right',
    render: (v) => numeric(v),
  },
  {
    title: 'Carton Nos',
    dataIndex: 'cartonRangeLabel',
    key: 'cartonRangeLabel',
    width: 150,
    ellipsis: true,
    render: (v) => nowrap(v),
  },
  {
    title: 'Pieces',
    dataIndex: ['totals', 'pieces'],
    key: 'pieces',
    width: 106,
    align: 'right',
    render: (v) => numeric(v),
  },
  {
    title: 'Gross (kg)',
    dataIndex: ['totals', 'grossWeightKg'],
    key: 'grossWeightKg',
    width: 110,
    align: 'right',
    render: (v) => numeric(v, 3),
  },
  {
    title: 'CBM',
    dataIndex: ['totals', 'cbm'],
    key: 'cbm',
    width: 92,
    align: 'right',
    render: (v) => numeric(v, 3),
  },
  {
    title: 'Issues',
    key: 'issues',
    width: 116,
    align: 'center',
    render: (_, record) => {
      if (!record.errorCount && !record.warningCount) {
        return <Text type="secondary">—</Text>;
      }
      return (
        <Space size={6}>
          {record.errorCount > 0 && (
            <Tooltip title={`${record.errorCount} structural error(s) block completion`}>
              <Badge count={record.errorCount} color="var(--error-color)" />
            </Tooltip>
          )}
          {record.warningCount > 0 && (
            <Tooltip title={`${record.warningCount} warning(s)`}>
              <Badge count={record.warningCount} color="var(--warning-color)" />
            </Tooltip>
          )}
        </Space>
      );
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 140,
    render: (status) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <StatusTag
          status={status}
          config={PACKING_ENTRY_STATUS_CONFIG}
          getLabel={(s) => PACKING_ENTRY_STATUS_LABELS[s] || s}
        />
      </span>
    ),
  },
  { title: 'Updated', dataIndex: 'lastUpdated', key: 'lastUpdated', width: 150, render: nowrap },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 132,
    // The row itself opens the record — keep action clicks from bubbling into it.
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, record) => (
      <Space size="small">
        <ActionButton action="view" size="small" onClick={() => onView(record)} />
        {canUpdate && <ActionButton action="edit" size="small" onClick={() => onEdit(record)} />}
        {canDelete && (
          <DeleteConfirm
            title="Delete packing entry"
            recordLabel={record.packingNo}
            onConfirm={() => onDelete(record)}
          >
            {/* DeleteConfirm renders only its children inside a Popconfirm — without
                one, nothing appears at all. */}
            <ActionButton action="delete" size="small" />
          </DeleteConfirm>
        )}
      </Space>
    ),
  },
];

export default buildCartonPackingColumns;
