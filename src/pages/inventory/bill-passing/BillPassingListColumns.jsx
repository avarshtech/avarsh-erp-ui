import { Space, Tag, Popconfirm, Typography } from 'antd';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { ActionButton } from '../../../components/buttons';
import { billLines } from '../../../utils/billPassingCalc';
import {
  BILL_PASSING_STATUS,
  BILL_PASSING_STATUS_COLOR,
  BILL_PASSING_STATUS_LABEL,
  isBillEditable,
  isBillDeletable,
} from '../../../utils/billPassingConstants';

const { Text } = Typography;

const ALL_STATUSES = Object.values(BILL_PASSING_STATUS);

// DRAFT + QUERY_RAISED — the only states where the header and its GRN selection
// are still open. Derived from the shared helper so the grid and the workspace
// can never disagree about what a status allows.
const EDITABLE_STATUSES = new Set(ALL_STATUSES.filter(isBillEditable));

// DRAFT alone — once a bill is submitted it is audit history and is never removed.
const DELETABLE_STATUSES = new Set(ALL_STATUSES.filter(isBillDeletable));

// Accounts hand-off states: a Tally reference only ever exists here, so a blank
// cell in any earlier status is expected rather than missing data.
const TALLY_EXPECTED_STATUSES = new Set([
  BILL_PASSING_STATUS.APPROVED,
  BILL_PASSING_STATUS.SENT_TO_ACCOUNTS,
]);

const money = (record, key) => record?.reconciliation?.valueSummary?.[key];

export const getBillPassingListColumns = ({ onView, onEdit, onDelete, canUpdate = false, canDelete = false }) => [
  {
    title: 'Bill Passing No',
    dataIndex: 'bpNumber',
    key: 'bpNumber',
    fixed: 'left',
    width: 160,
    render: (text, record) => <RecordLink text={text} onClick={() => onView?.(record)} />,
  },
  {
    title: 'Supplier',
    dataIndex: 'supplierName',
    key: 'supplierName',
    width: 200,
    ellipsis: true,
    render: (name) => <Text strong>{name || '-'}</Text>,
  },
  {
    title: 'Supplier Invoice',
    dataIndex: 'supplierInvoiceNo',
    key: 'supplierInvoiceNo',
    width: 180,
    render: (invoiceNo, record) => (
      <div>
        <div>{invoiceNo || '-'}</div>
        <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {record.invoiceDate ? dayjs(record.invoiceDate).format('DD-MMM-YYYY') : '-'}
        </Text>
      </div>
    ),
  },
  {
    title: 'PO No',
    dataIndex: 'poNumber',
    key: 'poNumber',
    width: 150,
    render: (v) => v || '-',
  },
  {
    title: 'Challan No(s)',
    dataIndex: 'challanNumbers',
    key: 'challanNumbers',
    width: 160,
    ellipsis: true,
    render: (v) => v || '-',
  },
  {
    title: 'Material',
    key: 'material',
    width: 210,
    ellipsis: true,
    render: (_, record) => {
      const lines = billLines(record);
      if (!lines.length) return '-';
      const extra = lines.length - 1;
      return (
        <span>
          {lines[0].description || lines[0].itemCode || '-'}
          {extra > 0 && (
            <Text style={{ marginLeft: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
              +{extra} more
            </Text>
          )}
        </span>
      );
    },
  },
  {
    title: 'Total PO Value',
    key: 'poValue',
    width: 140,
    align: 'right',
    render: (_, record) => <CurrencyDisplay amount={money(record, 'poValue')} currency="INR" />,
  },
  {
    title: 'Total GRN Value',
    key: 'grnValue',
    width: 145,
    align: 'right',
    render: (_, record) => <CurrencyDisplay amount={money(record, 'grnValue')} currency="INR" />,
  },
  {
    title: 'Invoice Value',
    key: 'invoiceValue',
    width: 140,
    align: 'right',
    render: (_, record) => (
      <CurrencyDisplay
        amount={money(record, 'invoiceValue') ?? record.invoiceBasicAmount}
        currency="INR"
      />
    ),
  },
  {
    title: 'Total Debit',
    dataIndex: 'debitTotal',
    key: 'debitTotal',
    width: 135,
    align: 'right',
    render: (amount) =>
      amount ? (
        <CurrencyDisplay amount={amount} currency="INR" color="var(--warning-color)" />
      ) : (
        <Text style={{ color: 'var(--text-secondary)' }}>-</Text>
      ),
  },
  {
    title: 'Net Payable',
    dataIndex: 'netPayable',
    key: 'netPayable',
    width: 160,
    align: 'right',
    // Unresolved mismatch cue: a bill that still has blockers cannot be passed,
    // so its payable figure is provisional and reads in the error colour.
    render: (amount, record) => {
      const blocked = Boolean(record.blockers?.length);
      return (
        <CurrencyDisplay
          amount={amount}
          currency="INR"
          color={blocked ? 'var(--error-color)' : undefined}
          secondary={blocked ? `${record.blockers.length} unresolved` : undefined}
        />
      );
    },
  },
  {
    // Sits before the two fixed-right columns so the sticky block stays contiguous.
    title: 'Tally Ref',
    dataIndex: 'tallyReferenceNo',
    key: 'tallyReferenceNo',
    width: 150,
    render: (ref, record) => {
      if (ref) return <Text code>{ref}</Text>;
      if (TALLY_EXPECTED_STATUSES.has(record.status)) {
        return <Text style={{ color: 'var(--text-secondary)' }}>Pending</Text>;
      }
      return '-';
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 165,
    fixed: 'right',
    align: 'center',
    render: (status) => (
      <Tag color={BILL_PASSING_STATUS_COLOR[status]}>
        {BILL_PASSING_STATUS_LABEL[status] || status}
      </Tag>
    ),
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 130,
    align: 'center',
    render: (_, record) => (
      <Space size="small">
        <ActionButton action="view" size="small" onClick={() => onView?.(record)} />
        {canUpdate && EDITABLE_STATUSES.has(record.status) && (
          <ActionButton action="edit" size="small" onClick={() => onEdit?.(record)} />
        )}
        {canDelete && DELETABLE_STATUSES.has(record.status) && (
          <Popconfirm
            title="Delete draft bill"
            description={`Delete ${record.bpNumber}? This cannot be undone.`}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            onConfirm={() => onDelete?.(record)}
          >
            <ActionButton action="delete" size="small" />
          </Popconfirm>
        )}
      </Space>
    ),
  },
];

export default getBillPassingListColumns;
