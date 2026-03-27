import { Tag } from 'antd';
import { formatNumber } from '../../../utils/formatters';

const CATEGORY_COLORS = {
  Buttons: 'blue',
  Zippers: 'purple',
  Labels: 'cyan',
  Thread: 'orange',
  Elastic: 'green',
  Interlining: 'magenta',
  Packaging: 'volcano',
};

const getAccessoriesStockColumns = () => [
  {
    title: 'Item Code',
    dataIndex: 'itemCode',
    key: 'itemCode',
    fixed: 'left',
    width: 160,
    render: (text) => <span style={{ fontWeight: 600 }}>{text}</span>,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    width: 220,
    ellipsis: true,
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    width: 120,
    render: (cat) => <Tag color={CATEGORY_COLORS[cat] || 'default'}>{cat}</Tag>,
  },
  {
    title: 'Style',
    dataIndex: 'style',
    key: 'style',
    width: 140,
    render: (text) => <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{text || '-'}</span>,
  },
  {
    title: 'UOM',
    dataIndex: 'uom',
    key: 'uom',
    width: 70,
    align: 'center',
  },
  {
    title: 'Total Qty',
    dataIndex: 'totalQty',
    key: 'totalQty',
    width: 100,
    align: 'right',
    render: (v) => formatNumber(v),
  },
  {
    title: 'Available',
    dataIndex: 'available',
    key: 'available',
    width: 100,
    align: 'right',
    render: (v) => <span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{formatNumber(v)}</span>,
  },
  {
    title: 'Reserved',
    dataIndex: 'reserved',
    key: 'reserved',
    width: 90,
    align: 'right',
    render: (v) => <span style={{ color: 'var(--primary-color)' }}>{formatNumber(v)}</span>,
  },
  {
    title: 'Issued',
    dataIndex: 'issued',
    key: 'issued',
    width: 90,
    align: 'right',
    render: (v) => <span style={{ color: '#13c2c2' }}>{formatNumber(v)}</span>,
  },
  {
    title: 'Status',
    key: 'stockStatus',
    width: 90,
    align: 'center',
    render: (_, record) => {
      const hasAvailable = record.available > 0;
      return (
        <Tag color={hasAvailable ? 'green' : 'default'}>
          {hasAvailable ? 'In Stock' : 'Depleted'}
        </Tag>
      );
    },
  },
];

export default getAccessoriesStockColumns;
