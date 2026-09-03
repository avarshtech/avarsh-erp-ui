import { Space, Tag, Typography, Progress, Tooltip } from 'antd';
import { LinkOutlined, InboxOutlined, UndoOutlined } from '@ant-design/icons';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import { ActionButton } from '../../../components/buttons';
import { PO_STATUS_CONFIG, PO_ORDER_MAPPING_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getStatusLabel as getPoStatusLabel } from '../../../utils/poStatusConstants';
import { getMappingStatusLabel } from '../../../utils/poOrderMappingConstants';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

const MAX_ORDER_TAGS = 2;

export const buildColumns = ({ onOpen, onStockOnly, canUpdate }) => [
  {
    title: 'PO Number', dataIndex: 'poNumber', key: 'poNumber', fixed: 'left', width: 150, sorter: true,
    render: (text, r) => <RecordLink text={text} onClick={() => onOpen(r)} />,
  },
  { title: 'PO Date', dataIndex: 'poDate', key: 'poDate', width: 115, sorter: true, render: (d) => formatDate(d) },
  {
    title: 'Supplier', dataIndex: 'supplierName', key: 'supplierName', width: 200, ellipsis: true, sorter: true,
    render: (t) => <Text strong>{t}</Text>,
  },
  {
    title: 'PO Status', dataIndex: 'status', key: 'status', width: 160,
    render: (s) => <StatusTag status={s} config={PO_STATUS_CONFIG} getLabel={getPoStatusLabel} size="small" />,
  },
  {
    title: 'Received', dataIndex: 'receivedPercent', key: 'receivedPercent', width: 120,
    render: (p) => <Progress percent={p} size="small" status={p === 100 ? 'success' : 'normal'} />,
  },
  {
    title: 'Mapped', key: 'mappedPercent', width: 190,
    render: (_, r) => (
      <Space direction="vertical" size={0} style={{ width: '100%' }}>
        <Progress percent={r.mappedPercent} size="small" status={r.mappedPercent === 100 ? 'success' : 'active'} showInfo={false} />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {r.linesFullyMapped} of {r.lineCount} line{r.lineCount === 1 ? '' : 's'} fully mapped{r.linesPartiallyMapped ? ` · ${r.linesPartiallyMapped} partial` : ''}
        </Text>
      </Space>
    ),
  },
  {
    title: 'Linked Orders', dataIndex: 'linkedOrders', key: 'linkedOrders', width: 240,
    render: (orders) => (orders.length ? (
      <Space size={4} wrap>
        {orders.slice(0, MAX_ORDER_TAGS).map((o) => (
          <Tooltip key={o.orderId} title={`${o.buyerName} · ${o.styleNo}`}><Tag color="blue" style={{ marginRight: 0 }}>{o.orderNo}</Tag></Tooltip>
        ))}
        {orders.length > MAX_ORDER_TAGS && (
          <Tooltip title={orders.slice(MAX_ORDER_TAGS).map((o) => o.orderNo).join(', ')}><Tag style={{ marginRight: 0 }}>+{orders.length - MAX_ORDER_TAGS}</Tag></Tooltip>
        )}
      </Space>
    ) : <Text type="secondary">-</Text>),
  },
  {
    title: 'Mapping', dataIndex: 'mappingStatus', key: 'mappingStatus', width: 150,
    render: (s) => <StatusTag status={s} config={PO_ORDER_MAPPING_STATUS_CONFIG} getLabel={getMappingStatusLabel} size="small" />,
  },
  {
    title: 'Actions', key: 'actions', fixed: 'right', width: 100,
    render: (_, r) => (
      <Space size="small">
        <ActionButton action="custom" icon={<LinkOutlined />} tooltip={canUpdate && !r.stockOnly ? 'Map to orders' : 'View mapping'} size="small" onClick={() => onOpen(r)} />
        {canUpdate && (
          <ActionButton
            action="custom"
            icon={r.stockOnly ? <UndoOutlined /> : <InboxOutlined />}
            tooltip={r.stockOnly ? 'Reopen for mapping' : (r.linkedOrders.length ? 'Remove mappings before marking Stock Only' : 'Mark as Stock Only (no order)')}
            disabled={!r.stockOnly && r.linkedOrders.length > 0}
            size="small"
            onClick={() => onStockOnly(r)}
          />
        )}
      </Space>
    ),
  },
];
