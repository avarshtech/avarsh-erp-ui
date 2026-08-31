import { Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { formatNumber } from '../../../utils/formatters';
import {
  LINE_BILLING_STATUS_COLOR,
  LINE_BILLING_STATUS_LABEL,
} from '../../../utils/billPassingConstants';

const { Text } = Typography;

const dash = <Text style={{ color: 'var(--text-secondary)' }}>-</Text>;

/**
 * Received-minus-PO, the figure the client eyeballs on the spreadsheet this
 * grid replaces. An exact match is green; any drift at all is amber, because
 * over- and under-receipt both need a bill-passing decision.
 */
const renderQtyVariance = (value) => {
  const n = Number(value) || 0;
  return (
    <Text
      style={{
        fontSize: 12,
        color: n === 0 ? 'var(--success-color)' : 'var(--warning-color)',
      }}
    >
      {n > 0 ? '+' : ''}
      {formatNumber(n, 3)}
    </Text>
  );
};

// Column order mirrors the supplier-billing sheet it replaces — do not reorder.
export const getBillPassingLinesColumns = () => [
  {
    title: 'PO No',
    dataIndex: 'poNumber',
    key: 'poNumber',
    fixed: 'left',
    width: 150,
    render: (v) => v || dash,
  },
  {
    title: 'Supplier',
    dataIndex: 'supplierName',
    key: 'supplierName',
    width: 180,
    ellipsis: true,
    render: (v) => v || dash,
  },
  {
    title: 'Item Description',
    dataIndex: 'description',
    key: 'description',
    width: 230,
    ellipsis: true,
    render: (description, record) => (
      <div>
        <div>{description || record.itemCode || '-'}</div>
        {record.itemCode && description && (
          <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{record.itemCode}</Text>
        )}
      </div>
    ),
  },
  {
    title: 'Colour',
    dataIndex: 'color',
    key: 'color',
    width: 120,
    render: (v) => v || dash,
  },
  {
    title: 'PO Qty',
    dataIndex: 'poQty',
    key: 'poQty',
    width: 110,
    align: 'center',
    render: (v) => formatNumber(v, 3),
  },
  {
    title: 'Recd Qty',
    dataIndex: 'receivedQty',
    key: 'receivedQty',
    width: 130,
    align: 'center',
    render: (v, record) => (
      <div>
        <div>{formatNumber(v, 3)}</div>
        {renderQtyVariance(record.qtyVariance)}
      </div>
    ),
  },
  {
    title: 'Debit',
    dataIndex: 'debitAmount',
    key: 'debitAmount',
    width: 130,
    align: 'right',
    render: (amount) =>
      amount ? (
        <CurrencyDisplay amount={amount} currency="INR" color="var(--warning-color)" />
      ) : (
        dash
      ),
  },
  {
    title: 'GRN No',
    dataIndex: 'grnNumber',
    key: 'grnNumber',
    width: 150,
    render: (v) => v || dash,
  },
  {
    title: 'Recd Date',
    dataIndex: 'receivedDate',
    key: 'receivedDate',
    width: 130,
    align: 'center',
    render: (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-'),
  },
  {
    title: 'Rate',
    dataIndex: 'rate',
    key: 'rate',
    width: 120,
    align: 'right',
    render: (rate) => <CurrencyDisplay amount={rate} currency="INR" strong={false} />,
  },
  {
    title: 'PO Value',
    dataIndex: 'poValue',
    key: 'poValue',
    width: 145,
    align: 'right',
    render: (value) => <CurrencyDisplay amount={value} currency="INR" />,
  },
  {
    title: 'Invoice No',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 175,
    ellipsis: true,
    render: (v) => v || dash,
  },
  {
    title: 'Invoice Date',
    dataIndex: 'invoiceDate',
    key: 'invoiceDate',
    width: 130,
    align: 'center',
    render: (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '-'),
  },
  {
    title: 'Billing Status',
    dataIndex: 'billingStatus',
    key: 'billingStatus',
    width: 155,
    align: 'center',
    fixed: 'right',
    render: (status) => (
      <Tag color={LINE_BILLING_STATUS_COLOR[status]}>
        {LINE_BILLING_STATUS_LABEL[status] || status}
      </Tag>
    ),
  },
];

export default getBillPassingLinesColumns;
