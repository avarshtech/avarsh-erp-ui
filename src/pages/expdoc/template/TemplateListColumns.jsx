import { Space, Tag, Tooltip, Typography } from 'antd';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import RecordLink from '../../../components/RecordLink';
import StatusTag from '../../../components/StatusTag';
import { TEMPLATE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { TEMPLATE_STATUS, TEMPLATE_STATUS_LABELS, DOC_TYPE_LABELS } from '../../../utils/expDocConstants';

const { Text } = Typography;

/** Column factory for the buyer-template register. */
export const buildTemplateColumns = ({ onOpen, onClone, onDelete, canUpdate, canDelete }) => [
  {
    title: 'Template',
    dataIndex: 'templateCode',
    key: 'templateCode',
    fixed: 'left',
    width: 210,
    render: (code, r) => (
      <Space orientation="vertical" size={0}>
        <RecordLink text={code} onClick={() => onOpen(r)} />
        <Text type="secondary" style={{ fontSize: 11 }} ellipsis>{r.name}</Text>
      </Space>
    ),
  },
  {
    title: 'Document',
    dataIndex: 'docType',
    key: 'docType',
    width: 130,
    render: (d) => <Tag>{DOC_TYPE_LABELS[d] || d}</Tag>,
  },
  {
    title: 'Applies to',
    key: 'scope',
    width: 190,
    render: (_, r) => (r.buyerCode
      ? (
        <Space size={4} wrap>
          <Text>{r.buyerCode}</Text>
          {r.subClientCode && <Tag color="blue">{r.subClientCode}</Tag>}
        </Space>
      )
      : (
        <Tooltip title="Used by any buyer with no template of their own.">
          <Tag>generic</Tag>
        </Tooltip>
      )),
  },
  {
    title: 'Version',
    key: 'version',
    width: 120,
    render: (_, r) => (
      <Space size={4}>
        <Text strong>{`v${r.version}`}</Text>
        {r.hasNewerVersion && (
          <Tooltip title={`v${r.latestVersion} exists`}><Tag color="gold">superseded</Tag></Tooltip>
        )}
      </Space>
    ),
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (s) => <StatusTag status={s} config={TEMPLATE_STATUS_CONFIG} labels={TEMPLATE_STATUS_LABELS} />,
  },
  {
    title: 'Effective',
    key: 'effective',
    width: 190,
    render: (_, r) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {r.effectiveFrom ? `${r.effectiveFrom} → ${r.effectiveTo || 'open'}` : 'not published'}
      </Text>
    ),
  },
  {
    title: 'In use by',
    key: 'usage',
    width: 130,
    align: 'right',
    render: (_, r) => (r.usage?.total
      ? (
        <Tooltip title={`${r.usage.packingLists} packing list(s), ${r.usage.invoices} invoice(s), ${r.usage.stickerRuns} sticker run(s)`}>
          <Text>{`${r.usage.total} document(s)`}</Text>
        </Tooltip>
      )
      : <Text type="secondary">—</Text>),
  },
  {
    title: 'Bindings',
    key: 'bindings',
    width: 140,
    render: (_, r) => (r.unknownBindings?.length
      ? (
        <Tooltip title={`Off-catalogue: ${r.unknownBindings.join(', ')}. These render blank.`}>
          <Tag color="orange">{`${r.unknownBindings.length} unknown`}</Tag>
        </Tooltip>
      )
      : <Tag color="green">all bound</Tag>),
  },
  {
    title: '',
    key: 'actions',
    width: 130,
    fixed: 'right',
    onCell: () => ({ onClick: (e) => e.stopPropagation() }),
    render: (_, r) => (
      <Space size={2}>
        <ActionButton action="view" size="small" onClick={() => onOpen(r)} />
        {canUpdate && (
          <Tooltip title="Clone this template as the starting point for another buyer.">
            <span><ActionButton action="duplicate" size="small" onClick={() => onClone(r)} /></span>
          </Tooltip>
        )}
        {canDelete && r.status === TEMPLATE_STATUS.DRAFT && r.canDelete && (
          <DeleteConfirm onConfirm={() => onDelete(r)} itemName={r.templateCode}>
            <ActionButton action="delete" size="small" />
          </DeleteConfirm>
        )}
      </Space>
    ),
  },
];

export default buildTemplateColumns;
