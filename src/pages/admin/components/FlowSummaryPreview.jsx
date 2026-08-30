import { Card, Form, Space, Tag, Typography } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import {
  ENTITY_TYPES,
  ENTITY_TYPE_COLORS,
  CONDITION_OPERATORS,
  getConditionField,
} from '../../../utils/approvalFlowConstants';

const { Text } = Typography;

const opLabel = (op) => CONDITION_OPERATORS.find((o) => o.value === op)?.label || op;

/** Live one-line routing summary: entity + conditions → level chain. */
const FlowSummaryPreview = ({ roles = [], users = [] }) => {
  const form = Form.useFormInstance();
  const entityType = Form.useWatch('entityType', form);
  const conditions = Form.useWatch('conditions', form);
  const levels = Form.useWatch('levels', form);

  if (!entityType) return null;

  const entityLabel = ENTITY_TYPES.find((e) => e.value === entityType)?.label || entityType;
  const conditionText = (conditions || [])
    .filter((c) => c?.field && c?.operator && c?.value !== undefined && c?.value !== null)
    .map((c) => `${getConditionField(entityType, c.field)?.label || c.field} ${opLabel(c.operator)} ${c.value}`)
    .join(' AND ');

  const levelName = (level, index) => {
    if (level?.levelName) return level.levelName;
    if (level?.approverType === 'USER') {
      return users.find((u) => u.id === level.approverUserId)?.name || `Level ${index + 1}`;
    }
    return roles.find((r) => r.id === level?.approverRoleId)?.name || `Level ${index + 1}`;
  };

  return (
    <Card size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: '8px 12px' } }}>
      <Space wrap size={6} align="center">
        <Tag color={ENTITY_TYPE_COLORS[entityType]} style={{ marginInlineEnd: 0 }}>{entityLabel}</Tag>
        {conditionText
          ? <Text type="secondary" style={{ fontSize: 12 }}>where {conditionText}</Text>
          : <Text type="secondary" style={{ fontSize: 12 }}>all documents</Text>}
        <ArrowRightOutlined style={{ color: '#bfbfbf' }} />
        {(levels || []).length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>no levels yet</Text>}
        {(levels || []).map((level, index) => (
          // Positional key is correct here: rows are identified by position (level number)
          // eslint-disable-next-line react/no-array-index-key
          <Space key={index} size={6} align="center">
            {index > 0 && <ArrowRightOutlined style={{ color: '#d9d9d9', fontSize: 10 }} />}
            <Tag style={{ marginInlineEnd: 0 }}>{index + 1}. {levelName(level, index)}</Tag>
          </Space>
        ))}
      </Space>
    </Card>
  );
};

export default FlowSummaryPreview;
