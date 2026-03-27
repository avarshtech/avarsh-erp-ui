import { Tag } from 'antd';
import StatusTag from '../../../components/StatusTag';
import { STOCK_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { formatNumber } from '../../../utils/formatters';

const getAgeColor = (days) => {
  if (days <= 90) return 'var(--success-color)';
  if (days <= 180) return 'var(--warning-color)';
  return 'var(--error-color)';
};

const getFabricStockColumns = () => [
  {
    title: 'Roll #',
    dataIndex: 'rollNumber',
    key: 'rollNumber',
    fixed: 'left',
    width: 100,
    render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>,
  },
  {
    title: 'Fabric Description',
    dataIndex: 'fabricDescription',
    key: 'fabricDescription',
    width: 200,
    ellipsis: true,
  },
  {
    title: 'Style',
    dataIndex: 'style',
    key: 'style',
    width: 140,
    render: (text) => <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{text || '-'}</span>,
  },
  {
    title: 'Order',
    dataIndex: 'orderRef',
    key: 'orderRef',
    width: 140,
    render: (text) => text || '-',
  },
  {
    title: 'Supplier',
    dataIndex: 'supplier',
    key: 'supplier',
    width: 180,
    ellipsis: true,
  },
  {
    title: 'GRN #',
    dataIndex: 'grnNumber',
    key: 'grnNumber',
    width: 160,
    render: (text) => (
      <span style={{ fontWeight: 600, color: 'var(--primary-color)', cursor: 'pointer' }}>
        {text}
      </span>
    ),
  },
  {
    title: 'Width (in)',
    dataIndex: 'width',
    key: 'width',
    width: 90,
    align: 'right',
    render: (v) => formatNumber(v, 0),
  },
  {
    title: 'Weight (kg)',
    dataIndex: 'weight',
    key: 'weight',
    width: 100,
    align: 'right',
    render: (v) => formatNumber(v, 1),
  },
  {
    title: 'GSM',
    dataIndex: 'gsm',
    key: 'gsm',
    width: 70,
    align: 'right',
  },
  {
    title: 'Shade Lot',
    dataIndex: 'shadeLot',
    key: 'shadeLot',
    width: 110,
    render: (lot) => lot ? <Tag color="purple">{lot}</Tag> : '-',
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 130,
    render: (status) => (
      <StatusTag status={status} config={STOCK_STATUS_CONFIG} getLabel={getInventoryStatusLabel} />
    ),
  },
  {
    title: 'Age (days)',
    dataIndex: 'ageDays',
    key: 'ageDays',
    width: 100,
    align: 'center',
    sorter: (a, b) => a.ageDays - b.ageDays,
    render: (days) => (
      <span style={{ fontWeight: 600, color: getAgeColor(days) }}>
        {days ?? '-'}
      </span>
    ),
  },
];

export default getFabricStockColumns;
