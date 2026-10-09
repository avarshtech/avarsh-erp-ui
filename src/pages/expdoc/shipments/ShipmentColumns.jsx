import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import { SHIPMENT_STATUS, SHIPMENT_STATUS_LABELS } from '../../../utils/expDocConstants';
import { SHIPMENT_STATUS_CONFIG } from '../../../utils/statusConfig';

const { Text } = Typography;

const orDash = (text) => text || <Text type="secondary">—</Text>;
const statusLabel = (status) => SHIPMENT_STATUS_LABELS[status] || status;

/**
 * Column unit for the shipment register. Every cell stays on one line (the table is
 * `table-nowrap`); a CLOSED shipment is read-only, so it offers neither Edit nor Delete.
 */
export const buildShipmentColumns = ({ onView, onEdit, onDocuments, onDelete, canUpdate, canDelete }) => [
  {
    title: 'Shipment No',
    dataIndex: 'shipmentNo',
    key: 'shipmentNo',
    fixed: 'left',
    render: (text, record) => <RecordLink text={text} onClick={() => onView(record)} />,
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    render: (status) => <StatusTag status={status} config={SHIPMENT_STATUS_CONFIG} getLabel={statusLabel} />,
  },
  { title: 'Consignee', dataIndex: 'buyerName', key: 'buyerName' },
  {
    title: 'Orders',
    dataIndex: 'orderNos',
    key: 'orderNos',
    // One line however many orders: the first, then "+N" naming the rest on hover.
    render: (nos) => (nos?.length ? (
      <Space size={4} wrap={false}>
        {nos[0]}
        {nos.length > 1 && (
          <Tooltip title={nos.join(', ')}>
            <Tag style={{ marginInlineEnd: 0 }}>{`+${nos.length - 1}`}</Tag>
          </Tooltip>
        )}
      </Space>
    ) : orDash(null)),
  },
  { title: 'Mode', dataIndex: 'mode', key: 'mode', align: 'center' },
  { title: 'Incoterm', dataIndex: 'incoterm', key: 'incoterm', align: 'center' },
  { title: 'Port of Loading', dataIndex: 'portOfLoading', key: 'portOfLoading', render: orDash },
  { title: 'Port of Discharge', dataIndex: 'portOfDischarge', key: 'portOfDischarge', render: orDash },
  { title: 'ETD', dataIndex: 'etd', key: 'etd', render: orDash },
  { title: 'ETA', dataIndex: 'eta', key: 'eta', render: orDash },
  {
    title: 'Containers',
    dataIndex: 'containerCount',
    key: 'containerCount',
    align: 'right',
    render: (count) => (count ? count : orDash(null)),
  },
  {
    // Packing lists still live in the browser that raised them.
    title: <Tooltip title="Packing lists raised in this browser">Packing Lists</Tooltip>,
    dataIndex: 'packingListCount',
    key: 'packingListCount',
    align: 'right',
    render: (count) => (count ? count : <Text type="secondary">None yet</Text>),
  },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    // The row itself opens the record — keep action clicks from bubbling into it.
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, record) => {
      const open = record.status === SHIPMENT_STATUS.OPEN;
      return (
        <Space size="small">
          <ActionButton action="view" size="small" onClick={() => onView(record)} />
          {/* §18: the whole consignment’s paperwork, from the row that owns it. ActionButton
              renders its own tooltip — wrapping it in another showed two popovers. */}
          <ActionButton action="print" size="small" tooltip="Document set" onClick={() => onDocuments(record)} />
          {canUpdate && open && <ActionButton action="edit" size="small" onClick={() => onEdit(record)} />}
          {canDelete && open && (
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
      );
    },
  },
];

export default buildShipmentColumns;
