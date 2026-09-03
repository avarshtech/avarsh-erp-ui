import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';

const { Text } = Typography;

const nowrap = (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text || '—'}</Text>;

/**
 * Column factory for the shipment register.
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
    title: 'Buyer',
    dataIndex: 'buyerName',
    key: 'buyerName',
    width: 220,
    ellipsis: true,
    render: (name, record) => (
      <Space size={4} wrap={false}>
        <Text ellipsis>{name || '—'}</Text>
        {record.subClientCode && <Tag color="geekblue">{record.subClientCode}</Tag>}
      </Space>
    ),
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
        {/* §18: the whole consignment’s paperwork, from the row that owns it. */}
        <Tooltip title="Document set">
          <span>
            <ActionButton action="print" size="small" onClick={() => onDocuments(record)} />
          </span>
        </Tooltip>
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
