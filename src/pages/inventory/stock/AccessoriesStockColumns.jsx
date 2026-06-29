import { Tag, Typography } from 'antd';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;

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
    width: 200,
    align: 'center',
    render: (code) => code,
  },
  {
    title: 'Category',
    dataIndex: 'category',
    key: 'category',
    width: 120,
    align: 'center',
    render: (cat) => <Tag color={CATEGORY_COLORS[cat] || 'default'}>{cat}</Tag>,
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    width: 260,
    align: 'center',
    ellipsis: true,
  },
  {
    title: 'Style',
    dataIndex: 'style',
    key: 'style',
    width: 140,
    align: 'center',
    render: (text) => <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{text || '-'}</span>,
  },
  {
    title: 'Supplier',
    dataIndex: 'supplier',
    key: 'supplier',
    width: 180,
    align: 'center',
    ellipsis: true,
  },
  {
    title: 'Source',
    dataIndex: 'sourceType',
    key: 'sourceType',
    width: 100,
    align: 'center',
    render: (src) => src === 'OPENING_BALANCE'
      ? <Tag color="geekblue">Opening</Tag>
      : <Tag>GRN</Tag>,
  },
  {
    title: 'GRN # / Batch',
    dataIndex: 'grnNumber',
    key: 'grnNumber',
    width: 160,
    align: 'center',
    render: (text, r) => (
      <span style={{
        fontWeight: 600,
        color: r?.sourceType === 'OPENING_BALANCE' ? 'var(--info-color, #1677ff)' : 'var(--primary-color)',
      }}>{text || '-'}</span>
    ),
  },
  {
    title: 'Total Stock Qty',
    key: 'totalQty',
    width: 150,
    align: 'center',
    sorter: (a, b) => (a.totalQty || 0) - (b.totalQty || 0),
    render: (_, r) => (
      <span style={{ fontWeight: 600 }}>
        {formatNumber(r.totalQty, 2)}{' '}
        <Text type="secondary" style={{ fontSize: 12 }}>{r.uom || ''}</Text>
      </span>
    ),
  },
];

export default getAccessoriesStockColumns;
