import {
  Button, Card, Collapse, Space, Tag, Tooltip, Typography, theme,
} from 'antd';
import {
  CopyOutlined, EyeOutlined, FileTextOutlined, EditOutlined, DeleteOutlined,
} from '@ant-design/icons';
import StatusTag from '../../../components/StatusTag';
import { DeleteConfirm } from '../../../components/buttons';
import { TEMPLATE_STATUS, TEMPLATE_STATUS_LABELS } from '../../../utils/expDocConstants';
import { TEMPLATE_STATUS_CONFIG } from '../../../utils/statusConfig';

const { Text } = Typography;

const dateOf = (v) => (v ? String(v).slice(0, 10) : null);

/**
 * One template (every revision of one code) on the register: what documents can use
 * now, whether a new version is being prepared, and where it came from. Publishing and
 * retiring happen in the builder, behind their confirmations; the card opens it.
 */
const TemplateFamilyCard = ({
  family, highlighted, canAdd, canDelete, onOpen, onPreview, onCopy, onDelete,
}) => {
  const { token } = theme.useToken();
  const { head, active, draft, revisions } = family;
  const older = revisions.filter((r) => r !== active && r !== draft);

  return (
    <Card
      size="small"
      data-template-code={head.templateCode}
      style={{ marginBottom: 12, ...(highlighted ? { boxShadow: `0 0 0 2px ${token.colorPrimary}` } : {}) }}
      title={(
        <Space size={8} wrap>
          <Text strong>{head.name}</Text>
          <Tag style={{ fontFamily: 'monospace' }}>{head.templateCode}</Tag>
          {head.subClientCode && <Tag color="cyan">{`Sub-client ${head.subClientCode}`}</Tag>}
          {head.isSystem && <Tag color="blue">Built-in</Tag>}
          {highlighted && <Tag color="green">Just saved</Tag>}
        </Space>
      )}
      extra={(
        <Space size={4}>
          <Tooltip title="Preview with sample data">
            <Button size="small" icon={<EyeOutlined />} aria-label="Preview" onClick={() => onPreview(head)} />
          </Tooltip>
          {canAdd && (
            <Tooltip title="Copy into a new template">
              <Button size="small" icon={<CopyOutlined />} aria-label="Copy" onClick={() => onCopy(head)} />
            </Tooltip>
          )}
          <Button size="small" type="primary" icon={<EditOutlined />} onClick={() => onOpen(draft || head)}>
            {draft && !head.isSystem ? `Open draft v${draft.version}` : 'Open'}
          </Button>
        </Space>
      )}
    >
      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
        <Space size={8} wrap>
          {active ? (
            <>
              <StatusTag status={TEMPLATE_STATUS.ACTIVE} config={TEMPLATE_STATUS_CONFIG} labels={TEMPLATE_STATUS_LABELS} />
              <Text>{`v${active.version}`}</Text>
              {!active.isSystem && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {[
                    dateOf(active.effectiveFrom) && `since ${dateOf(active.effectiveFrom)}`,
                    active.publishedByName && `by ${active.publishedByName}`,
                  ].filter(Boolean).join(' ')}
                </Text>
              )}
            </>
          ) : <Text type="secondary">Not published yet — no document can use it</Text>}
          {draft && (
            <Tag color="gold">{active ? `Draft v${draft.version} in progress` : `Draft v${draft.version}`}</Tag>
          )}
          {head.usage?.total > 0 && <Tag>{`${head.usage.total} document(s)`}</Tag>}
        </Space>
        {head.sourceFileName && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <FileTextOutlined />
            {` Read from ${head.sourceFileName}`}
          </Text>
        )}
        {draft && canDelete && !active && (
          <DeleteConfirm recordLabel={`${draft.templateCode} v${draft.version}`} onConfirm={() => onDelete(draft)}>
            <Button size="small" danger type="text" icon={<DeleteOutlined />} style={{ paddingInline: 0 }}>Delete draft</Button>
          </DeleteConfirm>
        )}
        {older.length > 0 && (
          <Collapse
            ghost size="small"
            items={[{
              key: 'older',
              label: <Text type="secondary" style={{ fontSize: 12 }}>{`${older.length} earlier version(s)`}</Text>,
              children: (
                <Space orientation="vertical" size={2}>
                  {older.map((r) => (
                    <Button key={r.id} type="link" size="small" style={{ paddingInline: 0 }} onClick={() => onOpen(r)}>
                      {`v${r.version} — ${TEMPLATE_STATUS_LABELS[r.status] || r.status}${dateOf(r.effectiveTo) ? ` until ${dateOf(r.effectiveTo)}` : ''}`}
                    </Button>
                  ))}
                </Space>
              ),
            }]}
          />
        )}
      </Space>
    </Card>
  );
};

export default TemplateFamilyCard;
