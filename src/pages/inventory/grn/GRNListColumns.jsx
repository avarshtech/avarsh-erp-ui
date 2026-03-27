import { Space, Tag } from 'antd';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import StatusTag from '../../../components/StatusTag';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { GRN_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const TYPE_COLORS = { Fabric: 'blue', Accessories: 'purple' };

const getGRNListColumns = ({ onView, onEdit }) => [
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
    title: 'Date',
    dataIndex: 'grnDate',
    key: 'grnDate',
    width: 110,
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
    width: 100,
    render: (_, record) => (
      <Space size="small">
        <ActionButton action="view" onClick={() => onView(record)} />
        <ActionButton action="edit" onClick={() => onEdit(record)} />
      </Space>
    ),
  },
];

export default getGRNListColumns;
