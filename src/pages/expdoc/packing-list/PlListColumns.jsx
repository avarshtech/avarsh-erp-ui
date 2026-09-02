import { Badge, Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import { PL_STATUS_CONFIG } from '../../../utils/statusConfig';
import { PL_STATUS, PL_STATUS_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

const nowrap = (text) => <Text style={{ whiteSpace: 'nowrap' }}>{text || '—'}</Text>;
const numeric = (v, dp = 0) =>
  (Number(v) || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/** Column factory for the packing-list register. */
export const buildPlColumns = ({ onView, onOpen, onDelete, canUpdate, canDelete }) => [
  {
    title: 'PL No',
    dataIndex: 'plNo',
    key: 'plNo',
    fixed: 'left',
    width: 190,
    render: (text, record) => (
      <Space size={4} wrap={false}>
        <RecordLink text={text} onClick={() => onView(record)} />
        {record.revision > 0 && (
          <Tooltip title={`Revision ${record.revision}`}><Tag color="orange">R{record.revision}</Tag></Tooltip>
        )}
      </Space>
    ),
  },
  { title: 'Shipment', dataIndex: 'shipmentNo', key: 'shipmentNo', width: 160, render: nowrap },
  {
    title: 'Buyer',
    dataIndex: 'buyerName',
    key: 'buyerName',
    width: 200,
    ellipsis: true,
    render: (name, record) => (
      <Space size={4} wrap={false}>
        <Text ellipsis>{name || '—'}</Text>
        {record.subClientCode && <Tag color="geekblue">{record.subClientCode}</Tag>}
      </Space>
    ),
  },
  {
    title: 'Orders',
    dataIndex: 'orderNos',
    key: 'orderNos',
    width: 170,
    ellipsis: true,
    render: (list) => nowrap((list || []).join(', ')),
  },
  { title: 'Cartons', dataIndex: ['totals', 'cartons'], key: 'cartons', width: 92, align: 'right', render: (v) => numeric(v) },
  { title: 'Pieces', dataIndex: ['totals', 'pieces'], key: 'pieces', width: 104, align: 'right', render: (v) => numeric(v) },
  { title: 'Gross (kg)', dataIndex: ['totals', 'grossWeightKg'], key: 'gross', width: 110, align: 'right', render: (v) => numeric(v, 3) },
  { title: 'CBM', dataIndex: ['totals', 'cbm'], key: 'cbm', width: 90, align: 'right', render: (v) => numeric(v, 3) },
  {
    title: 'Template',
    key: 'template',
    width: 190,
    ellipsis: true,
    render: (_, record) => (record.template ? (
      <Space size={4} wrap={false}>
        <Text ellipsis>{record.template.name}</Text>
        <Tag>v{record.template.version}</Tag>
        {record.templateIsFallback && (
          <Tooltip title="No template configured for this buyer — the standard export set is being used.">
            <Tag color="orange">fallback</Tag>
          </Tooltip>
        )}
      </Space>
    ) : <Text type="secondary">None</Text>),
  },
  {
    title: 'Issues',
    key: 'issues',
    width: 116,
    align: 'center',
    render: (_, record) => {
      const errors = record.panelFindings?.errors?.length || 0;
      const open = record.panelFindings?.warnings?.filter((w) => !w.acknowledged).length || 0;
      if (!errors && !open) return <Text type="secondary">—</Text>;
      return (
        <Space size={6}>
          {errors > 0 && (
            <Tooltip title={`${errors} error(s) block submission`}>
              <Badge count={errors} color="var(--error-color)" />
            </Tooltip>
          )}
          {open > 0 && (
            <Tooltip title={`${open} warning(s) awaiting a reason`}>
              <Badge count={open} color="var(--warning-color)" />
            </Tooltip>
          )}
        </Space>
      );
    },
  },
  {
    title: 'Source',
    key: 'stale',
    width: 118,
    align: 'center',
    render: (_, record) => (record.isStale ? (
      <Tooltip title={`Carton data changed in ${record.staleSources.map((s) => s.packingNo).join(', ')}`}>
        <Tag color="gold">Stale</Tag>
      </Tooltip>
    ) : <Text type="secondary">Current</Text>),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 140,
    render: (status) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        <StatusTag status={status} config={PL_STATUS_CONFIG} getLabel={(s) => PL_STATUS_LABELS[s] || s} />
      </span>
    ),
  },
  { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 150, render: nowrap },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    width: 132,
    // The row itself opens the record — keep action clicks from bubbling into it.
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, record) => (
      <Space size="small">
        <ActionButton action="view" size="small" onClick={() => onView(record)} />
        {canUpdate && <ActionButton action="edit" size="small" tooltip="Open workspace" onClick={() => onOpen(record)} />}
        {canDelete && record.status === PL_STATUS.DRAFT && (
          <DeleteConfirm title="Delete packing list" recordLabel={record.plNo} onConfirm={() => onDelete(record)}>
            <ActionButton action="delete" size="small" />
          </DeleteConfirm>
        )}
      </Space>
    ),
  },
];

export default buildPlColumns;
