import { Space, Tag, Popconfirm, Typography } from 'antd';
import dayjs from 'dayjs';
import RecordLink from '../../../components/RecordLink';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import { ActionButton } from '../../../components/buttons';
import {
  BILL_PASSING_STATUS,
  BILL_PASSING_STATUS_COLOR,
  BILL_PASSING_STATUS_LABEL,
  isBillEditable,
  isBillDeletable,
  areDebitsEditable,
} from '../../../utils/billPassingConstants';
import { isJobWorkSource } from '../../../utils/jobWorkBillConstants';

const { Text } = Typography;

// A supplier bill stays open until it is passed; a job-work bill only while its deductions are open (its lines
// and its debit note move together). DRAFT alone is ever deleted.
const isRowEditable = (r) => (isJobWorkSource(r.source) ? areDebitsEditable(r.status) : isBillEditable(r.status));

// Accounts hand-off states: a Tally reference only ever exists here, so a blank
// cell in any earlier status is expected rather than missing data.
const TALLY_EXPECTED_STATUSES = new Set([
  BILL_PASSING_STATUS.APPROVED,
  BILL_PASSING_STATUS.SENT_TO_ACCOUNTS,
]);

const money = (amount, extra) => <CurrencyDisplay amount={amount} currency="INR" {...extra} />;

/**
 * Columns of the one bill list over supplier and job-work bills (rows from listAllBills). `partyLabel` heads
 * the party column: Supplier, Vendor, or Party when both kinds are listed.
 */
export const getBillPassingListColumns = ({ onView, onEdit, onDelete, canUpdate = false, canDelete = false, partyLabel = 'Party' }) => [
  {
    title: 'Bill No',
    dataIndex: 'number',
    key: 'number',
    fixed: 'left',
    width: 170,
    render: (text, record) => (
      <Space size={6}>
        <RecordLink text={text} onClick={() => onView?.(record)} />
        {record.demo && <Tag color="orange" style={{ marginInlineEnd: 0 }}>Demo</Tag>}
      </Space>
    ),
  },
  {
    title: partyLabel,
    dataIndex: 'partyName',
    key: 'partyName',
    width: 220,
    render: (name, record) => (
      <Space size={6}>
        <Text strong>{name || '-'}</Text>
        {partyLabel === 'Party' && (
          <Tag color={record.partyType === 'VENDOR' ? 'purple' : 'blue'} style={{ marginInlineEnd: 0 }}>
            {record.partyType === 'VENDOR' ? 'Vendor' : 'Supplier'}
          </Tag>
        )}
      </Space>
    ),
  },
  {
    title: 'Invoice',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    width: 180,
    render: (invoiceNo, record) => (
      <Space size={6}>
        <span>{invoiceNo || '-'}</span>
        <Text style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {record.invoiceDate ? dayjs(record.invoiceDate).format('DD-MMM-YYYY') : ''}
        </Text>
      </Space>
    ),
  },
  { title: 'PO No', dataIndex: 'poNumber', key: 'poNumber', width: 150, render: (v) => v || '-' },
  { title: 'Challan / DC No(s)', dataIndex: 'challanNumbers', key: 'challanNumbers', width: 170, render: (v) => v || '-' },
  {
    title: 'Material / Process',
    dataIndex: 'summary',
    key: 'summary',
    width: 210,
    // Summarised and stored on the bill, so the grid never walks every line of every row.
    render: (v) => v || '-',
  },
  { title: 'PO Value', dataIndex: 'poValue', key: 'poValue', width: 130, align: 'right', render: (v) => money(v) },
  { title: 'Received Value', dataIndex: 'receivedValue', key: 'receivedValue', width: 140, align: 'right', render: (v) => money(v) },
  { title: 'Invoice Value', dataIndex: 'invoiceValue', key: 'invoiceValue', width: 135, align: 'right', render: (v) => money(v) },
  {
    title: 'Total Debit',
    dataIndex: 'debitTotal',
    key: 'debitTotal',
    width: 125,
    align: 'right',
    render: (amount) => (amount
      ? money(amount, { color: 'var(--warning-color)' })
      : <Text style={{ color: 'var(--text-secondary)' }}>-</Text>),
  },
  {
    title: 'Net Payable',
    dataIndex: 'netPayable',
    key: 'netPayable',
    width: 160,
    align: 'right',
    // A bill that still has blockers cannot be passed: its payable is provisional and reads in the error colour.
    render: (amount, record) => {
      const blocked = Number(record.blockerCount) > 0;
      return money(amount, {
        color: blocked ? 'var(--error-color)' : undefined,
        secondary: blocked ? `${record.blockerCount} unresolved` : undefined,
      });
    },
  },
  {
    // Sits before the two fixed-right columns so the sticky block stays contiguous.
    title: 'Tally Ref',
    dataIndex: 'tallyReferenceNo',
    key: 'tallyReferenceNo',
    width: 140,
    render: (ref, record) => {
      if (ref) return <Text code>{ref}</Text>;
      if (TALLY_EXPECTED_STATUSES.has(record.status)) return <Text style={{ color: 'var(--text-secondary)' }}>Pending</Text>;
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
    render: (status) => <Tag color={BILL_PASSING_STATUS_COLOR[status]}>{BILL_PASSING_STATUS_LABEL[status] || status}</Tag>,
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
        {canUpdate && isRowEditable(record) && <ActionButton action="edit" size="small" onClick={() => onEdit?.(record)} />}
        {canDelete && isBillDeletable(record.status) && (
          <Popconfirm
            title="Delete draft bill"
            description={`Delete ${record.number}? This cannot be undone.`}
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
