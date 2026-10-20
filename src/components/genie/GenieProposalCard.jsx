import { Button, Flex, Tag, Typography } from 'antd';
import { CheckCircleFilled, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;
const CONFIRM = { material: 'Create & add', process: 'Create & add', overhead: 'Create & add', buyer: 'Create…', style: 'Create…' };

/**
 * A master record the Genie suggests. Nothing exists until the user clicks: "Create & add" makes it
 * through the ordinary create endpoint (their own permissions apply) and adds it to the screen;
 * "Edit" opens the create form pre-filled.
 */
export default function GenieProposalCard({ proposal, onConfirm, onEdit, onDismiss }) {
  const { status } = proposal;
  if (status === 'dismissed') return null;
  return (
    <div className="genie-card" role="group" aria-label={proposal.title}>
      <Flex vertical gap={4}>
        <Text strong><PlusOutlined /> {proposal.title}</Text>
        {proposal.detail && <Text type="secondary" style={{ fontSize: 12 }}>{proposal.detail}</Text>}
        {status === 'done' && <Text type="success" style={{ fontSize: 12 }}><CheckCircleFilled /> {proposal.result || 'Created.'}</Text>}
        {status === 'failed' && <Text type="danger" style={{ fontSize: 12 }}>{proposal.result}</Text>}
        {status !== 'done' && (
          <Flex gap={6} wrap>
            <Button size="small" type="primary" loading={status === 'busy'} onClick={onConfirm}>
              {status === 'failed' ? 'Try again' : CONFIRM[proposal.kind] || 'Create'}
            </Button>
            {['material', 'process', 'overhead'].includes(proposal.kind) && (
              <Button size="small" disabled={status === 'busy'} onClick={onEdit}>Edit</Button>
            )}
            <Button size="small" type="text" disabled={status === 'busy'} onClick={onDismiss}>Dismiss</Button>
          </Flex>
        )}
        {status === 'done' && <Tag color="green" style={{ alignSelf: 'flex-start' }}>Created</Tag>}
      </Flex>
    </div>
  );
}
