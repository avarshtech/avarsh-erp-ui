import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';

const { Text } = Typography;

const nowrap = (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text || '—'}</Text>;

/**
 * Column unit for the shipment register.
 *
 * Shipments are an entity this module invents — nothing upstream carries ports,
 * vessel, container or ETD — so the register doubles as the place those values are
 * first captured.
 */
export const buildShipmentColumns = ({ onView, onEdit, onDocuments, onDelete, canUpdate, canDelete }) => [
  {
    title: 'Shipment No',
    dataIndex: 'shipmentNo',
    key: 'shipmentNo',
    fixed: 'left',
    width: 170,
    render: (text, record) => <RecordLink text={text} onClick={() => onView(record)} />,
  },
  {
    title: 'Consignee',
    dataIndex: 'buyerName',
    key: 'buyerName',
    width: 220,
    ellipsis: true,
  },
  {
    title: 'Orders',
    dataIndex: 'orderNos',
    key: 'orderNos',
    width: 190,
    // One line however many orders: the first, then "+N" naming the rest on hover.
    render: (nos) => (nos?.length ? (
      <Space size={4} wrap={false}>
        {nowrap(nos[0])}
        {nos.length > 1 && (
          <Tooltip title={nos.join(', ')}>
            <Tag style={{ marginInlineEnd: 0 }}>{`+${nos.length - 1}`}</Tag>
          </Tooltip>
        )}
      </Space>
    ) : <Text type="secondary">—</Text>),
  },
  { title: 'Mode', dataIndex: 'mode', key: 'mode', width: 80, align: 'center' },
  { title: 'Incoterm', dataIndex: 'incoterm', key: 'incoterm', width: 96, align: 'center' },
  {
    title: 'Port of Loading',
    dataIndex: 'portOfLoading',
    key: 'portOfLoading',
    width: 150,
    ellipsis: true,
  },
  {
    title: 'Port of Discharge',
    dataIndex: 'portOfDischarge',
    key: 'portOfDischarge',
    width: 160,
    ellipsis: true,
  },
  { title: 'ETD', dataIndex: 'etd', key: 'etd', width: 116, render: nowrap },
  { title: 'ETA', dataIndex: 'eta', key: 'eta', width: 116, render: nowrap },
  {
    title: 'Containers',
    dataIndex: 'containerCount',
    key: 'containerCount',
    width: 106,
    align: 'right',
    render: (count) => (count ? count : <Text type="secondary">—</Text>),
  },
  {
    title: 'Packing',
    key: 'packing',
    width: 128,
    align: 'right',
    render: (_, record) =>
      record.packingEntryCount ? (
        <Text style={{ whiteSpace: 'nowrap' }}>
          {record.packingEntryCount} entr{record.packingEntryCount === 1 ? 'y' : 'ies'}
        </Text>
      ) : (
        <Text type="secondary">Not started</Text>
      ),
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 168,
    // The row itself opens the record — keep action clicks from bubbling into it.
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, record) => (
      <Space size="small">
        <ActionButton action="view" size="small" onClick={() => onView(record)} />
        {/* §18: the whole consignment’s paperwork, from the row that owns it. ActionButton
            renders its own tooltip — wrapping it in another showed two popovers. */}
        <ActionButton action="print" size="small" tooltip="Document set" onClick={() => onDocuments(record)} />
        {canUpdate && <ActionButton action="edit" size="small" onClick={() => onEdit(record)} />}
        {canDelete && (
          <DeleteConfirm
            title="Delete shipment"
            recordLabel={record.shipmentNo}
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

export default buildShipmentColumns;
