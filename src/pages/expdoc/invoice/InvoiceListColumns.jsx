import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import { EXPORT_INVOICE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { INVOICE_STATUS, INVOICE_STATUS_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

const nowrap = (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text || '—'}</Text>;
const money = (v, dp = 2) => (v === null || v === undefined
  ? '—'
  : Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

/** Column factory for the export-invoice register. */
export const buildInvoiceColumns = ({ onView, onDelete, canDelete }) => [
  {
    title: 'Invoice No',
    dataIndex: 'invoiceNo',
    key: 'invoiceNo',
    fixed: 'left',
    width: 200,
    render: (text, record) => (
      <Space size={4} wrap={false}>
        <RecordLink text={text || record.provisionalNo} onClick={() => onView(record)} />
        {/* A draft has no number yet (BR-02) and must not look as though it does. */}
        {!text && <Tooltip title="A number is allocated at approval, so the approved series stays gapless."><Tag>provisional</Tag></Tooltip>}
        {record.revision > 0 && (
          <Tooltip title={`Revision ${record.revision}`}><Tag color="orange">R{record.revision}</Tag></Tooltip>
        )}
      </Space>
    ),
  },
  { title: 'Date', dataIndex: 'invoiceDate', key: 'invoiceDate', width: 110, render: nowrap },
  {
    title: 'Buyer',
    dataIndex: 'buyerName',
    key: 'buyerName',
    width: 190,
    ellipsis: true,
    render: (name, record) => (
      <Space size={4} wrap={false}>
        <Text ellipsis>{name || '—'}</Text>
        {record.subClientCode && <Tag>{record.subClientCode}</Tag>}
      </Space>
    ),
  },
  { title: 'Shipment', dataIndex: 'shipmentNo', key: 'shipmentNo', width: 155, render: nowrap },
  { title: 'Packing lists', dataIndex: 'plNos', key: 'plNos', width: 190, ellipsis: true, render: nowrap },
  {
    title: 'Cur',
    dataIndex: 'currency',
    key: 'currency',
    width: 70,
    align: 'center',
    render: (c) => <Text>{c || '—'}</Text>,
  },
  {
    title: 'Invoice value',
    key: 'netTotal',
    width: 130,
    align: 'right',
    render: (_, r) => <Text strong>{money(r.totals?.netTotal)}</Text>,
  },
  {
    title: 'Pieces',
    key: 'pieces',
    width: 100,
    align: 'right',
    render: (_, r) => money(r.plTotals?.pieces, 0),
  },
  {
    title: 'Cartons',
    key: 'cartons',
    width: 90,
    align: 'right',
    render: (_, r) => money(r.plTotals?.cartons, 0),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 150,
    render: (status, record) => (
      <Space size={4} wrap>
        <StatusTag status={status} config={EXPORT_INVOICE_STATUS_CONFIG} labels={INVOICE_STATUS_LABELS} />
        {record.isStale && (
          <Tooltip title="A packing list under this invoice has changed since the lines were generated. Regenerate before approving.">
            <Tag color="gold">stale</Tag>
          </Tooltip>
        )}
      </Space>
    ),
  },
  {
    title: '',
    key: 'actions',
    width: 110,
    fixed: 'right',
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, record) => (
      <Space size={2}>
        <ActionButton action="view" size="small" onClick={() => onView(record)} />
        {canDelete && record.status === INVOICE_STATUS.DRAFT && (
          <DeleteConfirm
            onConfirm={() => onDelete(record)}
            itemName={record.invoiceNo || record.provisionalNo}
          >
            <ActionButton action="delete" size="small" />
          </DeleteConfirm>
        )}
      </Space>
    ),
  },
];

export default buildInvoiceColumns;
