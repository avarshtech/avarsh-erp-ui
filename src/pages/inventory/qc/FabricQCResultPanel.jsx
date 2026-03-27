import { memo } from 'react';
import { Card, Descriptions, Divider, Tag, Button, Input, Space, Typography } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';

const { Text } = Typography;
const { TextArea } = Input;

const RESULT_CONFIG = {
  Pass: { color: 'green', label: 'PASSED' },
  'Conditional Pass': { color: 'orange', label: 'CONDITIONAL' },
  Fail: { color: 'red', label: 'FAILED' },
  Pending: { color: 'default', label: 'PENDING' },
};

const FabricQCResultPanel = memo(function FabricQCResultPanel({
  totalDefectPoints = 0,
  pointsPer100SqYd = 0,
  overallResult = 'Pending',
  parametersPassCount = 0,
  parametersTotalCount = 0,
  approvalStatus = 'Pending',
  onApprove,
  onReject,
  readOnly = false,
  approver,
  approvalRemarks,
}) {
  const resultCfg = RESULT_CONFIG[overallResult] || RESULT_CONFIG.Pending;

  return (
    <Card title="Inspection Result" size="small" style={{ height: '100%' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Tag
          color={resultCfg.color}
          style={{ fontSize: 18, padding: '8px 24px', fontWeight: 700, borderRadius: 'var(--radius-full)' }}
        >
          {resultCfg.label}
        </Tag>
      </div>

      <Descriptions column={1} size="small" labelStyle={{ fontSize: 13 }} contentStyle={{ fontSize: 13, fontWeight: 600 }}>
        <Descriptions.Item label="Total Defect Points">{totalDefectPoints}</Descriptions.Item>
        <Descriptions.Item label="Points / 100 sq yd">{formatNumber(pointsPer100SqYd, 1)}</Descriptions.Item>
        <Descriptions.Item label="Parameters Passed">
          <Text style={{ color: parametersPassCount === parametersTotalCount ? 'var(--success-color)' : 'var(--warning-color)' }}>
            {parametersPassCount} / {parametersTotalCount}
          </Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider style={{ margin: '12px 0' }} />

      <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>Fabric Coordinator Approval</Text>

      {approvalStatus === 'Approved' || approvalStatus === 'Rejected' ? (
        <div>
          <Tag color={approvalStatus === 'Approved' ? 'green' : 'red'}>{approvalStatus}</Tag>
          {approver && <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>By: {approver}</Text>}
          {approvalRemarks && <Text style={{ fontSize: 12, display: 'block', marginTop: 4, fontStyle: 'italic' }}>{approvalRemarks}</Text>}
        </div>
      ) : !readOnly ? (
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          <TextArea placeholder="Approval remarks..." rows={2} id="approval-remarks" />
          <Space>
            <Button type="primary" icon={<CheckCircleOutlined />} size="small" onClick={onApprove}>Approve</Button>
            <Button danger icon={<CloseCircleOutlined />} size="small" onClick={onReject}>Reject</Button>
          </Space>
        </Space>
      ) : (
        <Tag color="blue">Pending Approval</Tag>
      )}
    </Card>
  );
});

export default FabricQCResultPanel;
