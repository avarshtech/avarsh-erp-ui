import { Tag, Typography } from 'antd';
import { formatNumber } from '../../../utils/formatters';
import dayjs from 'dayjs';

const { Text } = Typography;

const SUB_CATEGORY_COLORS = {
  Knit: 'blue',
  Woven: 'geekblue',
  Denim: 'purple',
  Lining: 'cyan',
};


const getAgeColor = (days) => {
  if (days == null) return 'var(--text-secondary)';
  if (days <= 90) return 'var(--success-color)';
  if (days <= 180) return 'var(--warning-color)';
  return 'var(--error-color)';
};

const ageDays = (grnDate) => (grnDate ? dayjs().diff(dayjs(grnDate), 'day') : null);

const getFabricStockColumns = () => [
  {
    title: 'Item Code',
    dataIndex: 'itemCode',
    key: 'itemCode',
    fixed: 'left',
    width: 180,
    align: 'center',
    render: (code) => code,
  },
  {
    title: 'Fabric Description',
    dataIndex: 'fabricDescription',
    key: 'fabricDescription',
    width: 240,
    align: 'center',
    ellipsis: true,
  },
  {
    title: 'Sub Category',
    dataIndex: 'subCategory',
    key: 'subCategory',
    width: 140,
    align: 'center',
    render: (sc) => sc ? <Tag color={SUB_CATEGORY_COLORS[sc] || 'default'}>{sc}</Tag> : '-',
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
    title: 'Order No',
    dataIndex: 'orderRef',
    key: 'orderRef',
    width: 150,
    align: 'center',
    render: (text) => text || '-',
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
    title: 'GRN #',
    dataIndex: 'grnNumber',
    key: 'grnNumber',
    width: 160,
    align: 'center',
    render: (text) => (
      <span style={{ fontWeight: 600, color: 'var(--primary-color)' }}>{text}</span>
    ),
  },
  {
    title: 'Qty',
    key: 'qty',
    width: 140,
    align: 'center',
    sorter: (a, b) => (a.totalQty || 0) - (b.totalQty || 0),
    render: (_, r) => (
      <span style={{ fontWeight: 600 }}>
        {formatNumber(r.totalQty, 2)} <Text type="secondary" style={{ fontSize: 12 }}>{r.uom || 'kg'}</Text>
      </span>
    ),
  },
  {
    title: 'Age',
    key: 'age',
    width: 110,
    align: 'center',
    sorter: (a, b) => (ageDays(a.grnDate) ?? 0) - (ageDays(b.grnDate) ?? 0),
    render: (_, r) => {
      const d = ageDays(r.grnDate);
      return (
        <span style={{ fontWeight: 600, color: getAgeColor(d) }}>
          {d != null ? `${d} days` : '-'}
        </span>
      );
    },
  },
];

export default getFabricStockColumns;
